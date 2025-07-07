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
import '../mocks';

import { expect } from 'chai';
import * as sinon from 'sinon';
import { AnyLogger, pack, unpack } from '../..';

describe('helpers', () => {
    // mock logger
    const logger: AnyLogger = {
        log:   (...args: any[]) => console.log(...args),
        info:  (...args: any[]) => console.info(...args),
        warn:  (...args: any[]) => console.warn(...args),
        error: (...args: any[]) => console.error(...args),
    };

    describe('pack()', () => {
        it('should not throw, but log warn on serialization error', () => {
            const spy = sinon.stub(logger, 'warn');
            expect(() => pack(global as any)).to.not.throw;
            pack(global as any, logger);
            expect(spy.called).to.be.true;
            spy.restore();
        });
        it('should return serialized null value on error', () => {
            expect(pack(global as any)).equals('null');
        });
        it('should correctly pack serializable', () => {
            expect(pack({})).equals('{}');
            expect(pack([])).equals('[]');
            expect(pack({a: 1})).equals('{"a":1}');
            expect(pack({a: '1'})).equals('{"a":"1"}');
            expect(pack(null)).equals('null');
            expect(pack(undefined as any)).equals('null');
            expect(pack(true)).equals('true');
        });
        it('should be able to pretty print', () => {
            const obj = { one: { two: 'three' } };
            expect(pack(obj, logger, true)).equals(
                `{\n  "one": {\n    "two": "three"\n  }\n}`
            );
        });
    });

    describe('unpack()', () => {
        it('should not throw, but log warn on deserialization', () => {
            const spy = sinon.stub(logger, 'warn');
            expect(() => unpack('unterminated string')).to.not.throw;
            unpack('unterminated string', logger);
            expect(spy.called).to.be.true;
            spy.restore();
        });
        it('should return empty object on error', () => {
            expect(unpack('unterminated string')).deep.equals({});
        });
        it('should properly unpack serializable', () => {
            expect(unpack('{}')).deep.equals({});
            expect(unpack('[]')).deep.equals([]);
            expect(unpack('{"a":1}')).deep.equals({a: 1});
            expect(unpack('{"a":"1"}')).deep.equals({ a: '1'});
            expect(unpack('null')).equals(null);
            expect(unpack('true')).equals(true);
            expect(unpack('123.55')).equals(123.55);
        });
        it('should return null on non-string or undefined input', () => {
            expect(unpack()).to.be.null;
            expect(unpack(global as any)).to.be.null;
        });
    });
});
