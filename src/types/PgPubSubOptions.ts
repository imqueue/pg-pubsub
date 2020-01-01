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
import { Client, ClientConfig } from 'pg';
import {
    ACQUIRE_INTERVAL,
    IS_ONE_PROCESS,
    RETRY_DELAY,
    RETRY_LIMIT,
} from '../constants';

/**
 * Options accepted as option argument of PgPubSub constructor.
 * It extends `pg.ClientConfig` options, mostly because it is used to
 * construct PostgreSQL database connection, adding more properties required
 * to configure PgBubSub objects behavior.
 */
export interface PgPubSubOptions extends ClientConfig {
    /**
     * Existing PostgreSQL client connection (optional). Can be passed if
     * there is a need to re-use existing db connection from external code.
     * Otherwise it is required to bypass correct options to instantiate
     * new `pg.Client` connection properly.
     *
     * @type {Client}
     */
    pgClient?: Client;

    /**
     * Specifies delay in milliseconds between re-connection retries
     *
     * @type {number}
     */
    retryDelay: number;

    /**
     * Specifies maximum number of re-connection retries to process, before
     * connection would be treated as broken (disconnected). By default
     * is set to infinite number of retries.
     *
     * @type {number}
     */
    retryLimit: number;

    /**
     * Time interval in milliseconds before `LISTEN` clients would re-try to
     * acquire channel locks. It works from one hand as connection keep-alive
     * periodical pings, from other hand adds additional level of reliability
     * for the cases when connection, which holds the lock has been suddenly
     * disconnected in a silent manner.
     *
     * By default is set to `30000ms` (`30sec`). Please, assume this value
     * should be selected for a particular system with care of often acquire
     * lock hits and overall infrastructure reliability.
     *
     * @type {number}
     */
    acquireInterval: number;

    /**
     * Boolean flag, which turns off/on single listener mode. By default is
     * set to true, so instantiated PgPubSub connections will act using
     * inter-process locking mechanism.
     *
     * @type {boolean}
     */
    singleListener: boolean;
}

/**
 * Hard-coded pre-set of PgPubSubOptions
 *
 * @see PgPubSubOptions
 * @type {PgPubSubOptions}
 */
export const DefaultOptions: PgPubSubOptions = Object.freeze({
    retryLimit: RETRY_LIMIT,
    retryDelay: RETRY_DELAY,
    singleListener: IS_ONE_PROCESS,
    acquireInterval: ACQUIRE_INTERVAL,
});
