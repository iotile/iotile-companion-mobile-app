#!/bin/sh
base="./media/splash.png"
base_port="./media/splash-port.png"
base_land="./media/splash-land.png"
out="./resources/ios/splash"
rm -rf "$out/*.png"

convert "$base_port" -resize '320x480!'     -unsharp 1x4 "${out}/Default~iphone.png"
convert "$base_port" -resize '640x960!'     -unsharp 1x4 "${out}/Default@2x~iphone.png"
convert "$base_port" -resize '2048x2732!'     -unsharp 1x4 "${out}/Default-Portrait@~ipadpro.png"
convert "$base_port" -resize '768x1024!'     -unsharp 1x4 "${out}/Default-Portrait~ipad.png"
convert "$base_port" -resize '1536x2048!'     -unsharp 1x4 "${out}/Default-Portrait@2x~ipad.png"
convert "$base_port" -resize '1242x2208!'     -unsharp 1x4 "${out}/Default-736h.png"
convert "$base_port" -resize '750x1334!'     -unsharp 1x4 "${out}/Default-667h.png"
convert "$base_port" -resize '640x1136!'     -unsharp 1x4 "${out}/Default-568h@2x~iphone.png"

convert "$base_land" -resize '2732x2048!'     -unsharp 1x4 "${out}/Default-Landscape@~ipadpro.png"
convert "$base_land" -resize '1024x768!'     -unsharp 1x4 "${out}/Default-Landscape~ipad.png"
convert "$base_land" -resize '2048x1536!'     -unsharp 1x4 "${out}/Default-Landscape@2x~ipad.png"
convert "$base_land" -resize '2208x1242!'     -unsharp 1x4 "${out}/Default-Landscape-736h.png"

