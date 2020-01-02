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
import { PgPubSub } from '@imqueue/pg-pubsub';
import Timer = NodeJS.Timer;

let timer: Timer;
const NOTIFY_DELAY = 2000;
const CHANNEL = 'HelloChannel';

/**
 * This is minimalistic example of NOTIFY/LISTEN with @imqueue/pg-pubsub with
 * filtering option set.
 * In this example all running copies of the app will listen and notify
 * to the same HelloChannel with no locking but with filtering. So everything is
 * emitted by every process will be caught and handle by each running process,
 * except the messages notified by the same process.
 */
const pubSub = new PgPubSub({
    connectionString: 'postgres://postgres@localhost:5432/postgres',
    singleListener: false,
    filtered: true,
});

pubSub.on('listen', channel => console.info(`Listening to ${channel}...`));
pubSub.on('connect', async () => {
    console.info('Database connected!');
    await pubSub.listen(CHANNEL);
    timer = setInterval(async () => {
        await pubSub.notify(CHANNEL, { hello: { from: process.pid } });
    }, NOTIFY_DELAY);
});
pubSub.on('notify', channel => console.log(`${channel} notified`));
pubSub.on('end', () => console.warn('Connection closed!'));
pubSub.channels.on(CHANNEL, console.log);
pubSub.connect().catch(err => console.error('Connection error:', err));
