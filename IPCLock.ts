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
import { ident, literal } from 'pg-format';
import { Notification, Client } from 'pg';

/**
 * Class IPCLock - implements manageable inter-process locking mechanism over
 * existing PostgreSQL connection for a given LISTEN channel
 */
export class IPCLock {

    private acquired: boolean = false;
    private notifyHandler: (message: Notification) => void;

    /**
     * @constructor
     * @param {string} channel - source channel name to manage locking on
     * @param {Client} pgClient - PostgreSQL client
     */
    public constructor(
        public readonly channel: string,
        public readonly pgClient: Client,
    ) {
        this.channel = `${IPCLock.name}_${channel}`;

        const terminate = async () => {
            try {
                await this.release();
                process.exit(0);
            } catch (err) {
                console.error(err);
                process.exit(1)
            }
        };

        process.on('SIGTERM', terminate);
        process.on('SIGINT', terminate);
        process.on('SIGABRT', terminate);
    }

    /**
     * Initializes IPC locks storage
     *
     * @return {Promise<void>}
     */
    public async init(): Promise<void> {
        await this.pgClient.query(`
            CREATE SCHEMA IF NOT EXISTS pgu_listen
        `);
        await this.pgClient.query(`
            CREATE TABLE IF NOT EXISTS pgu_listen.lock (
                channel CHARACTER VARYING NOT NULL PRIMARY KEY
            )
        `);
        try {
            await this.pgClient.query(`
                CREATE FUNCTION pgu_listen.notify_lock()
                RETURNS TRIGGER
                LANGUAGE PLPGSQL AS $$
                BEGIN
                    PERFORM PG_NOTIFY(OLD.channel, '1');
                    RETURN OLD;
                END;
                $$
            `);
        } catch (e) { /* ignore - function exists */ }
        try {
            await this.pgClient.query(`
                CREATE CONSTRAINT TRIGGER notify_release_lock_trigger
                AFTER DELETE ON pgu_listen.lock
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE PROCEDURE pgu_listen.notify_lock()
            `);
        } catch (e) { /* ignore - trigger exists */ }

        await this.pgClient.query(`LISTEN ${ident(this.channel)}`);
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
            if (message.channel === this.channel) {
                handler(this.channel.replace(RX_CLEAN_CHANNEL, ''));
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
            await this.pgClient.query(`
                INSERT INTO pgu_listen.lock
                VALUES (${literal(this.channel)})
            `);
            this.acquired = true;
        } catch (e) {
            // will throw, because insert duplicates existing lock
            this.acquired = false;
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

        try {
            await this.pgClient.query(`
                DELETE FROM pgu_listen.lock
                WHERE channel=${literal(this.channel)}
            `);
            this.acquired = false;
        } catch (e) {
            // istanbul ignore next
            console.error(`Error releasing lock for ${this.channel}`);
        }
    }

    /**
     * Returns current lock state
     *
     * @return {boolean}
     */
    public isAcquired(): boolean {
        return this.acquired;
    }
}

const RX_CLEAN_CHANNEL: RegExp = new RegExp(`^${IPCLock.name}_`);
