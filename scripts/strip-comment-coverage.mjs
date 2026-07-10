/*!
 * Coverage post-processor
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
 * Node's built-in coverage (`--experimental-test-coverage --enable-source-maps`)
 * reports every non-code line of a `.ts` source as uncovered, because comment
 * and blank lines have no source-map mappings and therefore fall outside every
 * covered V8 byte-range. That paints the license header and each JSDoc block
 * red in the HTML report and pushes per-file line% far below reality.
 *
 * Node's reporter also emits records that the (strict) genhtml LCOV 2.x tool
 * rejects — function entries with `undefined` line numbers or synthetic,
 * duplicated names (`<instance_members_initializer>`, and decorated methods all
 * mis-named `has`/`get`), plus `BRDA:undefined,...` branch records. Left in,
 * they produce a wall of warnings and a fatal "unexpected category" error.
 *
 * This script rewrites an lcov file in place: it drops the `DA`/`BRDA` records
 * for lines that contain no executable code (comments and blank lines), drops
 * all function records and malformed branch records, then recomputes the
 * `LF`/`LH`/`BRF`/`BRH` totals. It uses the TypeScript scanner (already a dev
 * dependency) to locate comments reliably — comment markers inside strings,
 * template literals and regexes are not misdetected. The result renders in
 * genhtml with accurate line + branch coverage and no warnings or errors.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
// TypeScript 7 (native port) no longer exposes the classic compiler API from
// the package root — the lightweight scanner/AST primitives live under the
// `typescript/unstable/ast` entry point (createSourceFile is gone entirely, so
// import spans are located with the scanner rather than a parsed AST).
import * as ts from 'typescript/unstable/ast';

const lcovPath = process.argv[2] || 'coverage/lcov.info';

if (!existsSync(lcovPath)) {
    console.warn(`strip-comment-coverage: ${lcovPath} not found, skipping`);
    process.exit(0);
}

/**
 * Returns the set of 1-based line numbers in the given source that hold no
 * executable code — i.e. blank lines and lines whose only content is a comment.
 *
 * @param {string} text
 * @returns {Set<number>}
 */
function nonCodeLines(text) {
    const commentChars = new Uint8Array(text.length);
    const scanner = ts.createScanner(
        ts.ScriptTarget.Latest,
        /* skipTrivia */ false,
        ts.LanguageVariant.Standard,
    );

    scanner.setText(text);

    let token = scanner.scan();

    while (token !== ts.SyntaxKind.EndOfFile) {
        if (
            token === ts.SyntaxKind.SingleLineCommentTrivia ||
            token === ts.SyntaxKind.MultiLineCommentTrivia
        ) {
            const start = scanner.getTokenStart();
            const end = scanner.getTokenEnd();

            for (let i = start; i < end; i++) {
                commentChars[i] = 1;
            }
        }

        token = scanner.scan();
    }

    const lines = text.split('\n');
    const result = new Set();
    let pos = 0;

    for (let ln = 0; ln < lines.length; ln++) {
        const line = lines[ln];
        let hasCode = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];

            if (ch === ' ' || ch === '\t' || ch === '\r') {
                continue;
            }

            if (!commentChars[pos + i]) {
                hasCode = true;
                break;
            }
        }

        if (!hasCode) {
            result.add(ln + 1);
        }

        pos += line.length + 1; // account for the split '\n'
    }

    return result;
}

/**
 * Returns the set of 1-based lines occupied by top-level import statements.
 * Imports compile to `require(...)` that runs on module load, so they are
 * always executed, yet Node's source-mapped coverage frequently mis-reports
 * them as uncovered (the mapping lands outside the covered byte-range). Treating
 * them as non-coverable corrects that artifact rather than hiding real logic.
 *
 * @param {string} text
 * @returns {Set<number>}
 */
