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
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stub as makeStub } from './mocks/spy.js';
import './mocks/index.js';

import { type AnyLogger, pack, unpack } from '../index.js';

describe('helpers', () => {
    // mock logger
    const logger: AnyLogger = {
        log: (...args: any[]) => console.log(...args),
        info: (...args: any[]) => console.info(...args),
        warn: (...args: any[]) => console.warn(...args),
        error: (...args: any[]) => console.error(...args),
    };

    describe('pack()', () => {
        it('should not throw, but log warn on serialization error', () => {
            const spy = makeStub(logger, 'warn');
            assert.doesNotThrow(() => pack(global as any));
            pack(global as any, logger);
            assert.equal(spy.called, true);
            spy.restore();
        });
        it('should return serialized null value on error', () => {
            assert.equal(pack(global as any), 'null');
        });
        it('should correctly pack serializable', () => {
            assert.equal(pack({}), '{}');
            assert.equal(pack([]), '[]');
            assert.equal(pack({ a: 1 }), '{"a":1}');
            assert.equal(pack({ a: '1' }), '{"a":"1"}');
            assert.equal(pack(null), 'null');
            assert.equal(pack(undefined as any), 'null');
            assert.equal(pack(true), 'true');
        });
        it('should be able to pretty print', () => {
            const obj = { one: { two: 'three' } };
            assert.equal(
                pack(obj, logger, true),
                `{\n  "one": {\n    "two": "three"\n  }\n}`,
            );
        });
    });

    describe('unpack()', () => {
        it('should not throw, but log warn on deserialization', () => {
            const spy = makeStub(logger, 'warn');
            assert.doesNotThrow(() => unpack('unterminated string'));
            unpack('unterminated string', logger);
            assert.equal(spy.called, true);
            spy.restore();
        });
        it('should return empty object on error', () => {
            assert.deepEqual(unpack('unterminated string'), {});
        });
        it('should properly unpack serializable', () => {
            assert.deepEqual(unpack('{}'), {});
            assert.deepEqual(unpack('[]'), []);
            assert.deepEqual(unpack('{"a":1}'), { a: 1 });
            assert.deepEqual(unpack('{"a":"1"}'), { a: '1' });
            assert.equal(unpack('null'), null);
            assert.equal(unpack('true'), true);
            assert.equal(unpack('123.55'), 123.55);
        });
        it('should return null on non-string or undefined input', () => {
            assert.equal(unpack(), null);
            assert.equal(unpack(global as any), null);
        });
    });
});
