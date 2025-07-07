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