function importLines(text) {
    // TypeScript 7 dropped `createSourceFile`, so top-level import statements are
    // located with the scanner: a top-level `import` keyword (depth 0, not the
    // dynamic `import(...)` call nor `import.meta`) begins a declaration whose
    // span reaches the terminating semicolon — both `import ... from '...'` and
    // `import x = require('...')` end that way in this codebase.
    const scanner = ts.createScanner(
        ts.ScriptTarget.Latest,
        /* skipTrivia */ true,
        ts.LanguageVariant.Standard,
    );

    scanner.setText(text);

    const lineStarts = ts.computeLineStarts(text);
    // 0-based line holding `pos`: largest index with lineStarts[i] <= pos
    const lineOf = pos => {
        let lo = 0;
        let hi = lineStarts.length - 1;

        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;

            if (lineStarts[mid] <= pos) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }

        return lo;
    };

    const K = ts.SyntaxKind;
    const result = new Set();
    let depth = 0;
    let token = scanner.scan();

    while (token !== K.EndOfFile) {
        if (
            token === K.OpenBraceToken ||
            token === K.OpenParenToken ||
            token === K.OpenBracketToken
        ) {
            depth++;
        } else if (
            token === K.CloseBraceToken ||
            token === K.CloseParenToken ||
            token === K.CloseBracketToken
        ) {
            depth--;
        } else if (depth === 0 && token === K.ImportKeyword) {
            const start = scanner.getTokenStart();
            let next = scanner.scan();

            // `import(...)` dynamic call or `import.meta` — not a declaration
            if (next === K.OpenParenToken || next === K.DotToken) {
                token = next;
                continue;
            }

            // consume to the terminating semicolon at bracket depth 0
            let inner = 0;
            let end = scanner.getTokenEnd();

            while (next !== K.EndOfFile) {
                if (next === K.OpenBraceToken || next === K.OpenParenToken) {
                    inner++;
                } else if (
                    next === K.CloseBraceToken ||
                    next === K.CloseParenToken
                ) {
                    inner--;
                } else if (next === K.SemicolonToken && inner === 0) {
                    end = scanner.getTokenEnd();
                    break;
                }

                end = scanner.getTokenEnd();
                next = scanner.scan();
            }

            for (let line = lineOf(start); line <= lineOf(end); line++) {
                result.add(line + 1);
            }

            token = scanner.scan();
            continue;
        }

        token = scanner.scan();
    }

    return result;
}

const B64 =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64MAP = new Map([...B64].map((c, i) => [c, i]));

/**
 * Decodes one base64 VLQ source-map segment into its integer fields.
 *
 * @param {string} seg
 * @returns {number[]}
 */
function decodeVLQ(seg) {
    const out = [];
    let shift = 0;
    let value = 0;

    for (const ch of seg) {
        const digit = B64MAP.get(ch);

        if (digit === undefined) {
            break;
        }

        value += (digit & 31) << shift;

        if (digit & 32) {
            shift += 5;
        } else {
            out.push(value & 1 ? -(value >> 1) : value >> 1);
            value = 0;
            shift = 0;
        }
    }

    return out;
}

/**
 * Returns the set of 1-based source lines that produced generated JavaScript,
 * read from the file's `.js.map`. These are exactly the coverable lines — every
 * other line (comments, blanks, type-only declarations, interfaces) emits no
 * code and can never be executed. Returns null when no source map is present.
 *
 * @param {string} sourceFile - path of the .ts source (e.g. src/RedisQueue.ts)
 * @returns {Set<number> | null}
 */
function emittedLines(sourceFile) {
    const mapPath = sourceFile.replace(/\.ts$/, '.js.map');

    if (!existsSync(mapPath)) {
        return null;
    }

    let map;

    try {
        map = JSON.parse(readFileSync(mapPath, 'utf8'));
    } catch {
        return null;
    }

    if (typeof map.mappings !== 'string') {
        return null;
    }

    const lines = new Set();
    let srcIndex = 0;
    let srcLine = 0;

    for (const group of map.mappings.split(';')) {
        for (const seg of group.split(',')) {
            if (!seg) {
                continue;
            }

            const fields = decodeVLQ(seg);

            // [genCol, srcIndex, srcLine, srcCol, nameIndex]; <4 fields = no
            // source position for this segment
            if (fields.length >= 4) {
                srcIndex += fields[1];
                srcLine += fields[2];

                if (srcIndex === 0) {
                    lines.add(srcLine + 1); // map lines are 0-based
                }
            }
        }
    }

    return lines;
}

const coverableCache = new Map();

/**
 * Resolves how to filter a source file's line records:
 *   - `{ mode: 'keep', set }` — keep only lines in `set` (source-map driven);
 *   - `{ mode: 'drop', set }` — drop lines in `set` (comment-scanner fallback).
 *
 * @param {string} sourceFile
 * @returns {{ mode: 'keep' | 'drop', set: Set<number> }}
 */
