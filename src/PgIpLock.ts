/*!
 * I'm Queue Software Project
 * Copyright (C) 2025  imqueue.com <support@imqueue.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * If you want to use this code in a closed source (commercial) project, you can
 * purchase a proprietary commercial license. Please contact us at
 * <support@imqueue.com> to get commercial licensing options.
 */
import { Notification } from 'pg';
import { ident, literal } from 'pg-format';
import { clearInterval } from 'timers';
import {
    SCHEMA_NAME,
    SHUTDOWN_TIMEOUT,
} from './constants';
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
 * Usually you do not need to instantiate this class directly - it will be done
 * by a PgPubSub instances on their needs. Therefore, you may re-use this piece
 * of code in some other implementations, so it is exported as is.
 */
export class PgIpLock implements AnyLock {
    /**
     * DB lock schema name getter
     *
     * @return {string}
     */
    public get schemaName(): string {
        const suffix = this.uniqueKey ? '_unique' : '';

        return ident(SCHEMA_NAME + suffix);
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
     * @param {string} [uniqueKey] - unique key for specific message
     */
    public constructor(
        public readonly channel: string,
        public readonly options: PgIpLockOptions,
        public readonly uniqueKey?: string,
    ) {
        this.channel = `__${PgIpLock.name}__:${
            channel.replace(RX_LOCK_CHANNEL, '')
        }`;
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
            try {
                await this.createSchema();
                await Promise.all([this.createLock(), this.createDeadlockCheck()]);
            } catch (e) {
                /*ignore*/
            }
        }

        if (this.notifyHandler && !this.uniqueKey) {
            this.options.pgClient.on('notification', this.notifyHandler);
        }

        if (!~PgIpLock.instances.indexOf(this)) {
            PgIpLock.instances.push(this);
        }

        if (!this.uniqueKey) {
            await this.listen();

            // noinspection TypeScriptValidateTypes
            !this.acquireTimer && (this.acquireTimer = setInterval(
                () => !this.acquired && this.acquire(),
                this.options.acquireInterval,
            ));
        }
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
            this.uniqueKey
                ? await this.acquireUniqueLock()
                : await this.acquireChannelLock()
            ;
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
     * Returns true if lock schema exists, false - otherwise
     *
     * @return {Promise<boolean>}
     */
    private async schemaExists(): Promise<boolean> {
        const { rows } = await this.options.pgClient.query(`
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name = '${this.schemaName}'
        `);

        return (rows.length > 0);
    }

    /**
     * Acquires a lock with ID
     *
     * @return {Promise<void>}
     */
    private async acquireUniqueLock(): Promise<void> {
        // noinspection SqlResolve
        await this.options.pgClient.query(`
            INSERT INTO ${this.schemaName}.lock (id, channel, app)
            VALUES (
                ${literal(this.uniqueKey)},
                ${literal(this.channel)},
                ${literal(this.options.pgClient.appName)}
            ) ON CONFLICT (id) DO
            UPDATE SET app = ${this.schemaName}.deadlock_check(
                ${this.schemaName}.lock.app,
                ${literal(this.options.pgClient.appName)}
            )
        `);
    }

    /**
     * Acquires a lock by unique channel
     *
     * @return {Promise<void>}
     */
    private async acquireChannelLock(): Promise<void> {
        // noinspection SqlResolve
        await this.options.pgClient.query(`
            INSERT INTO ${this.schemaName}.lock (channel, app)
            VALUES (
                ${literal(this.channel)},
                ${literal(this.options.pgClient.appName)}
            ) ON CONFLICT (channel) DO
                UPDATE SET app = ${this.schemaName}.deadlock_check(
                ${this.schemaName}.lock.app,
                ${literal(this.options.pgClient.appName)}
            )
        `);
    }

    /**
     * Releases acquired lock on this channel. After lock is released, another
     * running process or host would be able to acquire the lock.
     *
     * @return {Promise<void>}
     */
    public async release(): Promise<void> {
        if (this.uniqueKey) {
            // noinspection SqlResolve
            await this.options.pgClient.query(`
                DELETE FROM ${this.schemaName}.lock
                WHERE id=${literal(this.uniqueKey)}
            `);
        } else {
            if (!this.acquired) {
                return ; // nothing to release, this lock has not been acquired
            }

            // noinspection SqlResolve
            await this.options.pgClient.query(`
                DELETE FROM ${this.schemaName}.lock
                WHERE channel=${literal(this.channel)}
            `);
        }

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
                // noinspection TypeScriptValidateTypes
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
     * Creates lock db schema
     *
     * @return {Promise<void>}
     */
    private async createSchema(): Promise<void> {
        await this.options.pgClient.query(`
            CREATE SCHEMA IF NOT EXISTS ${this.schemaName}
        `);
    }

    /**
     * Creates lock table with delete trigger, which notifies on record removal
     *
     * @return {Promise<void>}
     */
    private async createLock(): Promise<void> {
        // istanbul ignore if
        if (this.uniqueKey) {
            await this.createUniqueLock();

            return ;
        }

        await this.createChannelLock();
    }

    /**
     * Creates unique locks by IDs in the database
     *
     * @return {Promise<void>}
     */
    private async createUniqueLock(): Promise<void> {
        await this.options.pgClient.query(`
            DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT *
                        FROM information_schema.columns
                        WHERE table_schema = '${ this.schemaName }'
                            AND table_name = 'lock'
                            AND column_name = 'id'
                    ) THEN
                        DROP TABLE IF EXISTS ${ this.schemaName }.lock;
                    END IF;
                END
            $$
        `);
        await this.options.pgClient.query(`
            CREATE TABLE IF NOT EXISTS ${ this.schemaName }."lock" (
                "id" CHARACTER VARYING NOT NULL PRIMARY KEY,
                "channel" CHARACTER VARYING NOT NULL,
                "app" CHARACTER VARYING NOT NULL
            )
        `);
        await this.options.pgClient.query(`
            DROP TRIGGER IF EXISTS notify_release_lock_trigger
                ON ${this.schemaName}.lock
        `);
    }

    /**
     * Creates locks by channel names in the database
     *
     * @return {Promise<void>}
     */
    private async createChannelLock(): Promise<void> {
        await this.options.pgClient.query(`
            DO $$
                BEGIN
                    IF EXISTS (
                        SELECT *
                        FROM information_schema.columns
                        WHERE table_schema = '${ this.schemaName }'
                            AND table_name = 'lock'
                            AND column_name = 'id'
                    ) THEN
                        DROP TABLE IF EXISTS ${ this.schemaName }.lock;
                    END IF;
                END
            $$
        `);
        await this.options.pgClient.query(`
            CREATE TABLE IF NOT EXISTS ${ this.schemaName }."lock" (
                "channel" CHARACTER VARYING NOT NULL PRIMARY KEY,
                "app" CHARACTER VARYING NOT NULL
            )
        `);
        // noinspection SqlResolve
        await this.options.pgClient.query(`
            CREATE OR REPLACE FUNCTION ${this.schemaName}.notify_lock()
            RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
            BEGIN PERFORM PG_NOTIFY(OLD.channel, '1'); RETURN OLD; END; $$
        `);

        await this.options.pgClient.query(`
            DROP TRIGGER IF EXISTS notify_release_lock_trigger 
                ON ${this.schemaName}.lock
        `);

        try {
            await this.options.pgClient.query(`
                CREATE CONSTRAINT TRIGGER notify_release_lock_trigger
                    AFTER DELETE ON ${this.schemaName}.lock
                    DEFERRABLE INITIALLY DEFERRED
                    FOR EACH ROW EXECUTE PROCEDURE ${
                    this.schemaName}.notify_lock()
            `);
        } catch (e) {
            /*ignore*/
        }
    }

    /**
     * Creates deadlocks check routine used on lock acquaintance
     *
     * @return {Promise<void>}
     */
    private async createDeadlockCheck(): Promise<void> {
        await this.options.pgClient.query(`
            CREATE OR REPLACE FUNCTION ${this.schemaName}.deadlock_check(
                old_app TEXT,
                new_app TEXT
            )
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
            END; 
            $$
        `);
    }
}

export const RX_LOCK_CHANNEL = new RegExp(`^(__${PgIpLock.name}__:)+`);

let timer: any;
/**
 * Performs graceful shutdown of running process releasing all instantiated
 * locks and properly destroy all their instances.
 */
async function terminate(): Promise<void> {
    let code = 0;

    timer && clearTimeout(timer);
    timer = setTimeout(() => process.exit(code), SHUTDOWN_TIMEOUT);
    code = await destroyLock();
}

/**
 * Destroys all instanced locks and returns exit code
 */
async function destroyLock(): Promise<number> {
    // istanbul ignore if
    if (!PgIpLock.hasInstances()) {
        return 0;
    }

    try {
        await PgIpLock.destroy();

        return 0;
    } catch (err) {
        // istanbul ignore next
        ((PgIpLock.hasInstances()
                ? (PgIpLock as any).instances[0].options.logger
                : console
        ) as any)?.error(err);

        return 1;
    }
}

process.on('SIGTERM', terminate);
process.on('SIGINT',  terminate);
process.on('SIGABRT', terminate);
