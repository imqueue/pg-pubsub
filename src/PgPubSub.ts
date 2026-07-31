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
import { EventEmitter } from 'node:events';
import { Client, type Notification } from 'pg';
import { ident, literal } from 'pg-format';
import { randomUUID as uuid } from 'node:crypto';
import {
    type AnyJson,
    type AnyLock,
    type AnyLogger,
    type close,
    type connect,
    DefaultOptions,
    type end,
    type error,
    type listen,
    type message,
    NoLock,
    type notify,
    pack,
    enableGracefulShutdown,
    type PgClient,
    PgIpLock,
    type PgPubSubOptions,
    type reconnect,
    RX_LOCK_CHANNEL,
    signature,
    type unlisten,
    unpack,
} from './index.js';
import { PgChannelEmitter } from './PgChannelEmitter.js';

// PgPubSub Events
// oxlint-disable-next-line no-unsafe-declaration-merging
export declare interface PgPubSub {
    /**
     * Sets `'end'` event handler
     *
     * @param event - `'end'` — the underlying connection has ended and will not reconnect
     * @param listener - handler invoked when the underlying connection has ended and will not reconnect.
     */
    on(event: 'end', listener: typeof end): this;

    /**
     * Sets `'connect'` event handler
     *
     * @param event - `'connect'` — a PostgreSQL connection has been established
     * @param listener - handler invoked when a PostgreSQL connection has been established.
     */
    on(event: 'connect', listener: typeof connect): this;

    /**
     * Sets `'close'` event handler
     *
     * @param event - `'close'` — the connection was closed by close(), leaving it re-usable
     * @param listener - handler invoked when the connection was closed by close(), leaving it re-usable.
     */
    on(event: 'close', listener: typeof close): this;

    /**
     * Sets `'listen'` event handler
     *
     * @param event - `'listen'` — this process began listening one or more channels
     * @param listener - handler invoked when this process began listening one or more channels.
     */
    on(event: 'listen', listener: typeof listen): this;

    /**
     * Sets `'unlisten'` event handler
     *
     * @param event - `'unlisten'` — this process stopped listening one or more channels
     * @param listener - handler invoked when this process stopped listening one or more channels.
     */
    on(event: 'unlisten', listener: typeof unlisten): this;

    /**
     * Sets `'error'` event handler
     *
     * @param event - `'error'` — an error occurred, including exhausting the reconnect limit
     * @param listener - handler invoked when an error occurred, including exhausting the reconnect limit.
     */
    on(event: 'error', listener: typeof error): this;

    /**
     * Sets `'reconnect'` event handler
     *
     * @param event - `'reconnect'` — a reconnect attempt was made, with the attempt number
     * @param listener - handler invoked when a reconnect attempt was made, with the attempt number.
     */
    on(event: 'reconnect', listener: typeof reconnect): this;

    /**
     * Sets `'message'` event handler
     *
     * @param event - `'message'` — a notification arrived on any listened channel
     * @param listener - handler invoked when a notification arrived on any listened channel.
     */
    on(event: 'message', listener: typeof message): this;

    /**
     * Sets `'notify'` event handler
     *
     * @param event - `'notify'` — this instance published a notification
     * @param listener - handler invoked when this instance published a notification.
     */
    on(event: 'notify', listener: typeof notify): this;

    /**
     * Sets any unknown or user-defined event handler
     *
     * @param event - event name
     * @param listener - event handler
     */
    on(event: string | symbol, listener: (...args: any[]) => void): this;

    /**
     * Sets `'end'` event handler, which fired only one single time
     *
     * @param event - `'end'` — the underlying connection has ended and will not reconnect
     * @param listener - handler invoked when the underlying connection has ended and will not reconnect. Fires at most once.
     */
    once(event: 'end', listener: typeof end): this;

    /**
     * Sets `'connect'` event handler, which fired only one single time
     *
     * @param event - `'connect'` — a PostgreSQL connection has been established
     * @param listener - handler invoked when a PostgreSQL connection has been established. Fires at most once.
     */
    once(event: 'connect', listener: typeof connect): this;

    /**
     * Sets `'close'` event handler, which fired only one single time
     *
     * @param event - `'close'` — the connection was closed by close(), leaving it re-usable
     * @param listener - handler invoked when the connection was closed by close(), leaving it re-usable. Fires at most once.
     */
    once(event: 'close', listener: typeof close): this;

    /**
     * Sets `'listen'` event handler, which fired only one single time
     *
     * @param event - `'listen'` — this process began listening one or more channels
     * @param listener - handler invoked when this process began listening one or more channels. Fires at most once.
     */
    once(event: 'listen', listener: typeof listen): this;

