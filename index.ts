/*!
 * Copyright (c) 2018, imqueue.com <support@imqueue.com>
 *
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
/**
 * Reliable PostgreSQL LISTEN/NOTIFY for Node.js — with an inter-process lock so
 * a horizontally scaled service handles each notification once.
 *
 * Start from {@link PgPubSub}: construct it with {@link PgPubSubOptions},
 * subscribe channels inside its `'connect'` handler, and read messages from the
 * instance's `'message'` event or from the per-channel emitter on `channels`.
 *
 * @remarks
 * The problem this solves is that LISTEN/NOTIFY is a broadcast: every listening
 * connection receives every notification, so a service scaled to N replicas
 * handles each message N times. With `singleListener` on — the default — the
 * replicas compete for a per-channel lock held as a row in PostgreSQL, and only
 * the holder listens. The others stay connected as hot standbys.
 *
 * That makes delivery at-most-once, and the trade is worth stating plainly:
 * NOTIFY has no backlog, so anything published while no process holds the lock
 * is gone. A clean shutdown releases the lock and a standby takes over at once;
 * an unclean exit leaves the channel unhandled until the next retry, bounded by
 * `ACQUIRE_INTERVAL`. Payloads are also capped at 8000 bytes by PostgreSQL.
 * Where losing a message is unacceptable, pair this with a durable queue rather
 * than replacing one.
 *
 * @example
 * ```typescript
 * import { type AnyJson, PgPubSub } from '@imqueue/pg-pubsub';
 *
 * const pubSub = new PgPubSub({ connectionString: process.env.DB_URL });
 *
 * pubSub.on('connect', async () => {
 *     await pubSub.listen('UserChanged');
 * });
 * pubSub.on('message', (channel: string, payload: AnyJson) =>
 *     console.log(channel, payload),
 * );
 *
 * await pubSub.connect();
 * await pubSub.notify('UserChanged', { id: 1 });
 * ```
 *
 * @packageDocumentation
 */
export * from './src/index.js';
