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
/**
 * Represents logger interface suitable to be injected into this library objects
 */
export interface AnyLogger {
    /** General-purpose message, equivalent to `console.log`. */
    log(...args: any[]): void;

    /** Informational message: connection, listen and lock lifecycle events. */
    info(...args: any[]): void;

    /**
     * Recoverable problem — a failed reconnect attempt, or a payload rejected for
     * exceeding the NOTIFY size limit.
     */
    warn(...args: any[]): void;

    /** Unrecoverable problem, including exhausting the reconnect retry limit. */
    error(...args: any[]): void;
}
