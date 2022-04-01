const IOTileCloud = require("@iotile/iotile-cloud").IOTileCloud;
const LogLevel = require("typescript-logging").LogLevel;
const readline = require("readline-sync");
const path = require("path");
const fs = require("fs");

const FILE_PATH = path.join(
  __dirname,
  "/../test/ng-iotile-app/helpers/projects"
);

const cloud = new IOTileCloud();

async function login() {
  try {
    const email = readline.question('iotile.cloud email: ');
    const password = readline.question('iotile.cloud password: ', {
        hideEchoBack: true
    });

    const user = await cloud.login(email, password);

    cloud.setToken("JWT " + user.token);
  } catch (err) {
    console.error("Error logging in: ", err);
  }
}

async function download_files() {
  try {
    return {
      vartype: JSON.stringify(
        (await cloud.fetchAllVarTypes()).map((item) => item.rawData),
        null,
        4
      ),
      projTemplate: JSON.stringify(
        (await cloud.fetchAllProjectTemplates()).map((item) => item.rawData),
        null,
        4
      ),
      sg: JSON.stringify(
        (await cloud.fetchSensorGraphs()).map((item) => item.rawData),
        null,
        4
      )
    };
  } catch (err) {
    console.error("Error downloading files: ", err);
    return {};
  }
}

function write_files(files) {
  try {
    const varTypeFilePath = path.join(FILE_PATH, "vartype_master_list.json");
    fs.writeFileSync(varTypeFilePath, files.vartype);
    console.log(`${varTypeFilePath} has been updated`);

    const projTemplateFilePath = path.join(
      FILE_PATH,
      "projecttemplate_master_list.json"
    );
    fs.writeFileSync(projTemplateFilePath, files.projTemplate);
    console.log(`${projTemplateFilePath} has been updated`);

    const sgFilePath = path.join(FILE_PATH, "sg_master_list.json");
    fs.writeFileSync(sgFilePath, files.sg);
    console.log(`${sgFilePath} has been updated`);
  } catch (err) {
    console.error("Error writing to files: ", err);
  }
}

async function main() {
  await login();
  write_files(await download_files());
}

main();
