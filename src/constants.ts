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
export const SCHEMA_NAME = process.env.PG_PUBSUB_SCHEMA_NAME || 'pgip_lock';
export const SHUTDOWN_TIMEOUT = +(
    process.env.PG_PUBSUB_SHUTDOWN_TIMEOUT || 1000
);
export const RETRY_DELAY = 100;
export const RETRY_LIMIT = Infinity;
export const IS_ONE_PROCESS = true;
export const ACQUIRE_INTERVAL = 30000;
export const EXECUTION_LOCK = !!+(
    process.env.PG_PUBSUB_EXECUTION_LOCK || 0
);
