import { ControllerBase } from "@iotile/iotile-common";
import angular = require("angular");

export class DebugController extends ControllerBase {
    public ENV: {};
    public BUILD: {};
    public device: {};

    constructor($injector, Config, $scope, $cordovaDevice, NetService) {
        super("DebugController", $injector, $scope);

        this.ENV = Config.ENV;
        this.BUILD = Config.BUILD;
        this.device = $cordovaDevice.getDevice();
    }
}

angular.module("main").controller("DebugCtrl", DebugController as any);
