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
import { AnyLock } from './types';

// istanbul ignore next
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public onRelease(handler: (channel: string) => void): void {
        return ;
    }

    /**
     * Always acquires, because it's no lock
     *
     * @return {Promise<boolean>}
     */
    public async acquire(): Promise<boolean> {
        return Promise.resolve(true);
    }

    /**
     * Never releases, because it's no lock
     *
     * @return {Promise<void>}
     */
    public async release(): Promise<void> {
        return Promise.resolve();
    }

    /**
     * Always acquired, because it's no lock
     *
     * @return {boolean}
     */
    public isAcquired(): boolean {
        return true;
    }

    /**
     * Safely destroys this no lock
     *
     * @return {Promise<void>}
     */
    public async destroy(): Promise<void> {
        return Promise.resolve();
    }
}
