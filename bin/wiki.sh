#!/bin/bash

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
    line=$(sed "s|^./||" <<< $line)
    trimmedLine=$(sed "s|.*/||" <<< $line)
    sed -i '' -e "s|${line}|${trimmedLine}|" *
    sed -i '1d;2d' $(basename "${line}")
done <<< "$originalPaths"

sed -i '1d;2d' globals.md
mv globals.md Home.md

# Strip out .md from raw text to support Github Wiki
sed -i '' -e 's/.md//' *
rm -f README.md

# Return to <project>
cd ../

# Clone Wiki Repo
cd ../
if [ -d pg-pubsub.wiki ]; then
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
