import angular = require("angular");
import { CacheService } from "ng-iotile-app";

export function MenuController(
    $log,
    $scope,
    User,
    $state,
    $ionicLoading,
    NetService,
    UIService,
    CacheService: CacheService
) {
    $log.log("[MenuCtrl] Initializing");

    $scope.userService = User;

    $scope.onLogout = async function() {
        try {
            $ionicLoading.show("Logging out...");
            await User.logout();
        } finally {
            $ionicLoading.hide();
            $state.go("login");
        }
    };

    $scope.startSetup = function() {
        if (NetService.isOnline()) {
            CacheService.projectList().then(function(orgs) {
                if (orgs.length) {
                    $state.go("main.ble");
                } else {
                    $state.go("main.create-org");
                }
            });
        } else {
            UIService.messageBox(
                "Offline!",
                "Internet access is required to setup new devices, please connect to the internet and try again."
            );
        }
    };
}

angular.module("main").controller("MenuCtrl", MenuController);
