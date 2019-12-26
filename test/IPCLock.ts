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
import './mocks';
import { expect } from 'chai';
import { IPCLock } from '../IPCLock';
import { Client } from 'pg';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';

process.setMaxListeners(1000);

describe('IPCLock', () => {
    let client: Client;
    let lock: IPCLock;

    beforeEach(() => {
        client = new Client();
        lock = new IPCLock('LockTest', client);
    });

    it('should be a class', () => {
        expect(typeof IPCLock).equals('function');
    });
    describe('constructor()', () => {
        it('should accept channel name and pg client as arguments', () => {
            expect(lock.channel).equals(`${IPCLock.name}_LockTest`);
            expect(lock.pgClient).equals(client);
        });

        after(() => {
            process.removeAllListeners('SIGTERM');
        });
        describe('Signal handling', () => {
            [ 'SIGTERM' ].forEach(SIGNAL => {
                let sandbox: SinonSandbox;
                let releaseStub: any;
                let exitStub: any;

                describe(`Release success on ${SIGNAL}`, () => {
                    beforeEach(() => {
                        sandbox = sinon.createSandbox();
                        releaseStub = sandbox.stub(lock, 'release');
                        exitStub = sandbox.stub(process, 'exit');
                    });
                    afterEach(() => sandbox.restore());

                    it(`should release lock on ${SIGNAL}`, done => {
                        process.once(SIGNAL as any, () => {
                            sinon.assert.calledOnce(releaseStub);
                            done();
                        });
                        process.kill(process.pid, SIGNAL);
                    });
                });
                describe(`Release error on ${SIGNAL}`, () => {
                    beforeEach(() => {
                        sandbox = sinon.createSandbox();
                        releaseStub = sandbox.stub(lock, 'release')
                            .throws(Error);
                        exitStub = sandbox.stub(process, 'exit');
                    });
                    afterEach(() => sandbox.restore());

                    it(`should exit with error code on ${SIGNAL}`, done => {
                        process.once(SIGNAL as any, () => {
                            sinon.assert.calledWith(exitStub, 1);
                            done();
                        });
                        process.kill(process.pid, SIGNAL);
                    });
                });
            });
        });
    });
    describe('init()', () => {
        it('should create lock db and start listen for releases', async () => {
            const spy = sinon.spy(client, 'query');
            await lock.init();
            const calls = spy.getCalls();

            const requiredCalls: any = {
                'create schema': 0,
                'create table': 0,
                'create function': 0,
                'create constraint trigger': 0,
                'listen "ipclock_locktest"': 0,
            };
            const expected: any = {
                'create schema': 1,
                'create table': 1,
                'create function': 1,
                'create constraint trigger': 1,
                'listen "ipclock_locktest"': 1,
            };

            for (const sub of Object.keys(requiredCalls)) {
                for (const { lastArg } of calls) {
                    if (~lastArg.toLowerCase().indexOf(sub)) {
                        requiredCalls[sub]++;
                    }
                }
            }

            expect(requiredCalls).deep.equals(expected);
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
                    throw Error('Duplicating key!');
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
        it('should release aquired lock', async () => {
            await lock.acquire();
            await lock.release();
            expect(lock.isAcquired()).to.be.false;
        });
    });
    describe('onRelease()', () => {
        it('should not allow set handler twice', () => {
            lock.onRelease(() => {});
            expect(() => lock.onRelease(() => {})).to.throw(Error);
        });
        it('should set notification event handler', () => {
            const spy = sinon.spy();
            lock.onRelease(spy);
            client.emit('notification', {
                channel: `${IPCLock.name}_LockTest`,
                payload: '{"a":"b"}',
            });
            expect(spy.calledOnce).to.be.true;
        });
    });
});