    /**
     * Sets `'unlisten'` event handler, which fired only one single time
     *
     * @param event - `'unlisten'` — this process stopped listening one or more channels
     * @param listener - handler invoked when this process stopped listening one or more channels. Fires at most once.
     */
    once(event: 'unlisten', listener: typeof unlisten): this;

    /**
     * Sets `'error'` event handler, which fired only one single time
     *
     * @param event - `'error'` — an error occurred, including exhausting the reconnect limit
     * @param listener - handler invoked when an error occurred, including exhausting the reconnect limit. Fires at most once.
     */
    once(event: 'error', listener: typeof error): this;

    /**
     * Sets `'reconnect'` event handler, which fired only one single time
     *
     * @param event - `'reconnect'` — a reconnect attempt was made, with the attempt number
     * @param listener - handler invoked when a reconnect attempt was made, with the attempt number. Fires at most once.
     */
    once(event: 'reconnect', listener: typeof reconnect): this;

    /**
     * Sets `'message'` event handler, which fired only one single time
     *
     * @param event - `'message'` — a notification arrived on any listened channel
     * @param listener - handler invoked when a notification arrived on any listened channel. Fires at most once.
     */
    once(event: 'message', listener: typeof message): this;

    /**
     * Sets `'notify'` event handler, which fired only one single time
     *
     * @param event - `'notify'` — this instance published a notification
     * @param listener - handler invoked when this instance published a notification. Fires at most once.
     */
    once(event: 'notify', listener: typeof notify): this;

    /**
     * Sets any unknown or user-defined event handler, which would fire only
     * one single time
     *
     * @param event - event name
     * @param listener - event handler
     */
    once(event: string | symbol, listener: (...args: any[]) => void): this;
}

/**
 * Maximum byte length of a NOTIFY payload postgres accepts (with default
 * server configuration)
 */
const MAX_PAYLOAD_LENGTH = 8000;

/**
 * Implements LISTEN/NOTIFY client for PostgreSQL connections.
 *
 * It is a basic public interface of this library, so the end-user is going
 * to work with this class directly to solve his/her tasks. Construct it with
 * {@link PgPubSubOptions}, subscribe channels once connected, then read messages
 * from either the instance's own `'message'` event or the per-channel emitter on
 * {@link (PgPubSub:class).channels}.
 *
 * @remarks
 * Subscribe from inside the `'connect'` handler rather than after awaiting
 * `connect()`. The connection reconnects automatically, and only the handler runs
 * again on each reconnect — subscriptions made once, after the first connect,
 * are not restored.
 *
 * `close()` and `connect()` are a matched pair for temporarily stepping out of
 * message handling: closing releases the channel locks, so another running copy
 * takes over the channels while this one is busy, and connecting again competes
 * for them. Use it when a process needs to do heavy work without holding up its
 * channels. To shut down for good use {@link (PgPubSub:class).destroy} instead,
 * which also removes the listeners and cannot be reconnected.
 *
 * @example
 * Connect, subscribe two channels and handle their messages:
 * ```typescript
 * import { type AnyJson, PgPubSub } from '@imqueue/pg-pubsub';
 *
 * const pubSub = new PgPubSub({ connectionString: process.env.DB_URL });
 *
 * // subscribe inside 'connect' so the channels are restored on every reconnect
 * pubSub.on('connect', async () => {
 *     await Promise.all(
 *         ['ChannelOne', 'ChannelTwo'].map(channel => pubSub.listen(channel)),
 *     );
 * });
 *
 * // one handler for every channel...
 * pubSub.on('message', (channel: string, payload: AnyJson) =>
 *     console.log(channel, payload),
 * );
 *
 * // ...or one per channel
 * pubSub.channels.on('ChannelOne', (payload: AnyJson) => console.log(1, payload));
 * pubSub.channels.on('ChannelTwo', (payload: AnyJson) => console.log(2, payload));
 *
 * await pubSub.connect();
 * ```
 *
 * @example
 * Step out of handling and come back, letting another copy take the channels:
 * ```typescript
 * await pubSub.close();
 * // ... heavy work here; another running copy handles the channels meanwhile
 * await pubSub.connect();
 * ```
 *
 * @see {@link PgPubSubOptions} for every option and its default
 */
export class PgPubSub extends EventEmitter {
    /**
     * Options this instance was constructed with, merged over the defaults in
     * `DefaultOptions`.
     */
    public readonly options: PgPubSubOptions;

