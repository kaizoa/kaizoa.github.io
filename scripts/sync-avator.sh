#! /bin/bash -e

cd $(dirname $0)/..
mkdir tmp

curl -s -L https://github.com/kaizoa.png -o src/images/profile.png

convert src/images/profile.png \
-thumbnail 180x180^ -gravity center \
-extent 180x180 \
\( -size 180x180 xc:none -fill white -draw 'circle 90,90 90,0' \) \
-compose CopyOpacity \
-composite src/images/profile-circle.png
