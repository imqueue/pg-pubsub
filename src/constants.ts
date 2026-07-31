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
/**
 * PostgreSQL schema holding the inter-process lock table, read from
 * `PG_PUBSUB_SCHEMA_NAME` and defaulting to `pgip_lock`.
 *
 * Every process competing for the same channel must agree on this name — the
 * lock is a row in that schema, so two deployments configured differently would
 * each elect their own listener and both would handle the same notification.
 */
export const SCHEMA_NAME = process.env.PG_PUBSUB_SCHEMA_NAME || 'pgip_lock';

/**
 * How long, in milliseconds, {@link (PgPubSub:class).destroy} waits for a graceful
 * shutdown before giving up. Read from `PG_PUBSUB_SHUTDOWN_TIMEOUT`, default
 * 1000.
 *
 * The wait matters because releasing a lock cleanly is what lets a standby take
 * over immediately: the release deletes the lock row, which fires a NOTIFY the
 * waiting processes are listening for. A shutdown that is killed before the
 * release completes falls back to {@link ACQUIRE_INTERVAL} instead.
 */
export const SHUTDOWN_TIMEOUT = +(
    process.env.PG_PUBSUB_SHUTDOWN_TIMEOUT || 1000
);

/**
 * Delay in milliseconds between reconnect attempts after the PostgreSQL
 * connection drops.
 */
export const RETRY_DELAY = 100;

/**
 * How many reconnect attempts to make before emitting `'error'` and giving up.
 * `Infinity` by default, so a client reconnects indefinitely and survives a
 * database restart without supervision.
 */
export const RETRY_LIMIT = Infinity;

/**
 * Default for `PgPubSubOptions.singleListener` — on.
 *
 * With it on, an inter-process lock elects exactly ONE process to receive each
 * channel's notifications, which is what makes scaling out safe: LISTEN/NOTIFY
 * delivers to every listening connection, so without the lock every replica
 * handles every message. Turn it off only when you genuinely want a broadcast to
 * all replicas.
 */
export const IS_ONE_PROCESS = true;

/**
 * How often, in milliseconds, a process without the lock retries acquiring it.
 * Default 30000.
 *
 * This is the failover bound, and it is asymmetric. A clean shutdown releases the
 * lock and the waiting processes are notified at once, so takeover is
 * near-immediate. But if the lock holder dies WITHOUT releasing — SIGKILL, a lost
 * container, a hard crash — nothing notifies anyone, and the channel stays
 * unhandled until the next retry fires. Any notification published in that
 * window is lost outright, because LISTEN/NOTIFY has no backlog to replay.
 *
 * So this value is the worst-case gap in message handling after an unclean exit.
 * Lower it if that gap matters more than the polling cost of the extra lock
 * acquisition attempts.
 */
export const ACQUIRE_INTERVAL = 30000;

/**
 * Default for `PgPubSubOptions.executionLock` — off. Enable with
 * `PG_PUBSUB_EXECUTION_LOCK`.
 *
 * When on, a message is de-duplicated by CONTENT rather than by listener: a
 * marker row is written for each handled payload, and an identical payload
 * arriving again within {@link UNIQUE_LOCK_TTL} is skipped. That protects against
 * duplicate publication, but it also means two legitimately identical
 * notifications collapse into one — which is a correctness problem if your
 * payloads are not unique.
 */
export const EXECUTION_LOCK = !!+(process.env.PG_PUBSUB_EXECUTION_LOCK || 0);

/**
 * Time-to-live (seconds) of processed-message markers created by
 * execution locks; expired markers are cleaned up on subsequent unique
 * lock acquisitions
 */
export const UNIQUE_LOCK_TTL = 3600;
