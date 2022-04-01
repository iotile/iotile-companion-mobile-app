import angular = require("angular");
// tslint:disable-next-line: no-submodule-imports
import "ionic-angular/js/ionic";

export function NetService($log, $rootScope, $cordovaNetwork) {
    $log.log("[NetService] Service Initialized");

    let networkIsOnline = false;
    let networkType = "unk";

    if (window.cordova) {
        networkType = $cordovaNetwork.getNetwork();
        networkIsOnline = $cordovaNetwork.isOnline();
        $log.log(
            "[NetService] onLine=" + networkIsOnline + ", type=" + networkType
        );
    } else {
        $log.log("[NetService] In Web Mode");
        networkIsOnline = true;
        networkType = "Web";
    }

    // listen for Online event
    $rootScope.$on("$cordovaNetwork:online", function(event, networkState) {
        const onlineState = networkState;
        $log.log("[NetService] $cordovaNetwork:online " + onlineState);
        networkIsOnline = true;
        if (!window.ionic.Platform.isWebView()) {
            networkType = $cordovaNetwork.getNetwork();
        }
    });

    // listen for Offline event
    $rootScope.$on("$cordovaNetwork:offline", function(event, networkState) {
        const offlineState = networkState;
        $log.log("[NetService] $cordovaNetwork:offline " + offlineState);
        networkIsOnline = false;
        networkType = "None";
    });

    this.isOnline = function() {
        return networkIsOnline;
    };

    this.getNetwork = function() {
        return networkType;
    };
}

angular.module("iotile.app").service("NetService", NetService);
