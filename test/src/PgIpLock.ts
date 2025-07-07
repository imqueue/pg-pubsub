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
import { FakeError } from '../mocks';

import { expect } from 'chai';
import { Client } from 'pg';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy } from 'sinon';
import {
    ACQUIRE_INTERVAL,
    PgIpLock,
    SHUTDOWN_TIMEOUT,
} from '../../src';
import { PgClient } from '../../src/types';

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
        expect(typeof PgIpLock).equals('function');
    });

    describe('constructor()', () => {
        it('should accept channel name and pg client as arguments', () => {
            expect(lock.channel).equals(`__${PgIpLock.name}__:LockTest`);
            expect(lock.options.pgClient).equals(client);
        });
    });
    describe('init()', () => {
        let spy: SinonSpy[];
        let spyListen: SinonSpy;

        beforeEach(() => {
            spy = ['createSchema', 'createLock', 'createDeadlockCheck']
                .map(method => sinon.spy(lock as any, method));
            spyListen = sinon.spy(lock as any, 'listen');
        });

        it('should re-apply notify handler on re-use', async () => {
            await lock.init();
            lock.onRelease(() => { /**/ });
            await lock.destroy();

            const spyOn = sinon.spy(lock.options.pgClient, 'on');
            await lock.init();

            const calls = spyOn.getCalls();

            expect(spyOn.called).to.be.true;
            expect(calls[0].args).deep.equals([
                'notification',
                (lock as any).notifyHandler,
            ]);
        });
        it('should periodically re-acquire after init', async () => {
            const spyAcquire = sinon.spy(lock, 'acquire');
            await lock.init();
            const stubAcquire = sinon.stub(client, 'query')
                .throws(new FakeError());
            await new Promise(res => setTimeout(res, ACQUIRE_INTERVAL * 2 + 5));

            expect(spyAcquire.calledTwice).to.be.true;

            // await compLock.destroy();
            await lock.destroy();
            stubAcquire.restore();
        });
    });
    describe('isAcquired()', () => {
        it('should return true if the lock is acquired', () => {
            (lock as any).acquired = true;
            expect(lock.isAcquired()).to.be.true;
        });
        it('should return false if the lock is not acquired', () => {
            expect(lock.isAcquired()).to.be.false;
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
            expect(await lock.acquire()).to.be.true;
        });
        it('should not acquire lock if it is busy', async () => {
            await lock.acquire();
            expect(await lock.acquire()).to.be.false;
        });
    });
    describe('release()', () => {
        it('should release acquired lock', async () => {
            await lock.acquire();
            await lock.release();
            expect(lock.isAcquired()).to.be.false;
        });
    });
    describe('onRelease()', () => {
        it('should not allow set handler twice', () => {
            lock.onRelease(() => {/**/});
            expect(() => lock.onRelease(() => {/**/})).to.throw(Error);
        });
        it('should set notification event handler', () => {
            const spy = sinon.spy();
            lock.onRelease(spy);
            client.emit('notification', {
                channel: `__${PgIpLock.name}__:LockTest`,
                payload: '{"a":"b"}',
            });
            expect(spy.calledOnce).to.be.true;
        });
    });
    describe('Shutdown', () => {
        let sandbox: SinonSandbox;
        let destroy: any;
        let exit: any;

        beforeEach(() => {
            sandbox = sinon.createSandbox();
            destroy = sandbox.stub(PgIpLock, 'destroy').resolves();
            exit = sandbox.stub(process, 'exit');
        });
        afterEach(() => sandbox.restore());

        ['SIGINT', 'SIGTERM', 'SIGABRT'].forEach(SIGNAL => {
            describe(`gracefully on ${SIGNAL}`, () => {
                it(`should release lock`, done => {
                    process.once(SIGNAL as any, () => {
                        sinon.assert.calledOnce(destroy);
                        done();
                    });
                    process.kill(process.pid, SIGNAL);
                });
                it('should exit after timeout', done => {
                    process.once(SIGNAL as any, () => {
                        sinon.assert.notCalled(exit);
                        setTimeout(() => {
                            sinon.assert.calledWith(exit, 0);
                            done();
                        }, SHUTDOWN_TIMEOUT + 10);
                    });
                    process.kill(process.pid, SIGNAL);
                });
                it(`should exit with error code`, done => {
                    destroy.restore();
                    sandbox.stub(lock, 'destroy').rejects(new FakeError());
                    process.once(SIGNAL as any, () => {
                        sinon.assert.notCalled(exit);
                        setTimeout(() => {
                            sinon.assert.calledWith(exit, 1);
                            done();
                        }, SHUTDOWN_TIMEOUT + 10);
                    });
                    process.kill(process.pid, SIGNAL);
                });
            });
        });
    });
});
