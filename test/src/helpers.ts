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
