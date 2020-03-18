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
import { EventEmitter } from 'events';
import { Client, Notification } from 'pg';
import { ident, literal } from 'pg-format';
import { v4 as uuid } from 'uuid';
import {
    AnyJson,
    AnyLock,
    AnyLogger,
    close,
    connect,
    DefaultOptions,
    end,
    error,
    listen,
    message,
    NoLock,
    notify,
    pack,
    PgClient,
    PgIpLock,
    PgPubSubOptions,
    reconnect,
    RX_LOCK_CHANNEL,
    unlisten,
    unpack,
} from '.';
import { PgChannelEmitter } from './PgChannelEmitter';

// PgPubSub Events
export declare interface PgPubSub {
    /**
     * Sets `'end'` event handler
     *
     * @param {'end'} event
     * @param {typeof end} listener
     * @return {PgPubSub}
     */
    on(event: 'end', listener: typeof end): this;

    /**
     * Sets `'connect'` event handler
     *
     * @param {'connect'} event
     * @param {typeof connect} listener
     * @return {PgPubSub}
     */
    on(event: 'connect', listener: typeof connect): this;

    /**
     * Sets `'close'` event handler
     *
     * @param {'close'} event
     * @param {typeof close} listener
     * @return {PgPubSub}
     */
    on(event: 'close', listener: typeof close): this;

    /**
     * Sets `'listen'` event handler
     *
     * @param {'listen'} event
     * @param {typeof listen} listener
     * @return {PgPubSub}
     */
    on(event: 'listen', listener: typeof listen): this;

    /**
     * Sets `'unlisten'` event handler
     *
     * @param {'unlisten'} event
     * @param {typeof unlisten} listener
     * @return {PgPubSub}
     */
    on(event: 'unlisten', listener: typeof unlisten): this;

    /**
     * Sets `'error'` event handler
     *
     * @param {'error'} event
     * @param {typeof error} listener
     * @return {PgPubSub}
     */
    on(event: 'error', listener: typeof error): this;

    /**
     * Sets `'reconnect'` event handler
     *
     * @param {'reconnect'} event
     * @param {typeof reconnect} listener
     * @return {PgPubSub}
     */
    on(event: 'reconnect', listener: typeof reconnect): this;

    /**
     * Sets `'message'` event handler
     *
     * @param {'message'} event
     * @param {typeof message} listener
     * @return {PgPubSub}
     */
    on(event: 'message', listener: typeof message): this;

    /**
     * Sets `'notify'` event handler
     *
     * @param {'notify'} event
     * @param {typeof notify} listener
     * @return {PgPubSub}
     */
    on(event: 'notify', listener: typeof notify): this;

    /**
     * Sets any unknown or user-defined event handler
     *
     * @param {string | symbol} event - event name
     * @param {(...args: any[]) => void} listener - event handler
     */
    on(event: string | symbol, listener: (...args: any[]) => void): this;

    /**
     * Sets `'end'` event handler, which fired only one single time
     *
     * @param {'end'} event
     * @param {typeof end} listener
     * @return {PgPubSub}
     */
    once(event: 'end', listener: typeof end): this;

    /**
     * Sets `'connect'` event handler, which fired only one single time
     *
     * @param {'connect'} event
     * @param {typeof connect} listener
     * @return {PgPubSub}
     */
    once(event: 'connect', listener: typeof connect): this;

    /**
     * Sets `'close'` event handler, which fired only one single time
     *
     * @param {'close'} event
     * @param {typeof close} listener
     * @return {PgPubSub}
     */
    once(event: 'close', listener: typeof close): this;

    /**
     * Sets `'listen'` event handler, which fired only one single time
     *
     * @param {'listen'} event
     * @param {typeof listen} listener
     * @return {PgPubSub}
     */
    once(event: 'listen', listener: typeof listen): this;

    /**
     * Sets `'unlisten'` event handler, which fired only one single time
     *
     * @param {'unlisten'} event
     * @param {typeof unlisten} listener
     * @return {PgPubSub}
     */
    once(event: 'unlisten', listener: typeof unlisten): this;

    /**
     * Sets `'error'` event handler, which fired only one single time
     *
     * @param {'error'} event
     * @param {typeof error} listener
     * @return {PgPubSub}
     */
    once(event: 'error', listener: typeof error): this;

