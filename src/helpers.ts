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
import { AnyJson, AnyLogger } from './types';

/**
 * Serializes given input object to JSON string. On error will return
 * serialized null value.
 *
 * @param {AnyJson} input - serializable object
 * @param {AnyLogger} [logger] - logger to handle errors logging with
 * @param {boolean} [pretty] - serialized format output
 * @return {string}
 */
export function pack(
    input: AnyJson,
    logger?: AnyLogger,
    pretty: boolean = false,
): string {
    if (typeof input === 'undefined') {
        return 'null';
    }

    try {
        return pretty
            ? JSON.stringify(input, null, 2)
            : JSON.stringify(input);
    } catch (err) {
        if (logger && logger.warn) {
            logger.warn('pack() error:', err);
        }

        return 'null';
    }
}

/**
 * Deserializes given input JSON string to corresponding JSON value object.
 * On error will return empty object.
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
