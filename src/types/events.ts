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
import { AnyJson } from '../types';

/**
 * Channel listener event, occurs whenever the listening channel gets a new
 * payload message.
 *
 * @asMemberOf PgChannelEmitter
 * @event channel
 * @param {AnyJson} payload - event payload
 */
export declare function channel(payload: AnyJson): void;

/**
 * `'end'` event, occurs whenever pg connection ends, so, literally it's simply
 * proxy to `'end'` event from `pg.Client`
 *
 * @asMemberOf PgPubSub
 * @event end
 */
export declare function end(): void;

/**
 * `'connect'` event, occurs each time database connection is established.
 *
 * @asMemberOf PgPubSub
 * @event connect
 */
export declare function connect(): void;

/**
 * `'close'` event, occurs each time connection closed. Differs from `'end'`
 * event, because `'end'` event may occur many times during re-connectable
 * connection process, but `'close'` event states that connection was
 * safely programmatically closed and further re-connections won't happen.
 *
 * @asMemberOf PgPubSub
 * @event close
 */
export declare function close(): void;

/**
 * `'listen'` event occurs each time channel starts being listening
 *
 * @asMemberOf PgPubSub
 * @event listen
 * @param {string[]} channels - list of channels being started listening
 */
export declare function listen(channels: string[]): void;

/**
 * `'unlisten'` event occurs each time channel ends being listening
 *
 * @asMemberOf PgPubSub
 * @event unlisten
 * @param {string[]} channels - list of channels being stopped listening
 */
export declare function unlisten(channels: string[]): void;

/**
 * `'error'` event occurs each time connection error is happened
 *
 * @asMemberOf PgPubSub
 * @event error
 * @param {Error} err - error occurred during connection
 */
export declare function error(err: Error): void;

/**
 * `'reconnect'` event occurs each time, when the connection is successfully
 * established after connection retry. It is followed by a corresponding
 * `'connect'` event, but after all possible channel locks finished their
 * attempts to be re-acquired.
 *
 * @asMemberOf PgPubSub
 * @event reconnect
 * @param {number} retries - number of retries made before re-connect succeeded
 */
export declare function reconnect(retries: number): void;

/**
 * `'message'` event occurs each time database connection gets notification
 * to any listening channel. Fired before channel event emitted.
 *
 * @asMemberOf PgPubSub
 * @event message
 * @param {string} chan - channel to which notification corresponding to
 * @param {AnyJson} payload - notification message payload
 */
export declare function message(chan: string, payload: AnyJson): void;

/**
 * `'notify'` event occurs each time new message has been published to a
 * particular channel. Occurs right after database NOTIFY command succeeded.
 *
 * @asMemberOf PgPubSub
 * @event notify
 * @param {string} chan - channel to which notification was sent
 * @param {AnyJson} payload - notification message payload
 */
export declare function notify(chan: string, payload: AnyJson): void;
