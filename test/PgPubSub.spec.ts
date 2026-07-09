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
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spy as makeSpy, stub as makeStub } from './mocks/spy.js';
import './mocks/index.js';

import { Client } from 'pg';
import {
    type PgClient,
    PgIpLock,
    PgPubSub,
    RETRY_LIMIT,
} from '../src/index.js';

describe('PgPubSub', () => {
    let pgClient: Client;
    let pubSub: PgPubSub;

    const listenFunc = (pubSubCopy: PgPubSub) => {
        pubSubCopy.listen('TestChannel').then(() => {
            pgClient.emit('notification', {
                channel: 'TestChannel',
                payload: 'true',
            });
        });
    };

    beforeEach(() => {
        pgClient = new Client();
        pubSub = new PgPubSub({ pgClient });
    });
    afterEach(async () => pubSub.destroy());

    it('should be a class', () => {
        assert.equal(typeof PgPubSub, 'function');
    });

    describe('constructor()', () => {
        it('should accept pg client from options', () => {
            assert.equal(pubSub.pgClient, pgClient);
        });
        it('should construct pg client from options', () => {
            const ps = new PgPubSub({
                connectionString: 'postgres://user:pass@localhost:5432/dbname',
            });
            assert.ok(ps.pgClient instanceof Client);
        });
        it('should properly set events mapping', (_: unknown, done: (
            err?: Error,
        ) => void) => {
            pubSub.options.singleListener = false;

            const endSpy = makeSpy();
            const messageSpy = makeSpy();
            const errorSpy = makeSpy();

            pubSub.on('end', endSpy);
            pubSub.on('message', messageSpy);
            pubSub.on('error', errorSpy);

            pgClient.emit('end');
            pgClient.emit('notification', {
                channel: 'test',
                payload: '"test"',
            });
            pgClient.emit('error');

            // because some events could be async
            setTimeout(() => {
                assert.equal(endSpy.calledOnce, true);
                assert.equal(messageSpy.calledOnce, true);
                assert.equal(errorSpy.calledOnce, true);

                pubSub.options.singleListener = true;

                done();
            });
        });
    });
    describe('reconnect', () => {
        it('should support automatic reconnect', (_: unknown, done: (
            err?: Error,
        ) => void) => {
            let counter = 0;

            // emulate termination
            (pgClient as any).connect = () => {
                counter++;
                pgClient.emit('end');
            };

            pubSub.on('error', err => {
                assert.equal(
                    err.message,
                    `Connect failed after ${counter} retries...`,
                );
                done();
            });

            pubSub.connect().catch(() => {
                /**/
            });
        });
        it('should fire connect event only once', (_: unknown, done: (
            err?: Error,
        ) => void) => {
            let connectCalls = 0;

            // emulate termination
            (pgClient as any).connect = () => {
                if (connectCalls < 1) {
                    pgClient.emit('error');
                } else {
                    pgClient.emit('connect');
                }

                connectCalls++;
            };

            // test will fail if done is called more than once
            pubSub.on('connect', done);
            pubSub.connect().catch(() => {
                /**/
            });
        });
        it('should support automatic reconnect on errors', (_: unknown, done: (
            err?: Error,
        ) => void) => {
            let counter = 0;

            // emulate termination
            (pgClient as any).connect = () => {
                counter++;
                pgClient.emit('error');
            };

            pubSub.on('error', err => {
                if (err) {
                    assert.equal(
                        err.message,
                        `Connect failed after ${counter} retries...`,
                    );
                    done();
                }
            });

            pubSub.connect().catch(() => {
                /* ignore faking errors */
            });
        });
        it('should emit error and end if retry limit reached', async () => {
            // emulate connection failure
            (pgClient as any).connect = async () => {
                pgClient.emit('end');
            };

            try {
                await pubSub.connect();
            } catch (err) {
                assert.ok(err instanceof Error);
                assert.equal(
                    err.message,
                    `Connect failed after ${RETRY_LIMIT} retries...`,
                );
            }
        });
        it('should re-subscribe all channels', (_: unknown, done: (
            err?: Error,
        ) => void) => {
            pubSub.listen('TestOne');
            pubSub.listen('TestTwo');

            const spy = makeSpy(pubSub, 'listen');

            pubSub.connect().then(() => pgClient.emit('end'));

            setTimeout(() => {
                assert.equal(spy.calledTwice, true);
                done();
            }, 30);
        });
    });
    describe('close()', () => {
        it('should not reconnect if called', async () => {
            let counter = 0;

            pubSub.on('connect', () => {
                counter++;
                pubSub.close();
            });

            await pubSub.connect();

            assert.equal(counter, 1);
        });
    });
    describe('listen()', () => {
        it('should call SQL LISTEN "channel" command', async () => {
            pubSub.options.singleListener = true;
            const spy = makeSpy(pubSub.pgClient, 'query');
            await pubSub.listen('Test');
            assert.ok(
                spy
                    .getCalls()
                    .some(({ args: [arg] }) =>
                        /^LISTEN\s+"Test"/.test(String(arg).trim()),
                    ),
            );
        });
        it('should call SQL LISTEN "channel" command always', async () => {
            pubSub.options.singleListener = false;
            const spy = makeSpy(pubSub.pgClient, 'query');
            await pubSub.listen('Test');
            assert.ok(
                spy
                    .getCalls()
                    .some(({ args: [arg] }) =>
                        /^LISTEN\s+"Test"/.test(String(arg).trim()),
                    ),
            );
        });
        it('should handle messages from db with acquired lock', (_: unknown, done: (
            err?: Error,
        ) => void) => {
            pubSub.options.singleListener = true;

            listenFunc(pubSub);

            pubSub.on('message', (chanel, message) => {
                assert.equal(chanel, 'TestChannel');
                assert.equal(message, true);
                done();
            });
        });
        it('should not handle messages from db with no lock', async () => {
            pubSub.options.singleListener = true;

            const spy = makeSpy(pubSub, 'emit');

            await pubSub.listen('TestChannel');
            await (pubSub as any).locks.TestChannel.release();

            pgClient.emit('notification', {
                channel: 'TestChannel',
                payload: 'true',
            });

            await new Promise(resolve => setTimeout(resolve, 20));

            assert.equal(spy.calledWith('message', 'TestChannel', true), false);
        });
        it('should avoid handling lock channel messages', async () => {
            pubSub.options.singleListener = true;

            const spy = makeSpy(pubSub, 'emit');
            const spyChannel = makeSpy(pubSub.channels, 'emit');
            const channel = `__${PgIpLock.name}__:TestChannel`;

            await pubSub.listen('TestChannel');
            pgClient.emit('notification', {
                channel,
                payload: 'true',
            });

            assert.equal(
                spy.calledWithExactly(['message', channel, true] as any),
                false,
            );
            assert.equal(spyChannel.called, false);
        });
        it(
            'should handle messages from db with acquired execution ' + 'lock',
            (_: unknown, done: (err?: Error) => void) => {
                pubSub = new PgPubSub({
                    pgClient,
                    executionLock: true,
                    singleListener: true,
                });

                listenFunc(pubSub);

                pubSub.on('message', (chanel, message) => {
                    assert.equal(chanel, 'TestChannel');
                    assert.equal(message, true);
                    done();
                });
            },
        );
        it(
            'should handle messages from db with acquired execution ' +
                'lock and multiple listeners',
            (_: unknown, done: (err?: Error) => void) => {
                pubSub = new PgPubSub({
                    pgClient,
                    executionLock: true,
                    singleListener: false,
                });

                listenFunc(pubSub);

                pubSub.on('message', (chanel, message) => {
                    assert.equal(chanel, 'TestChannel');
                    assert.equal(message, true);
                    done();
                });
            },
        );
    });
    describe('unlisten()', () => {
        it('should call SQL UNLISTEN "channel" command', async () => {
            pubSub.options.singleListener = true;
            const spy = makeSpy(pubSub.pgClient, 'query');
            await pubSub.unlisten('Test');
            assert.ok(
                spy
                    .getCalls()
                    .some(({ args: [arg] }) =>
                        /^UNLISTEN\s+"Test"/.test(String(arg).trim()),
                    ),
            );
        });
        it('should call SQL UNLISTEN "channel" command always', async () => {
            pubSub.options.singleListener = false;
            const spy = makeSpy(pubSub.pgClient, 'query');
            await pubSub.unlisten('Test');
            assert.ok(
                spy
                    .getCalls()
                    .some(({ args: [arg] }) =>
                        /^UNLISTEN\s+"Test"/.test(String(arg).trim()),
                    ),
            );
        });
        it('should destroy existing locks', async () => {
            await pubSub.listen('Test');
            const spy = makeSpy((pubSub as any).locks.Test, 'destroy');
            assert.equal(spy.called, false);
            await pubSub.unlisten('Test');
            assert.equal(spy.called, true);
        });
    });
    describe('unlistenAll()', () => {
        it('should call SQL UNLISTEN * command', async () => {
            pubSub.options.singleListener = true;
            const spy = makeSpy(pubSub.pgClient, 'query');
            await pubSub.unlistenAll();
            assert.ok(
                spy
                    .getCalls()
                    .some(({ args: [arg] }) =>
                        /^UNLISTEN\s+\*/.test(String(arg).trim()),
                    ),
            );
        });
        it('should call SQL UNLISTEN * command always', async () => {
            pubSub.options.singleListener = false;
            const spy = makeSpy(pubSub.pgClient, 'query');
            await pubSub.unlistenAll();
            assert.ok(
                spy
                    .getCalls()
                    .some(({ args: [arg] }) =>
                        /^UNLISTEN\s+\*/.test(String(arg).trim()),
                    ),
            );
        });
    });
    describe('notify()', () => {
        it('should call SQL NOTIFY command', async () => {
            const spy = makeSpy(pubSub.pgClient, 'query');
            await pubSub.notify('Test', { a: 'b' });
            assert.ok(
                spy
                    .getCalls()
                    .some(
                        ({ args: [arg] }) =>
                            String(arg).trim() === `NOTIFY "Test", '{"a":"b"}'`,
                    ),
            );
        });
    });
    describe('Channels API', () => {
        let pubSub1: PgPubSub;
        let pubSub2: PgPubSub;
        let pubSub3: PgPubSub;

        beforeEach(async () => {
            const pgClientShared = new Client() as PgClient;

            pubSub1 = new PgPubSub({ pgClient: pgClientShared });
            await pubSub1.connect();
            await pubSub1.listen('ChannelOne');
            await pubSub1.listen('ChannelTwo');

            pubSub2 = new PgPubSub({ pgClient: new Client() });
            await pubSub2.connect();
            await pubSub2.listen('ChannelThree');
            await pubSub2.listen('ChannelFour');

            pubSub3 = new PgPubSub({ pgClient: pgClientShared });
            await pubSub3.connect();
            await pubSub3.listen('ChannelFive');
            await pubSub3.listen('ChannelSix');
            await pubSub3.notify('ChannelOne', {});
            await pubSub3.notify('ChannelTwo', {});

            // make sure all async events handled
            await new Promise(resolve => setTimeout(resolve));
        });
        afterEach(async () =>
            Promise.all([
                pubSub1.destroy(),
                pubSub2.destroy(),
                pubSub3.destroy(),
            ]),
        );

        describe('activeChannels()', () => {
            it('should return active channels only', () => {
                assert.deepEqual(
                    [...pubSub1.activeChannels()].sort(),
                    ['ChannelOne', 'ChannelTwo'].sort(),
                );
                assert.deepEqual(
                    [...pubSub2.activeChannels()].sort(),
                    ['ChannelThree', 'ChannelFour'].sort(),
                );
                assert.deepEqual(
                    [...pubSub3.activeChannels()].sort(),
                    ['ChannelFive', 'ChannelSix'].sort(),
                );
            });
        });
        describe('inactiveChannels()', () => {
            it('should return inactive channels only', () => {
                assert.deepEqual(pubSub1.inactiveChannels(), []);
                assert.deepEqual(pubSub2.inactiveChannels(), []);
                assert.deepEqual(
                    [...pubSub3.inactiveChannels()].sort(),
                    ['ChannelOne', 'ChannelTwo'].sort(),
                );
            });
        });
        describe('allChannels()', () => {
            it('should return all channels', () => {
                assert.deepEqual(
                    [...pubSub1.allChannels()].sort(),
                    ['ChannelOne', 'ChannelTwo'].sort(),
                );
                assert.deepEqual(
                    [...pubSub2.allChannels()].sort(),
                    ['ChannelThree', 'ChannelFour'].sort(),
                );
                assert.deepEqual(
                    [...pubSub3.allChannels()].sort(),
                    [
                        'ChannelOne',
                        'ChannelTwo',
                        'ChannelFive',
                        'ChannelSix',
                    ].sort(),
                );
            });
        });
        describe('isActive()', () => {
            it('should return true if given channel is active', () => {
                assert.equal(pubSub1.isActive('ChannelOne'), true);
                assert.equal(pubSub1.isActive('ChannelTwo'), true);
                assert.equal(pubSub2.isActive('ChannelThree'), true);
                assert.equal(pubSub2.isActive('ChannelFour'), true);
                assert.equal(pubSub3.isActive('ChannelFive'), true);
                assert.equal(pubSub3.isActive('ChannelSix'), true);
            });
            it('should return false if given channel is not active', () => {
                assert.equal(pubSub1.isActive('ChannelThree'), false);
                assert.equal(pubSub1.isActive('ChannelFour'), false);
            });
            it('should return true if there is active channels', () => {
                assert.equal(pubSub1.isActive(), true);
                assert.equal(pubSub2.isActive(), true);
                assert.equal(pubSub3.isActive(), true);
            });
            it('should return false if there are no active channels', () => {
                assert.equal(pubSub.isActive(), false);
            });
        });
    });
    describe('release()', () => {
        it('should release all locks acquired', async () => {
            await pubSub.listen('One');
            await pubSub.listen('Two');

            const spies = [
                makeSpy((pubSub as any).locks.One, 'release'),
                makeSpy((pubSub as any).locks.Two, 'release'),
            ];

            await (pubSub as any).release();
            spies.forEach(spy => assert.equal(spy.called, true));
        });
        it('should skip locks which was not acquired', async () => {
            await pubSub.listen('One');
            await pubSub.listen('Two');

            await (pubSub as any).locks.One.release();
            await (pubSub as any).locks.Two.release();

            const spies = [
                makeSpy((pubSub as any).locks.One, 'release'),
                makeSpy((pubSub as any).locks.Two, 'release'),
            ];

            await (pubSub as any).release();
            spies.forEach(spy => assert.equal(spy.called, false));
        });
        it('should release only acquired locks', async () => {
            await pubSub.listen('One');
            await pubSub.listen('Two');

            await (pubSub as any).locks.One.release();

            const [one, two] = [
                makeSpy((pubSub as any).locks.One, 'release'),
                makeSpy((pubSub as any).locks.Two, 'release'),
            ];

            await (pubSub as any).release();

            assert.equal(one.called, false);
            assert.equal(two.called, true);
        });
    });
    describe('setProcessId()', () => {
        it('should set process id', async () => {
            const stub = makeStub(pgClient, 'query').resolves({
                rows: [{ pid: 7777 }],
            });
            await (pubSub as any).setProcessId();
            assert.equal((pubSub as any).processId, 7777);
            stub.restore();
        });
        it('should filter messages if set and "filtered" option is set', async () => {
            pubSub.options.singleListener = false;
            pubSub.options.filtered = false;
            (pubSub as any).processId = 7777;

            await pubSub.listen('Test');
            let counter = 0;

            pubSub.channels.on('Test', () => ++counter);
            pgClient.emit('notification', {
                processId: 7777,
                channel: 'Test',
                payload: 'true',
            });

            await new Promise(res => setTimeout(res));

            assert.equal(counter, 1);

            pubSub.options.filtered = true;
            pgClient.emit('notification', {
                processId: 7777,
                channel: 'Test',
                payload: 'true',
            });

            await new Promise(res => setTimeout(res));

            assert.equal(counter, 1);
        });
        it(
            'should filter messages if set and "filtered" option is set and' +
                ' execution lock is set',
            async () => {
                const pubSubCopy = new PgPubSub({
                    singleListener: false,
                    filtered: false,
                    executionLock: true,
                    pgClient,
                });
                (pubSubCopy as any).processId = 7777;

                await pubSubCopy.listen('Test');
                let counter = 0;

                pubSubCopy.channels.on('Test', () => ++counter);
                pgClient.emit('notification', {
                    processId: 7777,
                    channel: 'Test',
                    payload: 'true',
                });

                await new Promise(res => setTimeout(res));

                assert.equal(counter, 1);

                pubSubCopy.options.filtered = true;
                pgClient.emit('notification', {
                    processId: 7777,
                    channel: 'Test',
                    payload: 'true',
                });

                await new Promise(res => setTimeout(res));

                assert.equal(counter, 1);
                await pubSub.destroy();
            },
        );
    });
    describe('destroy()', () => {
        it('should properly handle destruction', async () => {
            const spies = [
                makeSpy(pubSub, 'close'),
                makeSpy(pubSub, 'removeAllListeners'),
                makeSpy(pubSub.channels, 'removeAllListeners'),
                makeSpy(PgIpLock, 'destroy'),
            ];
            await pubSub.destroy();
            spies.forEach(spy => {
                assert.equal(spy.calledOnce, true);
                spy.restore();
            });
        });
    });
});
