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
import { AnyJson, AnyLogger } from './types';
import { fingerprint64 } from 'farmhash';

/**
 * Performs JSON.stringify on a given input taking into account
 * pretty flag.
 *
 * @access private
 * @param {AnyJson} input - serializable value
 * @param {boolean} [pretty] - serialized format output prettify flag
 * @return {string}
 */
function stringify(input: AnyJson, pretty?: boolean): string {
    return pretty
        ? JSON.stringify(input, null, 2)
        : JSON.stringify(input);
}

/**
 * Serializes given input object to JSON string. On error will return
 * serialized null value
 *
 * @param {AnyJson} input - serializable value
 * @param {AnyLogger} [logger] - logger to handle errors logging with
 * @param {boolean} [pretty] - serialized format output prettify flag
 * @return {string}
 */
export function pack(
    input: AnyJson,
    logger?: AnyLogger,
    pretty = false,
): string {
    if (typeof input === 'undefined') {
        return 'null';
    }

    try {
        return stringify(input, pretty);
    } catch (err) {
        if (logger && logger.warn) {
            logger.warn('pack() error:', err);
        }

        return 'null';
    }
}

/**
 * Deserializes given input JSON string to corresponding JSON value object.
 * On error will return empty object
 *
 * @param {string} input - string to deserialize
 * @param {AnyLogger} [logger] - logger to handle errors logging with
 * @return {AnyJson}
 */
export function unpack(input?: string, logger?: AnyLogger): AnyJson {
    if (typeof input !== 'string') {
        return null;
    }

    try {
        return JSON.parse(input);
    } catch (err) {
        if (logger && logger.warn) {
            logger.warn('unpack() error:', err);
        }

        return {};
    }
}

/**
 * Constructs and returns hash string for a given set of processId, channel
 * and payload.
 *
 * @param {string} processId
 * @param {string} channel
 * @param {any} payload
 * @returns {string}
 */
export function signature(
    processId: number,
    channel: string,
    payload: any,
): string {
    const data = JSON.stringify([processId, channel, payload]);
    const hashBigInt = fingerprint64(data);
    return hashBigInt.toString(16);
}
