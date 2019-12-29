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
import { AnyJson } from './AnyJson';

/**
 * Listener with no arguments and no return values
 */
export type VoidListener = () => void;

/**
 * Reconnection event listener, accepts retries number as an argument
 *
 * @param {number} retries - number of retries made before reconnect succeeds
 */
export type ReconnectListener = (retries: number) => void;

/**
 * Error listener, accepts any kind of Error as an argument
 *
 * @param {Error} error - error occurred with error event
 */
export type ErrorListener = (err: Error) => void;

/**
 * Notification message event listener, accepts channel and massage payload
 * as arguments
 *
 * @param {string} channel - channel name on which event occurred
 * @param {AnyJson} payload - payload data coming from an event
 */
export type MessageListener = (channel: string, payload: AnyJson) => void;

/**
 * Usually occurred within UNLISTEN calls or other cases, accepting list of
 * channel names it happened on
 *
 * @param {string} channels - list of  channel names
 */
export type ChannelsListener = (channels: string[]) => void;

/**
 * Channel event listener, where an event is a channel name, and payload
 * is accepted as an event data
 *
 * @param {AnyJson} payload - payload published to a channel
 */
export type ChannelListener = (payload: AnyJson) => void;

/**
 * Any listener is untyped listener which may accept any number of arguments
 *
 * @param {...any[]} [args] - optional arguments, any number
 */
export type AnyListener = (...args: any[]) => void;