    /**
     * Sets `'reconnect'` event handler, which fired only one single time
     *
     * @param {'reconnect'} event
     * @param {typeof reconnect} listener
     * @return {PgPubSub}
     */
    once(event: 'reconnect', listener: typeof reconnect): this;

    /**
     * Sets `'message'` event handler, which fired only one single time
     *
     * @param {'message'} event
     * @param {typeof message} listener
     * @return {PgPubSub}
     */
    once(event: 'message', listener: typeof message): this;

    /**
     * Sets `'notify'` event handler, which fired only one single time
     *
     * @param {'notify'} event
     * @param {typeof notify} listener
     * @return {PgPubSub}
     */
    once(event: 'notify', listener: typeof notify): this;

    /**
     * Sets any unknown or user-defined event handler, which would fire only
     * one single time
     *
     * @param {string | symbol} event - event name
     * @param {(...args: any[]) => void} listener - event handler
     */
    once(event: string | symbol, listener: (...args: any[]) => void): this;
}

/**
 * Implements LISTEN/NOTIFY client for PostgreSQL connections.
 *
 * It is a basic public interface of this library, so the end-user is going
 * to work with this class directly to solve his/her tasks.
 *
 * Importing:
 * ~~~typescript
 * import { AnyJson, PgPubSub } from '@imqueue/pg-pubsub';
 * ~~~
 *
 * Instantiation:
 * ~~~typescript
 * const pubSub = new PgPubSub(options)
 * ~~~
 * @see PgPubSubOptions
 *
 * Connecting and listening:
 * ~~~typescript
 * pubSub.on('connect', async () => {
 *     await pubSub.listen('ChannelOne');
 *     await pubSub.listen('ChannelTwo');
 * });
 * // or, even better:
 * pubSub.on('connect', async () => {
 *     await Promise.all(
 *         ['ChannelOne', 'ChannelTwo'].map(channel => channel.listen()),
 *     );
 * });
 * // or. less reliable:
 * await pubSub.connect();
 * await Promise.all(
 *     ['ChannelOne', 'ChannelTwo'].map(channel => channel.listen()),
 * );
 * ~~~
 *
 * Handle messages:
 * ~~~typescript
 * pubSub.on('message', (channel: string, payload: AnyJson) =>
 *     console.log(channel, payload);
 * );
 * // or, using channels
 * pubSub.channels.on('ChannelOne', (payload: AnyJson) =>
 *     console.log(1, payload),
 * );
 * pubSub.channels.on('ChannelTwo', (payload: AnyJson) =>
 *     console.log(2, payload),
 * );
 * ~~~
 *
 * Destroying:
 * ~~~typescript
 * await pubSub.destroy();
 * ~~~
 *
 * Closing and re-using connection:
 * ~~~typescript
 * await pubSub.close();
 * await pubSub.connect();
 * ~~~
 *
 * This close/connect technique may be used when doing some heavy message
 * handling, so while you close, another running copy may handle next
 * messages...
 */
export class PgPubSub extends EventEmitter {

    public readonly pgClient: PgClient;
    public readonly options: PgPubSubOptions;
    public readonly channels: PgChannelEmitter = new PgChannelEmitter();

    private locks: { [channel: string]: AnyLock } = {};
    private retry = 0;
    private processId: number;

    /**
     * @constructor
     * @param {PgPubSubOptions} options - options
     * @param {AnyLogger} logger - logger
     */
    public constructor(
        options: Partial<PgPubSubOptions>,
        public readonly logger: AnyLogger = console,
    ) {
        super();

        this.options = Object.assign({}, DefaultOptions, options);
        this.pgClient = (this.options.pgClient || new Client(this.options)) as
            PgClient;

        this.pgClient.on('end', () => this.emit('end'));
        this.pgClient.on('error', () => this.emit('error'));

        this.onNotification = this.onNotification.bind(this);
        this.reconnect = this.reconnect.bind(this);
        this.onReconnect = this.onReconnect.bind(this);

        this.pgClient.on('notification', this.onNotification);
    }

    /**
     * Establishes re-connectable database connection
     *
     * @return {Promise<void>}
     */
    public async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.setOnceHandler(['end', 'error'], this.reconnect);
            this.pgClient.once('connect', async () => {
                await this.setAppName();
                await this.setProcessId();
                this.emit('connect');
                resolve();
            });
            this.once('error', reject);

