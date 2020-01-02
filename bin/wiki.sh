#!/bin/bash
# ISC License
#
# Copyright (c) 2019-present, imqueue.com <support@imqueue.com>
#
# Permission to use, copy, modify, and/or distribute this software for any
# purpose with or without fee is hereby granted, provided that the above
# copyright notice and this permission notice appear in all copies.
#
# THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
# WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
# MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
# ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
# WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
# ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
# OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
# Update docs
npm run wiki

# Flatten docs structure
cd wiki
originalPaths=$(find  . -mindepth 2 -type f)
find  . -mindepth 2 -type f -exec mv {} . \;
find . -type d -empty -delete

# Strip out folder structure from links to support Github Wiki
while read -r line; do
    # Remove leading ./ from each file name
    line=$(sed "s|^./||" <<< ${line})
    trimmedLine=$(sed "s|.*/||" <<< ${line})
    sed -i '' -e "s|${line}|${trimmedLine}|" *
    sed -i '1d;2d' $(basename "${line}")
done <<< "$originalPaths"

rm -f README.md

# Strip out .md from raw text to support Github Wiki
sed -i -e 's/.md//' *

sed -i '1d;2d' globals.md
sed -i "s/globals#/#/g" globals.md
mv globals.md Home.md

# Return to <project>
cd ../

# Clone Wiki Repo
cd ../
if [[ -d pg-pubsub.wiki ]]; then
  cd pg-pubsub.wiki
  git pull
  cd ../
else
  git clone https://github.com/imqueue/pg-pubsub.wiki
fi

# Copy docs into wiki repo
cp -a pg-pubsub/wiki/. pg-pubsub.wiki

# Create commit and push in wiki repo
cd pg-pubsub.wiki
git add -A
git commit -m "Wiki docs update"
git push

cd ../pg-pubsub
npm run clean
