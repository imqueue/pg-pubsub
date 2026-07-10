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
/**
 * Integration flows against a real PostgreSQL server. Run with:
 *   PG_TEST_DSN=postgres://user:pass@host:5432/db npm run test:integration
 * Requires a database user with DDL privileges (lock schema bootstrap).
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Client } from 'pg';
import { type AnyJson, PgPubSub } from '../../src/index.js';

const DSN =
    process.env.PG_TEST_DSN ||
    'postgres://postgres:postgres@localhost:5432/postgres';

const quiet = {
    log: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

function makePubSub(options: object = {}): PgPubSub {
    return new PgPubSub(
        {
            connectionString: DSN,
            retryDelay: 200,
            retryLimit: 20,
            acquireInterval: 300,
            ...options,
        } as any,
        quiet as any,
    );
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(
    check: () => boolean,
    timeout: number,
    label: string,
): Promise<void> {
    const started = Date.now();

    while (!check()) {
        if (Date.now() - started > timeout) {
            throw new Error(`Timed out waiting for ${label}`);
        }

        await sleep(50);
    }
}

function collect(pubSub: PgPubSub): AnyJson[] {
    const messages: AnyJson[] = [];

    pubSub.on('message', (_channel, payload) => messages.push(payload));

    return messages;
}

describe('integration: pg-pubsub against real PostgreSQL', () => {
    let admin: Client;

    before(async () => {
        admin = new Client({ connectionString: DSN });

        try {
            await admin.connect();
        } catch (err) {
            throw new Error(
                `Cannot connect to test database at ${DSN}: ${
                    (err as Error).message
                }. Set PG_TEST_DSN or start a local postgres.`,
            );
        }

        await admin.query('DROP SCHEMA IF EXISTS pgip_lock CASCADE');
        await admin.query('DROP SCHEMA IF EXISTS pgip_lock_unique CASCADE');
    });

    after(async () => {
        await admin.end();
    });

    it('should deliver published messages to a listener', async () => {
        const sub = makePubSub({ singleListener: false });
        const pub = makePubSub({ singleListener: false });

        try {
            await sub.connect();
            await pub.connect();
            await sub.listen('it_basic');

            const messages = collect(sub);

            await pub.notify('it_basic', { hello: 'world', n: 1 });
            await waitFor(() => messages.length > 0, 5000, 'message');

            assert.deepEqual(messages, [{ hello: 'world', n: 1 }]);
        } finally {
            await Promise.all([sub.destroy(), pub.destroy()]);
        }
    });

    it(
        'should allow only one active listener per channel and hand the ' +
            'channel over when the active listener is destroyed',
        async () => {
            const first = makePubSub({ singleListener: true });
            const second = makePubSub({ singleListener: true });
            const pub = makePubSub({ singleListener: false });

            try {
                await first.connect();
                await second.connect();
                await pub.connect();

                await first.listen('it_excl');
                await second.listen('it_excl');

                assert.equal(first.isActive('it_excl'), true);
                assert.equal(second.isActive('it_excl'), false);

                const firstSeen = collect(first);
                const secondSeen = collect(second);

                await pub.notify('it_excl', 1);
                await waitFor(
                    () => firstSeen.length > 0,
                    5000,
                    'first message',
                );
                await sleep(300);

                assert.equal(firstSeen.length, 1);
                assert.equal(secondSeen.length, 0);

                // handover: destroying the active listener must let the
                // standby acquire the channel (release trigger or re-acquire
                // interval)
                await first.destroy();
                await waitFor(
                    () => second.isActive('it_excl'),
                    10000,
                    'lock handover',
                );

                await pub.notify('it_excl', 2);
                await waitFor(
                    () => secondSeen.length > 0,
                    5000,
                    'takeover message',
                );

                assert.deepEqual(secondSeen, [2]);
            } finally {
                await Promise.all([second.destroy(), pub.destroy()]);
            }
        },
    );

    it(
        'should survive a server-side connection termination: recreate the ' +
            'client, re-listen and keep receiving',
        async () => {
            const sub = makePubSub({ singleListener: true });
            const pub = makePubSub({ singleListener: false });

            try {
                await sub.connect();
                await pub.connect();
                await sub.listen('it_reco');

                const messages = collect(sub);
                const reconnected = new Promise<void>(resolve =>
                    sub.once('reconnect', () => resolve()),
                );

                // pg clients are single-use: this flow proves the client is
                // recreated (the old one cannot re-connect at all)
                await admin.query(
                    `SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE application_name = $1`,
                    [(sub as any).pgClient.appName],
                );

                await Promise.race([
                    reconnected,
                    sleep(15000).then(() => {
                        throw new Error('Timed out waiting for reconnect');
                    }),
                ]);

                await waitFor(
                    () => sub.isActive('it_reco'),
                    10000,
                    're-listen',
                );

                await pub.notify('it_reco', { after: 'reconnect' });
                await waitFor(
                    () => messages.length > 0,
                    5000,
                    'post-reconnect',
                );

                assert.deepEqual(messages, [{ after: 'reconnect' }]);
            } finally {
                await Promise.all([sub.destroy(), pub.destroy()]);
            }
        },
    );

    it(
        'should process each message exactly once across execution-lock ' +
            'listeners',
        async () => {
            const options = {
                singleListener: true,
                executionLock: true,
            };
            const first = makePubSub(options);
            const second = makePubSub(options);
            const pub = makePubSub({ singleListener: false });

            try {
                await first.connect();
                await second.connect();
                await pub.connect();

                await first.listen('it_exec');
                await second.listen('it_exec');

                const firstSeen = collect(first);
                const secondSeen = collect(second);
                const total = 5;

                for (let i = 0; i < total; i++) {
                    await pub.notify('it_exec', i);
                }

                await waitFor(
                    () => firstSeen.length + secondSeen.length >= total,
                    10000,
                    'all messages',
                );
                await sleep(500);

                const all = [...firstSeen, ...secondSeen].sort();

                assert.equal(
                    firstSeen.length + secondSeen.length,
                    total,
                    `messages must be processed exactly once, got first=${JSON.stringify(
                        firstSeen,
                    )} second=${JSON.stringify(secondSeen)}`,
                );
                assert.deepEqual(all, [0, 1, 2, 3, 4]);
            } finally {
                await Promise.all([
                    first.destroy(),
                    second.destroy(),
                    pub.destroy(),
                ]);
            }
        },
    );

    it('should keep other instances working when one is destroyed', async () => {
        const one = makePubSub({ singleListener: true });
        const two = makePubSub({ singleListener: true });
        const pub = makePubSub({ singleListener: false });

        try {
            await one.connect();
            await two.connect();
            await pub.connect();

            await one.listen('it_iso_a');
            await two.listen('it_iso_b');

            const messages = collect(two);

            await one.destroy();

            assert.equal(two.isActive('it_iso_b'), true);

            await pub.notify('it_iso_b', 'still alive');
            await waitFor(() => messages.length > 0, 5000, 'message');

            assert.deepEqual(messages, ['still alive']);
        } finally {
            await Promise.all([two.destroy(), pub.destroy()]);
        }
    });

    it('should reject NOTIFY payloads above the postgres limit', async () => {
        const pub = makePubSub({ singleListener: false });

        try {
            await pub.connect();

            await assert.rejects(
                () => pub.notify('it_size', 'x'.repeat(9000)),
                RangeError,
            );
        } finally {
            await pub.destroy();
        }
    });
});
