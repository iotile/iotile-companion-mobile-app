#!/usr/bin/env node
'use strict';

var path = require('path');
var fs = require('fs');

function findEntry(contentsJSON, entry) {
    for (var i = 0; i < contentsJSON.images.length; ++i) {
        var curr = contentsJSON.images[i];
        if (entry.size == curr.size && entry.idiom == curr.idiom && entry.scale == curr.scale) {
            return true;
        }
    }

    return false;
}

function copyFile(inputPath, outputPath) {
    fs.writeFileSync(outputPath, fs.readFileSync(inputPath));
}

var rootdir = path.resolve(__dirname, '../');
var inputIconDir = path.join(rootdir, 'resources', 'ios', 'icon');
var inputIcons = ['icon-20.png', 'icon-20@2x.png', 'icon-20@3x.png'];

var iosdir = path.join(rootdir, 'platforms', 'ios');
var icondir = path.join(iosdir, 'IOTile', 'Images.xcassets', 'AppIcon.appiconset');
var contentsJSONPath = path.join(icondir, 'Contents.json');

var contentsJSON = require(contentsJSONPath);
var neededEntries = [
    {
    "size" : "20x20",
    "idiom" : "iphone",
    "filename" : "icon-20@2x.png",
    "scale" : "2x"
    },
    {
        "size" : "20x20",
        "idiom" : "iphone",
        "filename" : "icon-20@3x.png",
        "scale" : "3x"
    },
    {
        "size" : "20x20",
        "idiom" : "ipad",
        "filename" : "icon-20.png",
        "scale" : "1x"
    },
    {
        "size" : "20x20",
        "idiom" : "ipad",
        "filename" : "icon-20@2x.png",
        "scale" : "2x"
    }
]

for (let entry of neededEntries) {
    if (!findEntry(contentsJSON, entry)) {
        contentsJSON.images.push(entry);
    }
}

var contents = JSON.stringify(contentsJSON, null, 4);
fs.writeFileSync(contentsJSONPath, contents);

//Also the size 20 icons don't get copied automatically by cordova
for (let inputIcon of inputIcons) {
    let inputPath = path.join(inputIconDir, inputIcon);
    let outputPath = path.join(icondir, inputIcon);
    copyFile(inputPath, outputPath);
}
