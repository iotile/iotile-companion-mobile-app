'use strict';
// +++++++++++++++++++++++++++++++++++++++++++++++++++++++
// +++++++++++++++++++++++++++++++++++++++++++++++++++++++
// Copy this file as config-const.js
// (but do not put back under version control)
// +++++++++++++++++++++++++++++++++++++++++++++++++++++++
// +++++++++++++++++++++++++++++++++++++++++++++++++++++++

var bleConfig = require(`./ble-${BLE_CONFIG}.json`);
var envConfig = require(`./env-${ENV_CONFIG}.json`);
var fsConfig = require(`./fs-${FS_CONFIG}.json`);

angular.module('app.config', [])
.constant('Config', {
  ENV: envConfig,

  BUILD: {
    VERSION: IOTILE_VERSION_AND_BUILD
  },

  BLE: bleConfig,
  FS: fsConfig
});
