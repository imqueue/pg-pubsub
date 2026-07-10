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
import { mock } from 'node:test';
import { Client } from './pg.js';

// the constants mock re-exports the real module (export *) and overrides a
// few timing values, so its full namespace is forwarded to the mock; a
// dynamic import captures it without listing every constant by hand
const constants = await import('./constants.js');
const pg = { Client };

// preloaded via `node --import ./test/mocks/index.js` so the mocks are
// registered before any test file graph links (see package.json scripts)
mock.module('pg', {
    cache: false,
    defaultExport: pg,
    namedExports: pg,
});
mock.module(new URL('../../src/constants.js', import.meta.url).href, {
    cache: false,
    defaultExport: constants,
    namedExports: constants,
});

const printError = console.error;

console.error = (...args: any[]) => {
    args = args.filter(arg => !(arg instanceof FakeError));

    if (args.length) {
        printError(...args);
    }
};

export class FakeError extends Error {}