    /**
     * Per-channel event emitter. Listening here scopes a handler to one channel,
     * where the instance's own `'message'` event fires for every channel — which
     * is usually what you want when a process listens to several.
     */
    public readonly channels: PgChannelEmitter = new PgChannelEmitter();

    private client: PgClient;
    private locks: { [channel: string]: AnyLock } = {};
    private reListenChannels?: string[];
    private reconnectTimer?: NodeJS.Timeout;
    private destroyed = false;
    private retry = 0;
    private processId?: number;

    /**
     * Underlying postgres client. The instance may be replaced during
     * automatic reconnect (pg clients are single-use), so do not cache
     * this reference across reconnects.
     *
     */
    public get pgClient(): PgClient {
        return this.client;
    }

    /**
     * @param options - options
     * @param logger - logger
     */
    public constructor(
        options: Partial<PgPubSubOptions>,
        /**
         * Where connection, listen and lock lifecycle events are reported.
         * Defaults to the console.
         */
        public readonly logger: AnyLogger = console,
    ) {
        super();

        this.options = { ...DefaultOptions, ...options };

        this.onNotification = this.options.executionLock
            ? this.onNotificationLockExec.bind(this)
            : this.onNotification.bind(this);
        this.reconnect = this.reconnect.bind(this);
        this.onReconnect = this.onReconnect.bind(this);

        this.client = (this.options.pgClient ||
            new Client(this.options)) as PgClient;
        this.attachClientHandlers();

        if (this.options.handleSignals) {
            enableGracefulShutdown();
        }
    }

    /**
     * Wires base handlers to the current underlying pg client
     *
     */
    private attachClientHandlers(): void {
        this.client.on('end', () => this.emit('end'));
        this.client.on('error', (err: Error) => this.emitError(err));
        this.client.on('notification', this.onNotification);
    }

    /**
     * Emits 'error' if anyone listens, otherwise logs it: an unhandled
     * 'error' event would crash the process, and connection errors always
     * deserve a trace
     *
     * @param err - error to propagate
     */
    private emitError(err: Error): void {
        if (this.listenerCount('error') > 0) {
            this.emit('error', err);
        } else {
            this.logger.error(err);
        }
    }

    /**
     * Establishes re-connectable database connection
     *
     */
    public async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const onConnect = async () => {
                await this.setAppName();
                await this.setProcessId();
                this.emit('connect');
                resolve();
                cleanup();
            };

            const onError = (err: any) => {
                reject(err);
                cleanup();
            };

            const cleanup = () => {
                this.pgClient.off('connect', onConnect);
                this.off('error', onError);
            };

