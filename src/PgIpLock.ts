/*!
 * Copyright (c) 2018, imqueue.com <support@imqueue.com>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */
import { Notification } from 'pg';
import { ident, literal } from 'pg-format';
import { clearInterval } from 'timers';
import { SCHEMA_NAME, SHUTDOWN_TIMEOUT } from './constants';
import { AnyLock } from './types';
import { PgIpLockOptions } from './types/PgIpLockOptions';
import Timeout = NodeJS.Timeout;

/**
 * Implements manageable inter-process locking mechanism over
 * existing PostgreSQL connection for a given `LISTEN` channel.
 *
 * It uses periodic locks acquire retries and implements graceful shutdown
 * using `SIGINT`, `SIGTERM` and `SIGABRT` OS signals, by which safely releases
 * an acquired lock, which causes an event to other similar running instances
 * on another processes (or on another hosts) to capture free lock.
 *
 * By running inside Docker containers this would work flawlessly on
 * implementation auto-scaling services, as docker destroys containers
 * gracefully.
 *
 * Currently, the only known issue could happen only if, for example, database
 * or software (or hardware) in the middle will cause a silent disconnect. For
 * some period of time, despite the fact that there are other live potential
 * listeners some messages can go into void. This time period can be tuned by
 * bypassing wanted `acquireInterval` argument. By the way, take into account
 * that too short period and number of running services may cause huge flood of
 * lock acquire requests to a database, so selecting the proper number should be
 * a thoughtful trade-off between overall system load and reliability level.
 *
 * Usually you do not need instantiate this class directly - it will be done
 * by a PgPubSub instances on their needs. Therefore, you may re-use this piece
 * of code in some other implementations, so it is exported as is.
 */
export class PgIpLock implements AnyLock {
    /**
     * DB lock schema name getter
     *
     * @return {string}
     */
    public static get schemaName(): string {
        return ident(SCHEMA_NAME);
    }

    /**
     * Calls destroy() on all created instances at a time
     *
     * @return {Promise<void>}
     */
    public static async destroy(): Promise<void> {
        await Promise.all(
            PgIpLock.instances.slice().map(lock => lock.destroy()),
        );
    }

    /**
     * Returns true if at least one instance was created, false - otherwise
     *
     * @return {boolean}
     */
    public static hasInstances(): boolean {
        return PgIpLock.instances.length > 0;
    }

    private static instances: PgIpLock[] = [];
    private acquired = false;
    private notifyHandler: (message: Notification) => void;
    private acquireTimer?: Timeout;

    /**
     * @constructor
     * @param {string} channel - source channel name to manage locking on
     * @param {PgIpLockOptions} options - lock instantiate options
     */
    public constructor(
        public readonly channel: string,
        public readonly options: PgIpLockOptions,
    ) {
        this.channel = `__${PgIpLock.name}__:${channel}`;
        PgIpLock.instances.push(this);
    }

    /**
     * Initializes inter-process locks storage in database and starts
     * listening of lock release events, as well as initializes lock
     * acquire retry timer.
     *
     * @return {Promise<void>}
     */
    public async init(): Promise<void> {
        if (!await this.schemaExists()) {
            await this.createSchema();
            await Promise.all([this.createLock(), this.createDeadlockCheck()]);
        }

        if (this.notifyHandler) {
            this.options.pgClient.on('notification', this.notifyHandler);
        }

        if (!~PgIpLock.instances.indexOf(this)) {
            PgIpLock.instances.push(this);
        }

        await this.listen();

        !this.acquireTimer && (this.acquireTimer = setInterval(
            async () => !this.acquired && this.acquire(),
            this.options.acquireInterval,
        ));
    }

    /**
     * This would provide release handler which will be called once the
     * lock is released and the channel name would be bypassed to a given
     * handler
     *
     * @param {(channel: string) => void} handler
     */
    public onRelease(handler: (channel: string) => void): void {
        if (!!this.notifyHandler) {
            throw new TypeError(
                'Release handler for IPC lock has been already set up!',
            );
        }

        this.notifyHandler = (message): void => {
            // istanbul ignore else
            // we should skip messages from pub/sub channels and listen
            // only to those which are ours
            if (message.channel === this.channel) {
                handler(this.channel.replace(RX_LOCK_CHANNEL, ''));
            }
        };

        this.options.pgClient.on('notification', this.notifyHandler);
    }

    /**
     * Acquires a lock on the current channel. Returns true on success,
     * false - otherwise
     *
     * @return {Promise<boolean>}
     */
    public async acquire(): Promise<boolean> {
        try {
            // it will not throw on successful insert
            // noinspection SqlResolve
            await this.options.pgClient.query(`
                INSERT INTO ${PgIpLock.schemaName}.lock (channel, app)
                VALUES (
                    ${literal(this.channel)},
                    ${literal(this.options.pgClient.appName)}
                ) ON CONFLICT (channel) DO
                UPDATE SET app = ${PgIpLock.schemaName}.deadlock_check(
                    ${PgIpLock.schemaName}.lock.app,
                    ${literal(this.options.pgClient.appName)}
                )
            `);
            this.acquired = true;
        } catch (err) {
            // will throw, because insert duplicates existing lock
            this.acquired = false;

            // istanbul ignore next
            if (!(err.code === 'P0001' && err.detail === 'LOCKED')) {
                this.options.logger.error(err);
            }
        }

        return this.acquired;
    }

