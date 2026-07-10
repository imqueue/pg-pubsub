/*!
 * I'm Queue Software Project
 * Copyright (C) 2026  imqueue.com <support@imqueue.com>
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
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { isDeepStrictEqual } from 'node:util';

/**
 * Thin sinon-like facade over node:test mock functions, so specs can keep
 * their spy/stub call-verification style without a sinon dependency.
 */
export interface SpyApi {
    (...args: any[]): any;
    readonly called: boolean;
    readonly calledOnce: boolean;
    readonly calledTwice: boolean;
    getCalls(): Array<{ args: any[] }>;
    calledWith(...args: any[]): boolean;
    calledWithExactly(...args: any[]): boolean;
    restore(): void;
    resolves(value?: any): SpyApi;
    rejects(error: any): SpyApi;
    returns(value: any): SpyApi;
    throws(error: any): SpyApi;
}

// Patches obj[method] as an OWN property (sinon semantics), so spying on
// an inherited method (e.g. EventEmitter.prototype.emit) affects only the
// given instance instead of every object sharing the prototype, which is
// what node:test mock.method() would do.
function patchOwn(obj: any, method: string, impl?: (...a: any[]) => any) {
    const prior = Object.getOwnPropertyDescriptor(obj, method);

    if (prior && (prior.value as any)?.__spyApi) {
        // re-spied without restore: emulate a fresh sinon spy
        (prior.value as any).mock.resetCalls();
        return prior.value;
    }

    const original = obj[method];
    const fn: any = mock.fn(
        impl ||
            function (this: any, ...args: any[]) {
                return original.apply(this, args);
            },
    );

    Object.defineProperty(obj, method, {
        value: fn,
        configurable: true,
        writable: true,
        enumerable: prior ? prior.enumerable : false,
    });

    fn.__restoreOwn = () => {
        if (prior) {
            Object.defineProperty(obj, method, prior);
        } else {
            delete obj[method];
        }
    };

    return fn;
}

function withApi(fn: any): SpyApi {
    if (fn.__spyApi) {
        return fn as SpyApi;
    }

    fn.__spyApi = true;
    Object.defineProperties(fn, {
        called: { get: () => fn.mock.callCount() > 0 },
        calledOnce: { get: () => fn.mock.callCount() === 1 },
        calledTwice: { get: () => fn.mock.callCount() === 2 },
    });

    fn.getCalls = () =>
        fn.mock.calls.map((call: any) => ({ args: [...call.arguments] }));
    fn.calledWith = (...args: any[]) =>
        fn.mock.calls.some((call: any) =>
            isDeepStrictEqual([...call.arguments].slice(0, args.length), args),
        );
    fn.calledWithExactly = (...args: any[]) =>
        fn.mock.calls.some((call: any) =>
            isDeepStrictEqual([...call.arguments], args),
        );
    fn.restore = () => {
        if (fn.__restoreOwn) {
            fn.__restoreOwn();
        } else {
            fn.mock.restore();
        }
    };
    fn.resolves = (value?: any) => {
        fn.mock.mockImplementation(async () => value);
        return fn;
    };
    fn.rejects = (error: any) => {
        fn.mock.mockImplementation(async () => {
            throw error;
        });
        return fn;
    };
    fn.returns = (value: any) => {
        fn.mock.mockImplementation(() => value);
        return fn;
    };
    fn.throws = (error: any) => {
        fn.mock.mockImplementation(() => {
            throw error;
        });
        return fn;
    };

    return fn as SpyApi;
}

export function spy(obj?: any, method?: string): SpyApi {
    return withApi(obj ? patchOwn(obj, method as string) : mock.fn());
}

export function stub(obj: any, method: string): SpyApi {
    const fn = withApi(patchOwn(obj, method, () => undefined));

    (fn as any).mock.mockImplementation(() => undefined);

    return fn;
}

export function createSandbox() {
    const created: SpyApi[] = [];

    return {
        spy(obj?: any, method?: string): SpyApi {
            const item = spy(obj, method);
            created.push(item);
            return item;
        },
        stub(obj: any, method: string): SpyApi {
            const item = stub(obj, method);
            created.push(item);
            return item;
        },
        restore(): void {
            for (const item of created.splice(0)) {
                try {
                    item.restore();
                } catch {
                    // already restored by the spec itself
                }
            }
        },
    };
}

export const spyAssert = {
    calledOnce(item: SpyApi): void {
        assert.equal(item.calledOnce, true);
    },
    notCalled(item: SpyApi): void {
        assert.equal(item.called, false);
    },
    calledWith(item: SpyApi, ...args: any[]): void {
        assert.equal(item.calledWith(...args), true);
    },
};