            this.setOnceHandler(['end', 'error'], this.reconnect);
            this.pgClient.once('connect', onConnect);
            this.once('error', onError);

            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.pgClient.connect();
        });
    }

    /**
     * Safely closes this database connection
     *
     */
    public async close(): Promise<void> {
        if (this.reconnectTimer) {
            // a pending reconnect would re-create the client and
            // re-subscribe channels after this instance is closed
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }

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
     * @param channel - channel name to listen
     */
    public async listen(channel: string): Promise<void> {
        if (this.options.executionLock) {
            await this.subscribe(channel);
            return;
        }

        const lock = await this.lock(channel);
        const acquired = await lock.acquire();

        if (acquired) {
            await this.subscribe(channel);

            return;
        }

        // not an error under singleListener - another process owns this
        // channel. No log here on purpose: listen() is retried (timer,
        // onRelease, reconnect) and would spam. PgIpLock.acquire() reports
        // the same fact once per state change, and PgCache summarises the
        // resulting coverage as `listening N/M channels`.
    }

    /**
     * Stops listening of the given channel, and, if singleListener option is
     * set to true - will release an acquired lock (if it was settled).
     *
     * @param channel - channel name to unlisten
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
     */
    public async unlistenAll(): Promise<void> {
        await this.pgClient.query('UNLISTEN *');
        await this.release();

        this.emit('unlisten', Object.keys(this.locks));
    }

    /**
     * Performs NOTIFY to a given channel with a given payload to all
     * listening subscribers
     *
     * @param channel - channel to publish to
     * @param payload - payload to publish for subscribers
     */
    public async notify(channel: string, payload: AnyJson): Promise<void> {
        const packed = pack(payload, this.logger);

        if (Buffer.byteLength(packed, 'utf8') > MAX_PAYLOAD_LENGTH) {
            throw new RangeError(
                `NOTIFY payload for channel '${channel}' exceeds the ` +
                    `postgres limit of ${MAX_PAYLOAD_LENGTH} bytes`,
            );
        }

        await this.pgClient.query(
            `NOTIFY ${ident(channel)}, ${literal(packed)}`,
        );

        this.emit('notify', channel, payload);
    }

    /**
     * Returns list of all active subscribed channels
     *
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
     */
    public inactiveChannels(): string[] {
        return Object.keys(this.locks).filter(
            channel => !this.locks[channel].isAcquired(),
        );
    }

    /**
     * Returns list of all known channels, despite the fact they are listening
     * (active) or not (inactive).
     *
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
     * @param channel - channel to test; omit to test the connection as a whole
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
     */
    public async destroy(): Promise<void> {
        this.destroyed = true;

        // destroy only locks owned by this instance: a process may run
        // several PgPubSub instances and a static sweep would kill locks
        // belonging to the others
        await Promise.all(
            Object.keys(this.locks).map(channel =>
                this.locks[channel].destroy(),
            ),
        );
        this.locks = {};

        await this.close();
        this.channels.removeAllListeners();
        this.removeAllListeners();
    }

    /**
     * Safely sets given handler for given pg client events, making sure
     * we won't flood events with non-fired same stack of handlers
     *
     * @param events - list of events to set handler for
     * @param handler - handler reference
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
     * @param event - event name
     * @param handler - handler reference
     */
    private clearListeners(
        event: string,
        handler: (...args: any[]) => any,
    ): void {
        this.pgClient
            .listeners(event)
            .forEach(
                listener =>
                    listener === handler && this.pgClient.off(event, handler),
            );
    }

    /**
     * Database notification event handler
     *
     * @param notification - database message data
     */
    private async onNotification(notification: Notification): Promise<void> {
        const skip =
            this.destroyed ||
            RX_LOCK_CHANNEL.test(notification.channel) ||
            (this.options.filtered &&
                this.processId === notification.processId);

        if (skip) {
            // as we use the same connection with locks mechanism
            // we should avoid pub/sub client to parse lock channels data
            // and also filter same-notify-channel messages if filtered option
            // is set to true
            return;
        }

        const lock = await this.lock(notification.channel);

        if (this.options.singleListener && !lock.isAcquired()) {
            return; // we are not really a listener
        }

        const payload = unpack(notification.payload);

        this.emit('message', notification.channel, payload);
        this.channels.emit(notification.channel, payload);
    }

    /**
     * Database notification event handler for execution lock
     *
     * @param notification - database message data
     */
    private async onNotificationLockExec(
        notification: Notification,
    ): Promise<void> {
        const skip =
            this.destroyed ||
            RX_LOCK_CHANNEL.test(notification.channel) ||
            (this.options.filtered &&
                this.processId === notification.processId);

        if (skip) {
            // as we use the same connection with locks mechanism
            // we should avoid pub/sub client to parse lock channels data
            // and also filter same-notify-channel messages if filtered option
            // is set to true
            return;
        }

        let lock: AnyLock;

        try {
            lock = await this.createLock(
                notification.channel,
                signature(
                    notification.processId,
                    notification.channel,
                    notification.payload,
                ),
            );
        } catch (err) {
            // lock bootstrap failed (e.g. missing ddl privileges); it is
            // already logged loudly - skip this message rather than raise
            // an unhandled rejection from the notification handler
            this.emitError(err as Error);

            return;
        }

        try {
            await lock.acquire();

            if (this.options.singleListener && !lock.isAcquired()) {
                return; // we are not really a listener
            }

            const payload = unpack(notification.payload);

            this.emit('message', notification.channel, payload);
            this.channels.emit(notification.channel, payload);
        } finally {
            // free local resources only: the lock record must stay in the
            // database as a processed-message marker, otherwise a slower
            // competing listener would re-insert it and process the same
            // message again. Stale markers are cleaned up by TTL on
            // subsequent unique lock acquisitions.
            lock.dispose();
        }
    }

    /**
     * On reconnect event emitter
     *
     */
    private async onReconnect(): Promise<void> {
        const channels = this.reListenChannels ?? Object.keys(this.locks);

        this.reListenChannels = undefined;

        this.logger.info(
            `PgPubSub: reconnected after ${this.retry} retry(-ies), ` +
                `re-subscribing ${channels.length} channel(s)`,
        );

        await Promise.all(channels.map(channel => this.listen(channel)));

        this.emit('reconnect', this.retry);
        this.retry = 0;
    }

    /**
     * Reconnect routine, used for implementation of auto-reconnecting db
     * connection
     *
     */
    private reconnect(): number {
        if (this.reconnectTimer) {
            // a single connection loss fires both 'error' and 'end':
            // arming two competing reconnects would race two client
            // recreations against each other
            return this.reconnectTimer as any as number;
        }

        this.reconnectTimer = setTimeout(
            async () => {
                this.reconnectTimer = undefined;

                if (this.options.retryLimit <= ++this.retry) {
                    this.emitError(
                        new Error(
                            `Connect failed after ${this.retry} retries...`,
                        ),
                    );

                    return this.close();
                }

                this.recreateClient();
                this.setOnceHandler(['connect'], this.onReconnect);

                try {
                    await this.connect();
                } catch {
                    /* ignore */
                }
            },

            this.options.retryDelay,
        );

        return this.reconnectTimer as any as number;
    }

    /**
     * Replaces the underlying pg client with a fresh one: pg clients are
     * single-use and cannot re-connect after end() or a fatal error. All
     * locks bound to the dead client are disposed locally (no database
     * communication is possible through it anyway); channels stay in the
     * locks registry keys through onReconnect() re-listen.
     *
     */
    private recreateClient(): void {
        const channels = Object.keys(this.locks);

        for (const channel of channels) {
            this.locks[channel].dispose();
            delete this.locks[channel];
        }

        this.client.removeAllListeners();
        this.client = new Client(this.options) as PgClient;
        this.attachClientHandlers();

        // preserve known channels, so onReconnect() re-creates their locks
        // against the new client
        this.reListenChannels = channels;
    }

    /**
     * Issues the actual `LISTEN` on a channel this process is already
     * entitled to listen, and announces it.
     *
     * Kept apart from listen() because a late lock takeover must not run
     * listen() again: re-acquiring a lock we already hold fails the deadlock
     * check (it sees our own live connection as the current holder) and would
     * skip the subscription it was meant to complete.
     *
     * @param channel - channel this applies to
     */
    private async subscribe(channel: string): Promise<void> {
        await this.pgClient.query(`LISTEN ${ident(channel)}`);
        this.emit('listen', channel);
    }

    /**
     * Instantiates and returns process lock for a given channel or returns
     * existing one
     *
     * @param channel - channel this applies to
     */
    private async lock(channel: string): Promise<AnyLock> {
        if (!this.locks[channel]) {
            const lock = await this.createLock(channel);

            if (this.destroyed) {
                // destroy() raced this creation: free local resources and
                // do not register the lock, nobody would clean it up
                lock.dispose();

                return lock;
            }

            this.locks[channel] = lock;
        }

        return this.locks[channel];
    }

    /**
     * Instantiates new lock, properly initializes it and returns
     *
     * @param channel -
     * @param uniqueKey -
     */
    private async createLock(
        channel: string,
        uniqueKey?: string,
    ): Promise<AnyLock> {
        if (this.options.singleListener) {
            const lock = new PgIpLock(
                channel,
                {
                    pgClient: this.pgClient,
                    logger: this.logger,
                    acquireInterval: this.options.acquireInterval,
                },
                uniqueKey,
            );

            await lock.init();

            if (!uniqueKey) {
                lock.onRelease(chan => this.listen(chan));
                lock.onAcquire(chan =>
                    this.subscribe(chan).catch(err => this.logger.error(err)),
                );
            }

            return lock;
        }

        return new NoLock();
    }

    /**
     * Releases all acquired locks in current session
     *
     */
    private async release(): Promise<void> {
        await Promise.all(
            Object.keys(this.locks).map(async channel => {
                const lock = await this.lock(channel);

                if (lock.isAcquired()) {
                    await lock.release();
                }

                // the lock leaves the registry, so its local resources
                // (acquire timer, notification listener) must be freed -
                // otherwise they would keep the process alive forever
                lock.dispose();
                delete this.locks[channel];
            }),
        );
    }

    /**
     * Sets application_name for this connection as unique identifier
     *
     */
    private async setAppName(): Promise<void> {
        try {
            this.pgClient.appName = uuid();
            await this.pgClient.query(
                `SET APPLICATION_NAME TO '${this.pgClient.appName}'`,
            );
        } catch {
            /* ignore */
        }
    }

    /**
     * Retrieves process identifier from the database connection and sets it to
     * `this.processId`.
     *
     */
    private async setProcessId(): Promise<void> {
        try {
            const {
                rows: [{ pid }],
            } = await this.pgClient.query(`
                SELECT pid FROM pg_stat_activity
                WHERE application_name = ${literal(this.pgClient.appName)}
            `);
            this.processId = +pid;
        } catch {
            /* ignore */
        }
    }
}
