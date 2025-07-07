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
import { Client, ClientConfig } from 'pg';
import {
    ACQUIRE_INTERVAL,
    EXECUTION_LOCK,
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

    /**
     * If set to true, self emitted messages (those which were sent using
     * `NOTIFY` on the same connection) will be filtered on this connection.
     * By default is false - means that connection will `LISTEN` to the
     * messages, which were notified on the same connection.
     *
     * @type {boolean}
     */
    filtered: boolean;

    /**
     * If set to true, all instances become listeners but only instance is an
     * executor which still implements inter-process locking mechanism.
     *
     * @type {boolean}
     */
    executionLock: boolean;
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
    filtered: false,
    executionLock: EXECUTION_LOCK,
});
