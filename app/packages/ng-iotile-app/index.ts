import angular = require("angular");

angular.module("iotile.app", ["app.config", "ngCordova"]);

export * from "./cache-serve";
export * from "./filesystem-serv";
export * from "./report-serv";
export * from "./report-ui-serv";
export * from "./ui-serv";
export * from "./uploader-service";
export * from "./user-serv";
export * from "./net-serv";
export * from "./mutex";
export * from "./walkthrough-serv";
export * from "./firmware";
export * from "./popover-service";
export * from "./geolocation-serve";

export * from "./modals/progress-modal";

export { BaseSettingsController } from "./classes/settings-base";
export { StreamSettingsController } from "./classes/stream-settings-base";
export * from "./classes/async-queue";
export * from "./classes/device-base";

export { MockCordovaFile } from "./mocks/mock-filesystem";

export { SentryLogger, LogMessage } from "./classes/logger";