    /**
     * Releases acquired lock on this channel. After lock is released, another
     * running process or host would be able to acquire the lock.
     *
     * @return {Promise<void>}
     */
    public async release(): Promise<void> {
        if (!this.acquired) {
            return ; // nothing to release, this lock has not been acquired
        }

        // noinspection SqlResolve
        await this.options.pgClient.query(`
            DELETE FROM ${PgIpLock.schemaName}.lock
            WHERE channel=${literal(this.channel)}
        `);

        this.acquired = false;
    }

    /**
     * Returns current lock state, true if acquired, false - otherwise.
     *
     * @return {boolean}
     */
    public isAcquired(): boolean {
        return this.acquired;
    }

    /**
     * Destroys this lock properly.
     *
     * @return {Promise<void>}
     */
    public async destroy(): Promise<void> {
        try {
            if (this.notifyHandler) {
                this.options.pgClient.off('notification', this.notifyHandler);
            }

            if (this.acquireTimer) {
                clearInterval(this.acquireTimer);
                delete this.acquireTimer;
            }

            await Promise.all([this.unlisten(), this.release()]);

            PgIpLock.instances.splice(
                PgIpLock.instances.findIndex(lock => lock === this),
                1,
            );
        } catch (err) {
            // do not crash - just log
            this.options.logger && this.options.logger.error &&
            this.options.logger.error(err);
        }
    }

    /**
     * Starts listening lock release channel
     *
     * @return {Promise<void>}
     */
    private async listen(): Promise<void> {
        await this.options.pgClient.query(`LISTEN ${ident(this.channel)}`);
    }

    /**
     * Stops listening lock release channel
     *
     * @return {Promise<void>}
     */
    private async unlisten(): Promise<void> {
        await this.options.pgClient.query(`UNLISTEN ${ident(this.channel)}`);
    }

    /**
     * Returns true if lock schema exists, false - otherwise
     *
     * @return {Promise<boolean>}
     */
    private async schemaExists(): Promise<boolean> {
        const { rows } = await this.options.pgClient.query(`
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name = '${PgIpLock.schemaName}'
        `);

        return (rows.length > 0);
    }

    /**
     * Creates lock db schema
     *
     * @return {Promise<void>}
     */
    private async createSchema(): Promise<void> {
        await this.options.pgClient.query(`
            CREATE SCHEMA ${PgIpLock.schemaName}
        `);
    }

    /**
     * Creates lock table with delete trigger, which notifies on record removal
     *
     * @return {Promise<void>}
     */
    private async createLock(): Promise<void> {
        await this.options.pgClient.query(`
            CREATE TABLE ${PgIpLock.schemaName}.lock (
                channel CHARACTER VARYING NOT NULL PRIMARY KEY,
                app CHARACTER VARYING NOT NULL)
        `);
        // noinspection SqlResolve
        await this.options.pgClient.query(`
            CREATE FUNCTION ${PgIpLock.schemaName}.notify_lock()
            RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
            BEGIN PERFORM PG_NOTIFY(OLD.channel, '1'); RETURN OLD; END; $$
        `);
        // noinspection SqlResolve
        await this.options.pgClient.query(`
            CREATE CONSTRAINT TRIGGER notify_release_lock_trigger
            AFTER DELETE ON ${PgIpLock.schemaName}.lock
            DEFERRABLE INITIALLY DEFERRED
            FOR EACH ROW EXECUTE PROCEDURE ${PgIpLock.schemaName}.notify_lock()
        `);
    }

    /**
     * Creates deadlocks check routine used on lock acquaintance
     *
     * @return {Promise<void>}
     */
    private async createDeadlockCheck(): Promise<void> {
        await this.options.pgClient.query(`
            CREATE FUNCTION ${PgIpLock.schemaName}.deadlock_check(
                old_app TEXT,
                new_app TEXT)
            RETURNS TEXT LANGUAGE PLPGSQL AS $$
            DECLARE num_apps INTEGER;
            BEGIN
                SELECT count(query) INTO num_apps
                FROM pg_stat_activity
                WHERE application_name = old_app;
                IF num_apps > 0 THEN
                    RAISE EXCEPTION 'Duplicate channel for app %', new_app
                    USING DETAIL = 'LOCKED';
                END IF;
                RETURN new_app;
            END; $$;
        `);
    }
}

export const RX_LOCK_CHANNEL = new RegExp(`^__${PgIpLock.name}__:`);

let timer: any;
/**
 * Performs graceful shutdown of running process releasing all instantiated
 * locks and properly destroy all their instances.
 */
async function terminate(): Promise<void> {
    let code = 0;

    timer && clearTimeout(timer);
    timer = setTimeout(() => process.exit(code), SHUTDOWN_TIMEOUT);

    // istanbul ignore if
    if (!PgIpLock.hasInstances()) {
        return ;
    }

    try {
        await PgIpLock.destroy();
    } catch (err) {
        code = 1;

        // istanbul ignore next
        (PgIpLock.hasInstances()
            ? (PgIpLock as any).instances[0].options.logger
            : console
        ).error(err);
    }
}

process.on('SIGTERM', terminate);
process.on('SIGINT',  terminate);
process.on('SIGABRT', terminate);
