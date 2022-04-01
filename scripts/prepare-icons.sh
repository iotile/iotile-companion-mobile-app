#!/bin/sh

# This script automatically generates all necessary Icons for both 
# Android and iOS. It assumes /media/icon.png is the master File
# and generates all converted files under /media/out.
# It also then copies all those files into the /resources directory
#
# Files can also be manually copied to an existinc Xcode project:
#      platforms/ios/IOTile/Images.xcassets/AppIcon.appiconset

base="./media/icon.png"
out="./media/out"
rm -rf $out
mkdir $out
mkdir "${out}/ios"
mkdir "${out}/android"

convert "$base" -resize '20x20'     -unsharp 1x4 "${out}/ios/icon-20.png"
convert "$base" -resize '40x40'     -unsharp 1x4 "${out}/ios/icon-20@2x.png"
convert "$base" -resize '60x60'     -unsharp 1x4 "${out}/ios/icon-20@3x.png"
cp "${out}/ios/icon-20@2x.png" "${out}/ios/icon-20@2x-1.png"

convert "$base" -resize '29x29'     -unsharp 1x4 "${out}/ios/icon-29.png"
convert "$base" -resize '58x58'     -unsharp 1x4 "${out}/ios/icon-29@2x.png"
convert "$base" -resize '87x87'     -unsharp 1x4 "${out}/ios/icon-29@3x.png"
cp "${out}/ios/icon-29.png" "${out}/ios/icon-small.png"
cp "${out}/ios/icon-29@2x.png" "${out}/ios/icon-small@2x.png"
cp "${out}/ios/icon-29@3x.png" "${out}/ios/icon-small@3x.png"

convert "$base" -resize '40x40'     -unsharp 1x4 "${out}/ios/icon-40.png"
convert "$base" -resize '80x80'     -unsharp 1x4 "${out}/ios/icon-40@2x.png"
convert "$base" -resize '120x120'   -unsharp 1x4 "${out}/ios/icon-40@3x.png"

convert "$base" -resize '50x50'     -unsharp 1x4 "${out}/ios/icon-50.png"
convert "$base" -resize '100x100'   -unsharp 1x4 "${out}/ios/icon-50@2x.png"

convert "$base" -resize '57x57'     -unsharp 1x4 "${out}/ios/icon-57.png"
convert "$base" -resize '114x114'   -unsharp 1x4 "${out}/ios/icon-57@2x.png"
# cp "${out}/ios/icon-57.png" "${out}/ios/icon.png"
# cp "${out}/ios/icon-57@2x.png" "${out}/ios/icon@2x.png"

convert "$base" -resize '60x60'     -unsharp 1x4 "${out}/ios/icon-60.png"
convert "$base" -resize '120x120'   -unsharp 1x4 "${out}/ios/icon-60@2x.png"
convert "$base" -resize '180x180'   -unsharp 1x4 "${out}/ios/icon-60@3x.png"

convert "$base" -resize '72x72'     -unsharp 1x4 "${out}/ios/icon-72.png"
convert "$base" -resize '144x144'   -unsharp 1x4 "${out}/ios/icon-72@2x.png"

convert "$base" -resize '83.5x83.5' -unsharp 1x4 "${out}/ios/icon-83.5.png"
convert "$base" -resize '167x167'   -unsharp 1x4 "${out}/ios/icon-83.5@2x.png"

convert "$base" -resize '76x76'     -unsharp 1x4 "${out}/ios/icon-76.png"
convert "$base" -resize '152x152'   -unsharp 1x4 "${out}/ios/icon-76@2x.png"

convert "$base" -resize '512x512'   -unsharp 1x4 "${out}/ios/iTunesArtwork"
convert "$base" -resize '1024x1024' -unsharp 1x4 "${out}/ios/iTunesArtwork@2x"

convert "$base" -resize '36x36'     -unsharp 1x4 "${out}/android/Icon-ldpi.png"
convert "$base" -resize '48x48'     -unsharp 1x4 "${out}/android/Icon-mdpi.png"
convert "$base" -resize '72x72'     -unsharp 1x4 "${out}/android/Icon-hdpi.png"
convert "$base" -resize '96x96'     -unsharp 1x4 "${out}/android/Icon-xhdpi.png"
convert "$base" -resize '144x144'   -unsharp 1x4 "${out}/android/Icon-xxhdpi.png"
convert "$base" -resize '192x192'   -unsharp 1x4 "${out}/android/Icon-xxxhdpi.png"

rm -f resources/ios/icon/*.png
cp ${out}/ios/icon*.png resources/ios/icon/.