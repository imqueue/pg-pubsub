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
import { type AnyLock } from './types/index.js';

/**
 * Implements no lock to be used with multi-listener approach
 */
export class NoLock implements AnyLock {
    /**
     * Init no lock
     */
    public async init(): Promise<void> {
        return Promise.resolve();
    }

    /**
     * Registers nothing: a no-op lock is never held, so it is never released and
     * the handler could never fire.
     *
     * @param handler - ignored
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public onRelease(handler: (channel: string) => void): void {
        return;
    }

    /**
     * Registers nothing: {@link NoLock.acquire} always succeeds immediately, so
     * there is no late takeover for the handler to report.
     *
     * @param handler - ignored
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public onAcquire(handler: (channel: string) => void): void {
        return;
    }

    /**
     * Frees no resources: no lock holds none
     */
    public dispose(): void {
        return;
    }

    /**
     * Always acquires, because it's no lock
     *
     */
    public async acquire(): Promise<boolean> {
        return Promise.resolve(true);
    }

    /**
     * Never releases, because it's no lock
     *
     */
    public async release(): Promise<void> {
        return Promise.resolve();
    }

    /**
     * Always acquired, because it's no lock
     *
     */
    public isAcquired(): boolean {
        return true;
    }

    /**
     * Safely destroys this no lock
     *
     */
    public async destroy(): Promise<void> {
        return Promise.resolve();
    }
}
