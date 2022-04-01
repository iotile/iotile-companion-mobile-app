import "angular-animate";
import "angular-sanitize";
import "angular-ui-router";
import "ng-cordova";

// tslint:disable-next-line
import "ionic-angular/js/ionic.js";
// tslint:disable-next-line
import "ionic-angular/js/ionic-angular.js";

import { IOTileCloud } from "@iotile/iotile-cloud";
import { IOTileAdapter, IOTileDevice, POD1M } from "@iotile/iotile-device";
import angular = require("angular");
import Raven = require("raven-js");
import { Configuration } from "./main.route";
import { Initialization } from "./main.run";

// Import all required sub modules
import "./constants/config-const.js";

// tslint:disable-next-line
import "@iotile/iotile-cloud";
// tslint:disable-next-line
import "@iotile/iotile-device";
import "ng-iotile-app";

import * as logging from "typescript-logging";
(window as any).TSL = logging;

// This global definition is provided by the webpack build system
declare var IOTILE_VERSION: string;

// Initialize Cloud Logging
Raven.config("https://6ee0a8d8f166412cbefb38dc045665ed@sentry.io/171004", {
    release: IOTILE_VERSION
})
    // tslint:disable-next-line
    .addPlugin(require("raven-js/plugins/angular"), angular)
    .install();

angular
    .module("iotile.cloud", ["app.config"])
    .service("IOTileCloud", ["Config", IOTileCloud as any]);
angular
    .module("iotile.device", ["app.config", "ngCordova"])
    .service("IOTileAdapter", [
        "Config",
        "notificationService",
        "platform",
        IOTileAdapter as any
    ])
    .value("POD1M", function(device: IOTileDevice, adapter: IOTileAdapter) {
        return new POD1M(device, adapter);
    });

angular.module("main", [
    "ionic",
    "ngCordova",
    "ngRaven",
    "app.config",
    "iotile.device",
    "iotile.cloud",
    "iotile.app"
]);

// Import all controllers
import "./controllers/about-ctrl";
import "./controllers/active-project-ctrl";
import "./controllers/debug-ctrl";
import "./controllers/device-geolocate-ctrl";
import "./controllers/device-label-ctrl";
import "./controllers/device-settings-ctrl";
import "./controllers/help-ctrl";
import "./controllers/home-ctrl";
import "./controllers/login-ctrl";
import "./controllers/menu-ctrl";
import "./controllers/project-list-ctrl";
import "./controllers/register-ctrl";
import "./controllers/remote-access-ctrl";
import "./controllers/reports-ctrl";
import "./controllers/setup-claim-ctrl";
import "./controllers/setup-create-org-ctrl";
import "./controllers/setup-scan-ctrl";
import "./controllers/staff-logs";

import "./directives/data-logs-button-dir";
import "./directives/device-label-item-dir";
import "./directives/low-voltage-dir";
import "./directives/report-progress-dir";
import "./directives/rssi-dir";
import "./directives/upload-button-dir";
import "./directives/walkthrough-footer-dir";
import "./directives/widget-card-dir";
import "./directives/widgets/rpc-default.component";
import "./directives/widgets/rpc-state.component";
import "./directives/widgets/rpc-trip-get-config.component";
import "./directives/widgets/rpc-trip-set-config.component";
import "./directives/widgets/rpc-trip-start.component";
import "./directives/widgets/rpc-trip-status.component";
import "./directives/widgets/rpc-trip-stop.component";
import "./directives/widgets/rpc-trip-upload-status.component";
import "./directives/widgets/stch-default.component";
import "./directives/widgets/stch-upload-trip.component";
import "./directives/widgets/stream-default.component";

import "./pages/controllers/accelerometerCtrl";
import "./pages/controllers/defaultCtrl";
import "./pages/controllers/defaultSettingsCtrl";
import "./pages/controllers/deviceDebugCtrl";
import "./pages/controllers/deviceStateWidgetCtrl";
import "./pages/controllers/deviceWidgetCtrl";
import "./pages/controllers/gatewayCtrl";
import "./pages/controllers/modals/saverDockCtrl";
import "./pages/controllers/pulseCounterCtrl";
import "./pages/controllers/settings/propertySettingsCtrl";
import "./pages/controllers/settings/shippingSettingsCtrl";
import "./pages/controllers/settings/thresholdSettingsCtrl";
import "./pages/controllers/settings/userTimerSettingsCtrl";
import "./pages/controllers/shippingCtrl";
import "./pages/controllers/tempCtrl";
import "./pages/controllers/waterMeterCtrl";
import "./pages/controllers/waterMeterSettingsCtrl";

// Import images that we need to tell webpack about
import "./assets/images/iotile@2x.png";

// Move config and initialization here so that we can unit test main module without
// triggering the ui router
angular
    .module("iotile-app", ["main", "ui.router"])
    .config(Configuration)
    .run(Initialization);
