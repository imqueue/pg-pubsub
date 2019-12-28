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
import { PgClient, PgIpLock, PgPubSub } from '../../src';

before(() => process.setMaxListeners(1000));

describe('PgPubSub', () => {
    let pgClient: Client;
    let pubSub: PgPubSub;

    beforeEach(() => {
        pgClient = new Client();
        pubSub = new PgPubSub({ pgClient });
    });

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

            pubSub.on('connect', () => counter++);
            pubSub.connect().then(() => pgClient.emit('end'));

            setTimeout(() => {
                expect(counter).equals(2);
                done();
            }, 210);
        });
        it('should emit error and end if retry limit reached', done => {
            let err: Error;

            pubSub.options.retryLimit = 3;
            // emulate connection failure
            pubSub.connect = async () => {
                pgClient.once('end', (pubSub as any).reconnect);
                pgClient.emit('end');
            };
            pubSub.on('error', e => (err = e));
            pubSub.connect();

            setTimeout(() => {
                expect(err).to.be.instanceOf(Error);
                expect(err).to.match(/failed after 3 retries/);
                done();
            }, 500);
        });
        it('should re-subscribe all channels', done => {
            let counter = 0;

            pubSub.listen('TestOne');
            pubSub.listen('TestTwo');

            const spy = sinon.spy(pubSub, 'listen');

            pubSub.on('connect', () => counter++);
            pubSub.connect().then(() => pgClient.emit('end'));

            setTimeout(() => {
                expect(spy.calledTwice).to.be.true;
                done();
            }, 210);
        });
    });
    describe('close()', () => {
        it('should not reconnect if called', done => {
            let counter = 0;

            pubSub.on('connect', () => counter++);
            pubSub.connect().then(() => pubSub.close());

            setTimeout(() => {
                expect(counter).equals(1);
                done();
            }, 210);
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
        it('should not handle messages from db with no lock', done => {
            pubSub.options.singleListener = true;

            const spy = sinon.spy(pubSub, 'emit');

            pubSub.listen('TestChannel').then(() => {
                (pubSub as any).locks.TestChannel.release();

                pgClient.emit('notification', {
                    channel: 'TestChannel',
                    payload: 'true',
                });

                setTimeout(() => {
                    expect(spy.calledWith('message', 'TestChannel', true))
                        .to.be.false;
                    done();
                }, 100);
            });
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
            await new Promise(resolve => setTimeout(resolve, 10));
        });

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
