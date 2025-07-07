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