            this.pgClient.connect();
        });
    }

    /**
     * Safely closes this database connection
     *
     * @return {Promise<void>}
     */
    public async close(): Promise<void> {
        this.pgClient.off('end', this.reconnect);
        this.pgClient.off('error', this.reconnect);
        await this.pgClient.end();
        this.pgClient.removeAllListeners();
        this.emit('close');
    }

    /**
     * Starts listening given channel. If singleListener option is set to
     * true, it guarantees that only one process would be able to listen
     * this channel at a time.
     *
     * @param {string} channel - channel name to listen
     * @return {Promise<void>}
     */
    public async listen(channel: string): Promise<void> {
        const lock = await this.lock(channel);

        // istanbul ignore else
        if (await lock.acquire()) {
            await this.pgClient.query(`LISTEN ${ident(channel)}`);
            this.emit('listen', channel);
        }
    }

    /**
     * Stops listening of the given chanel, and, if singleListener option is
     * set to true - will release an acquired lock (if it was settled).
     *
     * @param {string} channel - channel name to unlisten
     * @return {Promise<void>}
     */
    public async unlisten(channel: string): Promise<void> {
        await this.pgClient.query(`UNLISTEN ${ident(channel)}`);

        if (this.locks[channel]) {
            await this.locks[channel].destroy();
            delete this.locks[channel];
        }

        this.emit('unlisten', [channel]);
    }

    /**
     * Stops listening all connected channels, and, if singleListener option
     * is set to true - will release all acquired locks (if any was settled).
     *
     * @return {Promise<void>}
     */
    public async unlistenAll(): Promise<void> {
        await this.pgClient.query('UNLISTEN *');
        await this.release();

        this.emit('unlisten', Object.keys(this.locks));
    }

    /**
     * Performs NOTIFY to a given chanel with a given payload to all
     * listening subscribers
     *
     * @param {string} channel - channel to publish to
     * @param {AnyJson} payload - payload to publish for subscribers
     * @return {Promise<void>}
     */
    public async notify(channel: string, payload: AnyJson): Promise<void> {
        await this.pgClient.query(
            `NOTIFY ${ident(channel)}, ${literal(pack(payload, this.logger))}`,
        );

        this.emit('notify', channel, payload);
    }

    /**
     * Returns list of all active subscribed channels
     *
     * @return {string[]}
     */
    public activeChannels(): string[] {
        return Object.keys(this.locks).filter(channel =>
            this.locks[channel].isAcquired(),
        );
    }

    /**
     * Returns list of all inactive channels (those which are known, but
     * not actively listening at a time)
     *
     * @return {string[]}
     */
    public inactiveChannels(): string[] {
        return Object.keys(this.locks).filter(channel =>
            !this.locks[channel].isAcquired(),
        );
    }

    /**
     * Returns list of all known channels, despite the fact they are listening
     * (active) or not (inactive).
     *
     * @return {string[]}
     */
    public allChannels(): string[] {
        return Object.keys(this.locks);
    }

    /**
     * If channel argument passed will return true if channel is in active
     * state (listening by this pub/sub), false - otherwise. If channel is
     * not specified - will return true if there is at least one active channel
     * listened by this pub/sub, false - otherwise.
     *
     * @param {string} channel
     * @return {boolean}
     */
    public isActive(channel?: string): boolean {
        if (!channel) {
            return this.activeChannels().length > 0;
        }

        return !!~this.activeChannels().indexOf(channel);
    }

    /**
     * Destroys this object properly, destroying all locks,
     * closing all connections and removing all event listeners to avoid
     * memory leaking. So whenever you need to destroy an object
     * programmatically - use this method.
     * Note, that after destroy it is broken and should be removed from memory.
     *
     * @return {Promise<void>}
     */
    public async destroy(): Promise<void> {
        await Promise.all([this.close(), PgIpLock.destroy()]);
        this.channels.removeAllListeners();
        this.removeAllListeners();
    }

    /**
     * Safely sets given handler for given pg client events, making sure
     * we won't flood events with non-fired same stack of handlers
     *
     * @access private
     * @param {string[]} events - list of events to set handler for
     * @param {(...args: any[]) => any} handler - handler reference
     * @return {PgPubSub}
     */
    private setOnceHandler(
        events: string[],
        handler: (...args: any[]) => any,
    ): PgPubSub {
        for (const event of events) {
            // make sure we won't flood events with given handler,
            // so do a cleanup first
            this.clearListeners(event, handler);
            // now set event handler
            this.pgClient.once(event, handler);
        }

        return this;
    }

    /**
     * Clears all similar handlers under given event
     *
     * @param {string} event - event name
     * @param {(...args: any) => any} handler - handler reference
     */
    private clearListeners(
        event: string,
        handler: (...args: any[]) => any,
    ): void {
        this.pgClient.listeners(event).forEach(listener =>
            listener === handler && this.pgClient.off(event, handler),
        );
    }

    /**
     * Database notification event handler
     *
     * @access private
     * @param {Notification} notification - database message data
     * @return {Promise<void>}
     */
    private async onNotification(notification: Notification): Promise<void> {
        const lock = await this.lock(notification.channel);
        const skip = RX_LOCK_CHANNEL.test(notification.channel) || (
            this.options.filtered && this.processId === notification.processId
        );

        if (skip) {
            // as we use the same connection with locks mechanism
            // we should avoid pub/sub client to parse lock channels data
            // and also filter same-notify-channel messages if filtered option
            // is set to true
            return ;
        }

        if (this.options.singleListener && !lock.isAcquired()) {
            return; // we are not really a listener
        }

        const payload = unpack(notification.payload);

        this.emit('message', notification.channel, payload);
        this.channels.emit(notification.channel, payload);
    }

    /**
     * On reconnect event emitter
     *
     * @access private
     * @return {Promise<void>}
     */
    private async onReconnect(): Promise<void> {
        await Promise.all(Object.keys(this.locks).map(channel =>
            this.listen(channel),
        ));

        this.emit('reconnect', this.retry);
        this.retry = 0;
    }

    /**
     * Reconnect routine, used for implementation of auto-reconnecting db
     * connection
     *
     * @access private
     * @return {number}
     */
    private reconnect(): number {
        return setTimeout(async () => {
            if (this.options.retryLimit <= ++this.retry) {
                this.emit('error', new Error(
                    `Connect failed after ${this.retry} retries...`,
                ));

                return await this.close();
            }

            this.setOnceHandler(['connect'], this.onReconnect);

            try { await this.connect(); } catch (err) { /**/ }
        },

        this.options.retryDelay) as any as number;
    }

    /**
     * Instantiates and returns process lock for a given channel or returns
     * existing one
     *
     * @access private
     * @param {string} channel
     * @return {Promise<PgIpLock>}
     */
    private async lock(channel: string): Promise<AnyLock> {
        if (!this.locks[channel]) {
            this.locks[channel] = await this.createLock(channel);
        }

        return this.locks[channel];
    }

    /**
     * Instantiates new lock, properly initializes it and returns
     *
     * @param {string} channel
     * @return {Promise<AnyLock>}
     */
    private async createLock(channel: string): Promise<AnyLock> {
        if (this.options.singleListener) {
            const lock = new PgIpLock(channel, {
                pgClient: this.pgClient,
                logger: this.logger,
                acquireInterval: this.options.acquireInterval,
            });

            await lock.init();
            lock.onRelease(chan => this.listen(chan));

            return lock;
        }

        return new NoLock();
    }

    /**
     * Releases all acquired locks in current session
     *
     * @access private
     * @return {Promise<void>}
     */
    private async release(): Promise<void> {
        await Promise.all(Object.keys(this.locks).map(async channel => {
            const lock = await this.lock(channel);

            if (lock.isAcquired()) {
                await lock.release();
            }

            delete this.locks[channel];
        }));
    }

    /**
     * Sets application_name for this connection as unique identifier
     *
     * @access private
     * @return {Promise<void>}
     */
    private async setAppName(): Promise<void> {
        try {
            this.pgClient.appName = uuid();
            await this.pgClient.query(
                `SET APPLICATION_NAME TO '${this.pgClient.appName}'`,
            );
        } catch (err) { /* ignore */ }
    }

    /**
     * Retrieves process identifier from the database connection and sets it to
     * `this.processId`.
     *
     * @return {Promise<void>}
     */
    private async setProcessId(): Promise<void> {
        try {
            const { rows: [{ pid }] } = await this.pgClient.query(`
                SELECT pid FROM pg_stat_activity
                WHERE application_name = ${literal(this.pgClient.appName)}
            `);
            this.processId = +pid;
        } catch (err) { /* ignore */ }
    }
}