function coverableInfo(sourceFile) {
    if (coverableCache.has(sourceFile)) {
        return coverableCache.get(sourceFile);
    }

    const emitted = sourceFile ? emittedLines(sourceFile) : null;
    let info;

    if (emitted && existsSync(sourceFile)) {
        // A line is coverable only if it emitted JS (has a source-map mapping)
        // AND is not a comment/blank AND is not an import statement. The comment
        // check is required because `removeComments: false` keeps license/JSDoc
        // comments in the output, so they carry mappings too; the mapping check
        // drops type-only lines (interfaces, type aliases) which emit nothing;
        // the import check drops the mis-mapped import artifact.
        const text = readFileSync(sourceFile, 'utf8');
        const nonCode = nonCodeLines(text);
        const imports = importLines(text);
        const keep = new Set(
            [...emitted].filter(
                line => !nonCode.has(line) && !imports.has(line),
            ),
        );
        info = { mode: 'keep', set: keep };
    } else if (sourceFile && existsSync(sourceFile)) {
        const text = readFileSync(sourceFile, 'utf8');
        const skip = nonCodeLines(text);

        for (const line of importLines(text)) {
            skip.add(line);
        }

        info = { mode: 'drop', set: skip };
    } else {
        info = { mode: 'drop', set: new Set() };
    }

    coverableCache.set(sourceFile, info);

    return info;
}

let strippedLines = 0;

/**
 * Rewrites a single lcov record so that genhtml accepts it without warnings or
 * errors. It:
 *   - drops DA/BRDA entries on non-code (comment/blank) lines;
 *   - drops all function records (FN/FNDA/FNF/FNH) — Node's source-mapped
 *     function detection is unreliable here (undefined line numbers, mis-named
 *     and duplicated entries), which genhtml rejects, so line + branch coverage
 *     is kept instead;
 *   - drops malformed branch records such as `BRDA:undefined,...`;
 *   - recomputes the LF/LH/BRF/BRH totals.
 *
 * @param {string[]} recordLines - record body, excluding the end_of_record line
 * @returns {string}
 */
function processRecord(recordLines) {
    const sfLine = recordLines.find(line => line.startsWith('SF:'));
    const sourceFile = sfLine ? sfLine.slice(3).trim() : '';
    const info = coverableInfo(sourceFile);

    // true when a source line produces no executable code and must be dropped
    const drop = n => (info.mode === 'keep' ? !info.set.has(n) : info.set.has(n));

    let lf = 0;
    let lh = 0;
    let brf = 0;
    let brh = 0;

    const kept = recordLines.filter(line => {
        // drop all function records — unreliable under source maps
        if (/^(FN:|FNDA:|FNF:|FNH:)/.test(line)) {
            return false;
        }

        const da = line.match(/^DA:(\d+),(\d+)/);

        if (da) {
            if (drop(+da[1])) {
                strippedLines++;

                return false;
            }

            lf++;

            if (+da[2] > 0) {
                lh++;
            }

            return true;
        }

        if (line.startsWith('BRDA:')) {
            const brda = line.match(/^BRDA:(\d+),\d+,\d+,(\d+|-)$/);

            // drop malformed (e.g. BRDA:undefined,...) or non-code branches
            if (!brda || drop(+brda[1])) {
                return false;
            }

            brf++;

            if (brda[2] !== '-' && +brda[2] > 0) {
                brh++;
            }

            return true;
        }

        // drop the old totals — they are recomputed below
        return !/^(LF|LH|BRF|BRH):/.test(line);
    });

    return (
        `${kept.join('\n')}\n` +
        `LF:${lf}\nLH:${lh}\nBRF:${brf}\nBRH:${brh}\nend_of_record\n`
    );
}

const output = [];
let record = [];

for (const line of readFileSync(lcovPath, 'utf8').split('\n')) {
    if (line === 'end_of_record') {
        output.push(processRecord(record));
        record = [];
    } else if (line !== '') {
        record.push(line);
    }
}

writeFileSync(lcovPath, output.join(''));
console.info(
    `strip-comment-coverage: removed ${strippedLines} comment/blank line ` +
        `entries from ${lcovPath}`,
);
