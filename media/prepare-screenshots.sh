#!/bin/sh
base="./screenshots/iphone"
out="./out/screenshots/iphone"
size='1242x2208'
rm -rf "$out"
mkdir './out/screenshots'
mkdir "$out"

convert "${base}/image1.png" -resize ${size}\! "${out}/image1-lg.png"
convert "${base}/image2.png" -resize ${size}\! "${out}/image2-lg.png"
convert "${base}/image3.png" -resize ${size}\! "${out}/image3-lg.png"
convert "${base}/image4.png" -resize ${size}\! "${out}/image4-lg.png"
convert "${base}/image5.png" -resize ${size}\! "${out}/image5-lg.png"

base="./screenshots/ipad"
out="./out/screenshots/ipad"
size='2048x2732'
mkdir "$out"

convert "${base}/image1.png" -resize ${size}\! "${out}/image1-lg.png"
convert "${base}/image2.png" -resize ${size}\! "${out}/image2-lg.png"
convert "${base}/image3.png" -resize ${size}\! "${out}/image3-lg.png"
convert "${base}/image4.png" -resize ${size}\! "${out}/image4-lg.png"
convert "${base}/image5.png" -resize ${size}\! "${out}/image5-lg.png"