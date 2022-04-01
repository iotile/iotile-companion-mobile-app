import { ControllerBase } from "@iotile/iotile-common";
import angular = require("angular");

/**
 * @ngdoc controller
 * @name main.controller:AboutController
 */
class AboutController extends ControllerBase {
    public name: string;
    public version: string;

    constructor($scope, $injector, Config) {
        super("AboutController", $injector, $scope);

        this.name = Config.ENV.NAME;
        this.version = "v" + Config.BUILD.VERSION || "0.0";
    }

    public onWebApp() {
        return this.openExternal("https://app.iotile.cloud");
    }

    public onPrivacy() {
        return this.openExternal("https://iotile.cloud/privacy/");
    }

    public onTerms() {
        return this.openExternal("https://iotile.cloud/sw-terms/");
    }
}

angular.module("main").controller("AboutController", AboutController as any);
