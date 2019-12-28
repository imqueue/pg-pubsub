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
import { EventEmitter } from 'events';
import { Notification } from 'pg';

let id = 0;

export interface ClientConfig {
    connectionString?: string;
}

export class Client extends EventEmitter {
    public constructor(options: ClientConfig) {
        super();
        this.setMaxListeners(Infinity);
    }
    public connect() {
        this.emit('connect');
    }
    public end() {
        this.emit('end');
    }
    public async query(queryText: string) {
        if (/^NOTIFY\s/.test(queryText)) {
            let [, channel, payload] = queryText.split(/\s+/);

            channel = channel.replace(/",?/g, '');
            payload = payload.replace(/^'|'$/g, '');

            const message: Notification = {
                channel,
                payload,
                processId: ++id,
            };

            this.emit('notification', message);
            return ;
        }
        return { rows: [] };
    }
}

