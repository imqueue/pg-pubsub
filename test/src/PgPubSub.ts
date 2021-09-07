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
import '../mocks';

import { expect } from 'chai';
import { Client } from 'pg';
import * as sinon from 'sinon';
import { PgClient, PgIpLock, PgPubSub, RETRY_LIMIT } from '../../src';

describe('PgPubSub', () => {
    let pgClient: Client;
    let pubSub: PgPubSub;

    beforeEach(() => {
        pgClient = new Client();
        pubSub = new PgPubSub({ pgClient });
    });
    afterEach(async () => pubSub.destroy());

    it('should be a class', () => {
        expect(typeof PgPubSub).equals('function');
    });

    describe('constructor()', () => {
        it('should accept pg client from options', () => {
            expect(pubSub.pgClient).equals(pgClient);
        });
        it('should construct pg client from options', () => {
            const ps = new PgPubSub({
                connectionString: 'postgres://user:pass@localhost:5432/dbname',
            });
            expect(ps.pgClient).instanceOf(Client);
        });
        it('should properly set events mapping', done => {
            pubSub.options.singleListener = false;

            const endSpy = sinon.spy();
            const messageSpy = sinon.spy();
            const errorSpy = sinon.spy();

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
                expect(endSpy.calledOnce).to.be.true;
                expect(messageSpy.calledOnce).to.be.true;
                expect(errorSpy.calledOnce).to.be.true;

                pubSub.options.singleListener = true;

                done();
            });
        });
    });
    describe('reconnect', () => {
        it('should support automatic reconnect', done => {
            let counter = 0;

            // emulate termination
            (pgClient as any).connect = () => {
                counter++;
                pgClient.emit('end');
            };

            pubSub.on('error', err => {
                expect(err.message).equals(
                    `Connect failed after ${counter} retries...`,
                );
                done();
            });

            pubSub.connect().catch(() => { /**/ });
        });
        it('should fire connect event only once', done => {
            let connectCalls = 0;

            // emulate termination
            (pgClient as any).connect = () => {
                if (connectCalls < 1) {
                    pgClient.emit('error');
                }

                else {
                    pgClient.emit('connect');
                }

                connectCalls++;
            };

            // test will fail if done is called more than once
            pubSub.on('connect', done);
            pubSub.connect().catch(() => { /**/ });
        });
        it('should support automatic reconnect on errors', done => {
            let counter = 0;

            // emulate termination
            (pgClient as any).connect = () => {
                counter++;
                pgClient.emit('error');
            };

            pubSub.on('error', err => {
                if (err) {
                    expect(err.message).equals(
                        `Connect failed after ${counter} retries...`,
                    );
                    done();
                }
            });

            pubSub.connect().catch(() => { /* ignore faking errors */ });
        });
        it('should emit error and end if retry limit reached', async () => {
            // emulate connection failure
            (pgClient as any).connect = async () => {
                pgClient.emit('end');
            };

            try { await pubSub.connect(); } catch (err) {
                expect(err).to.be.instanceOf(Error);
                expect(err.message).equals(
                    `Connect failed after ${RETRY_LIMIT} retries...`,
                );
            }
        });
        it('should re-subscribe all channels', done => {
            pubSub.listen('TestOne');
            pubSub.listen('TestTwo');

            const spy = sinon.spy(pubSub, 'listen');

            pubSub.connect().then(() => pgClient.emit('end'));

            setTimeout(() => {
                expect(spy.calledTwice).to.be.true;
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

            expect(counter).equals(1);
        });
    });
    describe('listen()', () => {
        it('should call SQL LISTEN "channel" command', async () => {
            pubSub.options.singleListener = true;
            const spy = sinon.spy(pubSub.pgClient, 'query');
            await pubSub.listen('Test');
            const [{ args: [arg] }] = spy.getCalls();
            expect(/^LISTEN\s+"Test"/.test(arg.trim()));
        });
        it('should call SQL LISTEN "channel" command always', async () => {
            pubSub.options.singleListener = false;
            const spy = sinon.spy(pubSub.pgClient, 'query');
            await pubSub.listen('Test');
            const [{ args: [arg] }] = spy.getCalls();
            expect(/^LISTEN\s+"Test"/.test(arg.trim()));
        });
        it('should handle messages from db with acquired lock', done => {
            pubSub.options.singleListener = true;

            pubSub.listen('TestChannel').then(() => {
                pgClient.emit('notification', {
                    channel: 'TestChannel',
                    payload: 'true',
                });
            });

            pubSub.on('message', (chanel, message) => {
                expect(chanel).equals('TestChannel');
                expect(message).equals(true);
                done();
            });
        });
        it('should not handle messages from db with no lock', async () => {
            pubSub.options.singleListener = true;

            const spy = sinon.spy(pubSub, 'emit');

            await pubSub.listen('TestChannel');
            await (pubSub as any).locks.TestChannel.release();

            pgClient.emit('notification', {
                channel: 'TestChannel',
                payload: 'true',
            });

            await new Promise(resolve => setTimeout(resolve, 20));

            expect(spy.calledWith('message', 'TestChannel', true)).to.be.false;
        });
        it('should avoid handling lock channel messages', async () => {
            pubSub.options.singleListener = true;

            const spy = sinon.spy(pubSub, 'emit');
            const spyChannel = sinon.spy(pubSub.channels, 'emit');
            const channel = `__${PgIpLock.name}__:TestChannel`;

            await pubSub.listen('TestChannel');
            await pgClient.emit('notification', {
                channel,
                payload: 'true',
            });

            expect(spy.calledWithExactly(
                ['message', channel, true] as any,
            )).to.be.false;
            expect(spyChannel.called).to.be.false;
        });
    });
    describe('unlisten()', () => {
        it('should call SQL UNLISTEN "channel" command', async () => {
            pubSub.options.singleListener = true;
            const spy = sinon.spy(pubSub.pgClient, 'query');
            await pubSub.unlisten('Test');
            const [{ args: [arg] }] = spy.getCalls();
            expect(/^UNLISTEN\s+"Test"/.test(arg.trim()));
        });
        it('should call SQL UNLISTEN "channel" command always', async () => {
            pubSub.options.singleListener = false;
            const spy = sinon.spy(pubSub.pgClient, 'query');
            await pubSub.unlisten('Test');
            const [{ args: [arg] }] = spy.getCalls();
            expect(/^UNLISTEN\s+"Test"/.test(arg.trim()));
        });
        it('should destroy existing locks', async () => {
            await pubSub.listen('Test');
            const spy = sinon.spy((pubSub as any).locks.Test, 'destroy');
            expect(spy.called).to.be.false;
            await pubSub.unlisten('Test');
            expect(spy.called).to.be.true;
        });
    });
    describe('unlistenAll()', () => {
        it('should call SQL UNLISTEN * command', async () => {
            pubSub.options.singleListener = true;
            const spy = sinon.spy(pubSub.pgClient, 'query');
            await pubSub.unlistenAll();
            const [{ args: [arg] }] = spy.getCalls();
            expect(/^UNLISTEN\s+\*/.test(arg.trim()));
        });
        it('should call SQL UNLISTEN * command always', async () => {
            pubSub.options.singleListener = false;
            const spy = sinon.spy(pubSub.pgClient, 'query');
            await pubSub.unlistenAll();
            const [{ args: [arg] }] = spy.getCalls();
            expect(/^UNLISTEN\s+\*/.test(arg.trim()));
        });
    });
    describe('notify()', () => {
        it('should call SQL NOTIFY command', async () => {
            const spy = sinon.spy(pubSub.pgClient, 'query');
            await pubSub.notify('Test', { a: 'b' });
            const [{ args: [arg, ] }] = spy.getCalls();
            expect(arg.trim()).equals(`NOTIFY "Test", '{"a":"b"}'`);
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
        afterEach(async () => Promise.all([
            pubSub1.destroy(),
            pubSub2.destroy(),
            pubSub3.destroy(),
        ]));

        describe('activeChannels()', () => {
            it('should return active channels only', () => {
                expect(pubSub1.activeChannels()).to.have.same.members([
                    'ChannelOne', 'ChannelTwo',
                ]);
                expect(pubSub2.activeChannels()).to.have.same.members([
                    'ChannelThree', 'ChannelFour',
                ]);
                expect(pubSub3.activeChannels()).to.have.same.members([
                    'ChannelFive', 'ChannelSix',
                ]);
            });
        });
        describe('inactiveChannels()', () => {
            it('should return inactive channels only', () => {
                expect(pubSub1.inactiveChannels()).deep.equals([]);
                expect(pubSub2.inactiveChannels()).deep.equals([]);
                expect(pubSub3.inactiveChannels()).to.have.same.members([
                    'ChannelOne', 'ChannelTwo',
                ]);
            });
        });
        describe('allChannels()', () => {
            it('should return all channels', () => {
                expect(pubSub1.allChannels()).to.have.same.members([
                    'ChannelOne', 'ChannelTwo',
                ]);
                expect(pubSub2.allChannels()).to.have.same.members([
                    'ChannelThree', 'ChannelFour',
                ]);
                expect(pubSub3.allChannels()).to.have.same.members([
                    'ChannelOne', 'ChannelTwo',
                    'ChannelFive', 'ChannelSix',
                ]);
            });
        });
        describe('isActive()', () => {
            it('should return true if given channel is active', () => {
                expect(pubSub1.isActive('ChannelOne')).to.be.true;
                expect(pubSub1.isActive('ChannelTwo')).to.be.true;
                expect(pubSub2.isActive('ChannelThree')).to.be.true;
                expect(pubSub2.isActive('ChannelFour')).to.be.true;
                expect(pubSub3.isActive('ChannelFive')).to.be.true;
                expect(pubSub3.isActive('ChannelSix')).to.be.true;
            });
            it('should return false if given channel is not active', () => {
                expect(pubSub1.isActive('ChannelThree')).to.be.false;
                expect(pubSub1.isActive('ChannelFour')).to.be.false;
            });
            it('should return true if there is active channels', () => {
                expect(pubSub1.isActive()).to.be.true;
                expect(pubSub2.isActive()).to.be.true;
                expect(pubSub3.isActive()).to.be.true;
            });
            it('should return false if there are no active channels', () => {
                expect(pubSub.isActive()).to.be.false;
            });
        });
    });
    describe('release()', () => {
        it('should release all locks acquired', async () => {
            await pubSub.listen('One');
            await pubSub.listen('Two');

            const spies = [
                sinon.spy((pubSub as any).locks.One, 'release'),
                sinon.spy((pubSub as any).locks.Two, 'release'),
            ];

            await (pubSub as any).release();
            spies.forEach(spy => expect(spy.called).to.be.true);
        });
        it('should skip locks which was not acquired', async () => {
            await pubSub.listen('One');
            await pubSub.listen('Two');

            await (pubSub as any).locks.One.release();
            await (pubSub as any).locks.Two.release();

            const spies = [
                sinon.spy((pubSub as any).locks.One, 'release'),
                sinon.spy((pubSub as any).locks.Two, 'release'),
            ];

            await (pubSub as any).release();
            spies.forEach(spy => expect(spy.called).to.be.false);
        });
        it('should release only acquired locks', async () => {
            await pubSub.listen('One');
            await pubSub.listen('Two');

            await (pubSub as any).locks.One.release();

            const [one, two] = [
                sinon.spy((pubSub as any).locks.One, 'release'),
                sinon.spy((pubSub as any).locks.Two, 'release'),
            ];

            await (pubSub as any).release();

            expect(one.called).to.be.false;
            expect(two.called).to.be.true;
        });
    });
    describe('setProcessId()', () => {
        it('should set process id', async () => {
            const stub = sinon.stub(pgClient, 'query').resolves({
                rows: [{ pid: 7777 }],
            });
            await (pubSub as any).setProcessId();
            expect((pubSub as any).processId).equals(7777);
            stub.restore();
        });
        it('should filter messages if set and "filtered" option is set',
            async () => {
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

            expect(counter).equals(1);

            pubSub.options.filtered = true;
            pgClient.emit('notification', {
                processId: 7777,
                channel: 'Test',
                payload: 'true',
            });

            await new Promise(res => setTimeout(res));

            expect(counter).equals(1);
        });
    });
    describe('destroy()', () => {
        it('should properly handle destruction', async () => {
            const spies = [
                sinon.spy(pubSub, 'close'),
                sinon.spy(pubSub, 'removeAllListeners'),
                sinon.spy(pubSub.channels, 'removeAllListeners'),
                sinon.spy(PgIpLock, 'destroy'),
            ];
            await pubSub.destroy();
            spies.forEach(spy => {
                expect(spy.calledOnce).to.be.true;
                spy.restore();
            });
        });
    });
});
