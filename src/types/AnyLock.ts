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
 * Lock implementation interface to follow
 */
export interface AnyLock {
    /**
     * Must initialize lock asynchronously
     */
    init(): Promise<void>;

    /**
     * Implements lock acquire logic asynchronously
     */
    acquire(): Promise<boolean>;

    /**
     * Implements lock release logic asynchronously
     */
    release(): Promise<void>;

    /**
     * Must free all local resources held by the lock (timers, client event
     * listeners, registry entries) without any database communication.
     * Used when the underlying connection is already gone.
     */
    dispose(): void;

    /**
     * Implements lock acquire verification asynchronously
     */
    isAcquired(): boolean;

    /**
     * Implements lock safe destruction asynchronously
     */
    destroy(): Promise<void>;

    /**
     * Implements lock release handler upset
     *
     * @param handler - called with the channel name once this process has
     *                  released the lock for it, so a waiting process can take
     *                  over
     */
    onRelease(handler: (channel: string) => void): void;

    /**
     * Implements late lock acquire handler upset. The handler is called when
     * the lock gets taken over by a retry, long after the acquire() caller
     * has given up - which makes it the only chance for that caller to finish
     * whatever the lock was being acquired for.
     *
     * @param handler - called with the channel name when a retry finally wins
     *                  the lock, potentially long after acquire() resolved false
     */
    onAcquire(handler: (channel: string) => void): void;
}
