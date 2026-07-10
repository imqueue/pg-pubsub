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
import { describe, it, beforeEach, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    createSandbox,
    spy as makeSpy,
    stub as makeStub,
    spyAssert,
} from './mocks/spy.js';
import { FakeError } from './mocks/index.js';

import { Client } from 'pg';
import { ACQUIRE_INTERVAL, PgIpLock, SHUTDOWN_TIMEOUT } from '../src/index.js';
import { type PgClient } from '../src/types/index.js';

after(() => {
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGABRT');
    process.removeAllListeners('SIGINT');
});

describe('IPCLock', () => {
    let client: PgClient;
    let lock: PgIpLock;

    beforeEach(() => {
        client = new Client() as PgClient;
        lock = new PgIpLock('LockTest', {
            pgClient: client,
            logger: console,
            acquireInterval: ACQUIRE_INTERVAL,
        });
    });
    afterEach(async () => lock.destroy());

    it('should be a class', () => {
        assert.equal(typeof PgIpLock, 'function');
    });

    describe('constructor()', () => {
        it('should accept channel name and pg client as arguments', () => {
            assert.equal(lock.channel, `__${PgIpLock.name}__:LockTest`);
            assert.equal(lock.options.pgClient, client);
        });
    });
    describe('init()', () => {
        beforeEach(() => {
            ['createSchema', 'createLock', 'createDeadlockCheck', 'listen'].map(
                method => makeSpy(lock as any, method),
            );
        });

        it('should re-apply notify handler on re-use', async () => {
            await lock.init();
            lock.onRelease(() => {
                /**/
            });
            await lock.destroy();

            const spyOn = makeSpy(lock.options.pgClient, 'on');
            await lock.init();

            const calls = spyOn.getCalls();

            assert.equal(spyOn.called, true);
            assert.deepEqual(calls[0].args, [
                'notification',
                (lock as any).notifyHandler,
            ]);
        });
        it('should periodically re-acquire after init', async () => {
            const spyAcquire = makeSpy(lock, 'acquire');
            await lock.init();
            const stubAcquire = makeStub(client, 'query').throws(
                new FakeError(),
            );
            await new Promise(res => setTimeout(res, ACQUIRE_INTERVAL * 2 + 5));

            assert.equal(spyAcquire.calledTwice, true);

            // await compLock.destroy();
            await lock.destroy();
            stubAcquire.restore();
        });
    });
    describe('isAcquired()', () => {
        it('should return true if the lock is acquired', () => {
            (lock as any).acquired = true;
            assert.equal(lock.isAcquired(), true);
        });
        it('should return false if the lock is not acquired', () => {
            assert.equal(lock.isAcquired(), false);
        });
    });
    describe('acquire()', () => {
        beforeEach(() => {
            let count = 0;
            client.query = (() => {
                if (++count > 1) {
                    throw new FakeError();
                }
            }) as any;
        });

        it('should acquire lock if it is free', async () => {
            assert.equal(await lock.acquire(), true);
        });
        it('should not acquire lock if it is busy', async () => {
            await lock.acquire();
            assert.equal(await lock.acquire(), false);
        });
    });
    describe('release()', () => {
        it('should release acquired lock', async () => {
            await lock.acquire();
            await lock.release();
            assert.equal(lock.isAcquired(), false);
        });
    });
    describe('onRelease()', () => {
        it('should not allow set handler twice', () => {
            lock.onRelease(() => {
                /**/
            });
            assert.throws(() =>
                lock.onRelease(() => {
                    /**/
                }),
            );
        });
        it('should set notification event handler', () => {
            const spy = makeSpy();
            lock.onRelease(spy);
            client.emit('notification', {
                channel: `__${PgIpLock.name}__:LockTest`,
                payload: '{"a":"b"}',
            });
            assert.equal(spy.calledOnce, true);
        });
    });
    describe('Shutdown', () => {
        let sandbox: ReturnType<typeof createSandbox>;
        let destroy: any;
        let exit: any;

        beforeEach(() => {
            sandbox = createSandbox();
            destroy = sandbox.stub(PgIpLock, 'destroy').resolves();
            exit = sandbox.stub(process, 'exit');
        });
        afterEach(() => sandbox.restore());

        // signal delivery is asynchronous: a ref'd keep-alive timer stops
        // node:test (Node 22) from resolving the event loop and cancelling
        // the test before the signal handler runs
        const onSignal = (
            SIGNAL: string,
            done: (err?: Error) => void,
            handler: (finish: (err?: Error) => void) => void,
        ) => {
            const keepAlive = setTimeout(
                () => finish(new Error(`timed out waiting for ${SIGNAL}`)),
                10000,
            );
            const finish = (err?: Error) => {
                clearTimeout(keepAlive);
                done(err);
            };

            process.once(SIGNAL as any, () => handler(finish));
            process.kill(process.pid, SIGNAL);
        };

        ['SIGINT', 'SIGTERM', 'SIGABRT'].forEach(SIGNAL => {
            describe(`gracefully on ${SIGNAL}`, () => {
                it(`should release lock`, (_: unknown, done: (
                    err?: Error,
                ) => void) => {
                    onSignal(SIGNAL, done, finish => {
                        try {
                            spyAssert.calledOnce(destroy);
                        } catch (err) {
                            return finish(err as Error);
                        }

                        // drain the scheduled exit timer into the stubbed
                        // process.exit before the sandbox is restored
                        setTimeout(finish, SHUTDOWN_TIMEOUT + 30);
                    });
                });
                it('should exit after timeout', (_: unknown, done: (
                    err?: Error,
                ) => void) => {
                    onSignal(SIGNAL, done, finish => {
                        try {
                            spyAssert.notCalled(exit);
                        } catch (err) {
                            return finish(err as Error);
                        }

                        setTimeout(() => {
                            try {
                                spyAssert.calledWith(exit, 0);
                                finish();
                            } catch (err) {
                                finish(err as Error);
                            }
                        }, SHUTDOWN_TIMEOUT + 30);
                    });
                });
                it(`should exit with error code`, (_: unknown, done: (
                    err?: Error,
                ) => void) => {
                    destroy.restore();
                    sandbox.stub(lock, 'destroy').rejects(new FakeError());
                    onSignal(SIGNAL, done, finish => {
                        try {
                            spyAssert.notCalled(exit);
                        } catch (err) {
                            return finish(err as Error);
                        }

                        setTimeout(() => {
                            try {
                                spyAssert.calledWith(exit, 1);
                                finish();
                            } catch (err) {
                                finish(err as Error);
                            }
                        }, SHUTDOWN_TIMEOUT + 30);
                    });
                });
            });
        });
    });
});
