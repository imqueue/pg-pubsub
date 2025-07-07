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
import { AnyJson } from '../types';

/**
 * Channel listener event, occurs whenever the listening channel gets a new
 * payload message.
 *
 * @mergeModuleWith PgChannelEmitter
 * @event channel
 * @param {AnyJson} payload - event payload
 */
export declare function channel(payload: AnyJson): void;

/**
 * `'end'` event, occurs whenever pg connection ends, so, literally it's simply
 * proxy to `'end'` event from `pg.Client`
 *
 * @mergeModuleWith PgPubSub
 * @event end
 */
export declare function end(): void;

/**
 * `'connect'` event, occurs each time database connection is established.
 *
 * @mergeModuleWith PgPubSub
 * @event connect
 */
export declare function connect(): void;

/**
 * `'close'` event, occurs each time connection closed. Differs from `'end'`
 * event, because `'end'` event may occur many times during re-connectable
 * connection process, but `'close'` event states that connection was
 * safely programmatically closed and further re-connections won't happen.
 *
 * @mergeModuleWith PgPubSub
 * @event close
 */
export declare function close(): void;

/**
 * `'listen'` event occurs each time channel starts being listening
 *
 * @mergeModuleWith PgPubSub
 * @event listen
 * @param {string[]} channels - list of channels being started listening
 */
export declare function listen(channels: string[]): void;

/**
 * `'unlisten'` event occurs each time channel ends being listening
 *
 * @mergeModuleWith PgPubSub
 * @event unlisten
 * @param {string[]} channels - list of channels being stopped listening
 */
export declare function unlisten(channels: string[]): void;

/**
 * `'error'` event occurs each time connection error is happened
 *
 * @mergeModuleWith PgPubSub
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
 * @mergeModuleWith PgPubSub
 * @event reconnect
 * @param {number} retries - number of retries made before re-connect succeeded
 */
export declare function reconnect(retries: number): void;

/**
 * `'message'` event occurs each time database connection gets notification
 * to any listening channel. Fired before channel event emitted.
 *
 * @mergeModuleWith PgPubSub
 * @event message
 * @param {string} chan - channel to which notification corresponding to
 * @param {AnyJson} payload - notification message payload
 */
export declare function message(chan: string, payload: AnyJson): void;

/**
 * `'notify'` event occurs each time new message has been published to a
 * particular channel. Occurs right after database NOTIFY command succeeded.
 *
 * @mergeModuleWith PgPubSub
 * @event notify
 * @param {string} chan - channel to which notification was sent
 * @param {AnyJson} payload - notification message payload
 */
export declare function notify(chan: string, payload: AnyJson): void;
