#!/usr/bin/env node
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
const glob = require('glob').sync;
const fs = require('fs');
const path = require('path');

const map = (glob(`${__dirname}/../src/**`) || []).reduce((acc, next) => {
    if (fs.statSync(next).isDirectory()) {
        return acc;
    }

    const name = path.basename(next).replace('.ts', '.md');

    acc[name.toLowerCase()] = name;

    return acc;
}, {});

Object.assign(map, {
    'jsonarray.md': 'JsonArray.md',
    'jsonmap.md': 'JsonMap.md',
});

(glob(`${__dirname}/../wiki/**`) || []).forEach(file => {
    if (fs.statSync(file).isDirectory()) {
        return ;
    }

    const name = path.basename(file);
    const dir = path.dirname(file);
    const opts = { encoding: 'utf8' };
    let content = fs.readFileSync(file, opts);

    for (const name of Object.keys(map)) {
        const rx = new RegExp(name.replace('.', '\.'), 'g');
        content = content.replace(rx, map[name]);
    }

    fs.writeFileSync(file, content, opts);

    if (map[name]) {
        fs.renameSync(file, `${dir}/${map[name]}`);
    }
});
