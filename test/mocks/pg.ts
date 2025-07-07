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
import { EventEmitter } from 'events';
import { Notification } from 'pg';

let id = 0;

export interface ClientConfig {
    connectionString?: string;
}

// noinspection JSUnusedGlobalSymbols
export class Client extends EventEmitter {
    // noinspection JSUnusedGlobalSymbols,JSUnusedLocalSymbols
    public constructor(options: ClientConfig) {
        super();
        this.setMaxListeners(Infinity);
    }
    public connect() {
        this.emit('connect');
    }
    // noinspection JSUnusedGlobalSymbols
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

