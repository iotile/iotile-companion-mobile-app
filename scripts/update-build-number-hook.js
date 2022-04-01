var fs = require('fs');
var et = require('elementtree');
var path = require('path');
var execSync = require('child_process').execSync;

//Determine the correct build numbers for iOS and Android and patch config.xml with them
//These constants hold the magical values of the build and commit count when we started
//using this hook

let baseBuild = 11319;
let baseCount = 890;
let count = getCommitCount();

if (count < baseCount) {
  throw new Error("Update Build Number Failed, the commit count is somehow in the past...");
}

//For historical reasons, android build version has an extra 0
let buildVersion = baseBuild + count - baseCount;
patchBuildVersion(buildVersion*10, buildVersion);


//Internal utility functions
function parseElementtreeSync(filename) {
    var contents = fs.readFileSync(filename, 'utf-8');
    if (contents) {
        //Windows is the BOM. Skip the Byte Order Mark.
        contents = contents.substring(contents.indexOf('<'));
    }

    return new et.ElementTree(et.XML(contents));
}

function patchBuildVersion(androidVersion, iosVersion) {
    let configPath = path.join(__dirname, '../', 'config.xml');
    let xml = parseElementtreeSync(configPath);
    let widget = xml.getroot();

    widget.set('android-versionCode', androidVersion.toString());
    widget.set('ios-CFBundleVersion', iosVersion.toString())

    fs.writeFileSync(configPath, xml.write({indent: 4}), 'utf-8');
}

function getCommitCount() {
    let commitCount = execSync('git rev-list --count HEAD');

    return parseInt(commitCount.toString().trim());
}
