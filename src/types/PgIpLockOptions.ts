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
import { AnyLogger } from './AnyLogger';
import { PgClient } from './PgClient';

/**
 * Options accepted by PgIpLock constructor.
 */
export interface PgIpLockOptions {
    /**
     * PostgreSQL database connection client instance of [[PgClient]] interface.
     * Lock will not create connection itself, but await the connection client
     * to be provided explicitly.
     *
     * @type {PgClient}
     */
    pgClient: PgClient;

    /**
     * Logger to be used for log messages produced by lock instances. Any
     * logger which follows [[AnyLogger]] interface is suitable.
     *
     * @type {AnyLogger}
     */
    logger: AnyLogger;

    /**
     * Acquire re-try interval. See [[PgPubSubOptions.acquireInterval]].
     *
     * @see PgPubSubOptions.acquireInterval
     * @type {number}
     */
    acquireInterval: number;
}
