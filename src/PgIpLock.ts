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
import { AnyLogger, PgClient } from './types';
import Timeout = NodeJS.Timeout;

/**
 * Class PgIpLock - implements manageable inter-process locking mechanism over
 * existing PostgreSQL connection for a given LISTEN channel
 */
export class PgIpLock {
    /**
     * DB lock schema name getter
     *
     * @return {string}
     */
    public static get schemaName() {
        return ident(SCHEMA_NAME);
    }

    /**
     * Calls destroy() on all created instances at a time
     *
     * @return {Promise<void>}
     */
    public static async destroy(): Promise<void> {
        await Promise.all(PgIpLock.instances.map(lock => lock.destroy()));
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
    private acquired: boolean = false;
    private notifyHandler: (message: Notification) => void;
    private acquireTimer?: Timeout;

    /**
     * @constructor
     * @param {string} channel - source channel name to manage locking on
     * @param {PgClient} pgClient - PostgreSQL client
     * @param {AnyLogger} logger - logger
     * @param {number} acquireInterval - interval in milliseconds to try acquire
     */
    public constructor(
        public readonly channel: string,
        public readonly pgClient: PgClient,
        public readonly logger: AnyLogger,
        public acquireInterval: number,
    ) {
        this.channel = `__${PgIpLock.name}__:${channel}`;
        PgIpLock.instances.push(this);
    }

    /**
     * Initializes IPC locks storage
     *
     * @return {Promise<void>}
     */
    public async init(): Promise<void> {
        if (!await this.schemaExists()) {
            await this.createSchema();
            await Promise.all([
                this.createLock(),
                this.createDeadlockCheck(),
            ]);
        }

        if (this.notifyHandler) {
            this.pgClient.on('notification', this.notifyHandler);
        }

        await this.listen();

        if (!this.acquireTimer) {
            this.acquireTimer = setInterval(
                async () => !this.acquired && await this.acquire(),
                this.acquireInterval,
            );
        }
    }

    /**
     * This would provide release handler which will be called once the
     * lock is released and the channel name would be bypassed to a handler
     *
     * @param {(channel: string) => void} handler
     */
    public onRelease(handler: (channel: string) => void) {
        if (!!this.notifyHandler) {
            throw new TypeError(
                'Release handler for IPC lock has been already set up!',
            );
        }

        this.notifyHandler = message => {
            // istanbul ignore else
            // we should skip messages from pub/sub channels and listen
            // only to those which are ours
            if (message.channel === this.channel) {
                handler(this.channel.replace(RX_LOCK_CHANNEL, ''));
            }
        };

        this.pgClient.on('notification', this.notifyHandler);
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
            await this.pgClient.query(`
                INSERT INTO ${PgIpLock.schemaName}.lock (channel, app)
                VALUES (
                    ${literal(this.channel)},
                    ${literal(this.pgClient.appName)}
                ) ON CONFLICT (channel) DO
                UPDATE SET app = ${PgIpLock.schemaName}.deadlock_check(
                    ${PgIpLock.schemaName}.lock.app,
                    ${literal(this.pgClient.appName)}
                )
            `);
            this.acquired = true;
        } catch (err) {
            // will throw, because insert duplicates existing lock
            this.acquired = false;

            // istanbul ignore next
            if (!(err.code === 'P0001' && err.detail === 'LOCKED')) {
                this.logger.error(err);
            }
        }

        return this.acquired;
    }

    /**
     * Releases acquired lock
     *
     * @return {Promise<void>}
     */
    public async release(): Promise<void> {
        if (!this.acquired) {
            return ; // nothing to release, this lock has not been acquired
        }

        // noinspection SqlResolve
        await this.pgClient.query(`
            DELETE FROM ${PgIpLock.schemaName}.lock
            WHERE channel=${literal(this.channel)}
        `);

        this.acquired = false;
    }

    /**
     * Returns current lock state
     *
     * @return {boolean}
     */
    public isAcquired(): boolean {
        return this.acquired;
    }

    /**
     * Destroys this lock properly. After destroy, if it is required to be
     * re-used - it should be re-initialized with init().
     *
     * @return {Promise<void>}
     */
    public async destroy(): Promise<void> {
        if (this.notifyHandler) {
            this.pgClient.off('notification', this.notifyHandler);
        }

        if (this.acquireTimer) {
            clearInterval(this.acquireTimer);
            delete this.acquireTimer;
        }

        await Promise.all([this.unlisten(), this.release()]);
    }

    /**
     * Starts listening lock release channel
     *
     * @return {Promise<void>}
     */
    private async listen(): Promise<void> {
        await this.pgClient.query(`LISTEN ${ident(this.channel)}`);
    }

    /**
     * Stops listening lock release channel
     *
     * @return {Promise<void>}
     */
    private async unlisten(): Promise<void> {
        await this.pgClient.query(`UNLISTEN ${ident(this.channel)}`);
    }

    /**
     * Returns true if lock schema exists, false - otherwise
     *
     * @return {Promise<boolean>}
     */
    private async schemaExists(): Promise<boolean> {
        const { rows } = await this.pgClient.query(`
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
        await this.pgClient.query(`CREATE SCHEMA ${PgIpLock.schemaName}`);
    }

    /**
     * Creates lock table with delete trigger, which notifies on record removal
     *
     * @return {Promise<void>}
     */
    private async createLock(): Promise<void> {
        await this.pgClient.query(`
            CREATE TABLE ${PgIpLock.schemaName}.lock (
                channel CHARACTER VARYING NOT NULL PRIMARY KEY,
                app CHARACTER VARYING NOT NULL)
        `);
        // noinspection SqlResolve
        await this.pgClient.query(`
            CREATE FUNCTION ${PgIpLock.schemaName}.notify_lock()
            RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
            BEGIN PERFORM PG_NOTIFY(OLD.channel, '1'); RETURN OLD; END; $$
        `);
        // noinspection SqlResolve
        await this.pgClient.query(`
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
    private async createDeadlockCheck() {
        await this.pgClient.query(`
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

export const RX_LOCK_CHANNEL: RegExp = new RegExp(`^__${PgIpLock.name}__:`);

let timer: any;
/**
 * Performs graceful shutdown of running process
 * releasing all instantiated locks
 */
async function terminate() {
    let code: number = 0;

    timer && clearTimeout(timer);
    timer = setTimeout(() => process.exit(code), SHUTDOWN_TIMEOUT);

    // istanbul ignore if
    if (!PgIpLock.hasInstances()) {
        return ;
    }

    try { await PgIpLock.destroy(); } catch (err) {
        code = 1;

        // istanbul ignore next
        (PgIpLock.hasInstances()
            ? (PgIpLock as any).instances[0].logger
            : console
        ).error(err);
    }
}

process.on('SIGTERM', terminate);
process.on('SIGINT',  terminate);
process.on('SIGABRT', terminate);
