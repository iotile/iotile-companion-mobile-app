import * as IOTileCloudModule from "@iotile/iotile-cloud";
import { IOTileAdapter, IOTileAdvertisement } from "@iotile/iotile-device";
import angular = require("angular");

angular
    .module("main")
    .controller("SetupScanCtrl", function(
        $log,
        $scope,
        $state,
        $ionicLoading,
        IOTileAdapter: IOTileAdapter,
        Config,
        $http,
        NetService,
        UIService,
        IOTileCloud
    ) {
        const vm = this;
        let claimStatus = {};

        $log.log("[SetupScanCtrl] Initializing");

        vm.devices = [];

        vm.isClaimable = function(slug) {
            return claimStatus[slug];
        };

        const checkClaims = function() {
            const data = {
                slugs: vm.devices.map(dev => dev.slug)
            };

            $log.log(
                "[SetupScanCtrl] Checking claims on " +
                    vm.devices.length +
                    " devices",
                data.slugs
            );

            IOTileCloud.checkClaimable(data)
                .then(function(response) {
                    $log.log("[SetupScanCtrl] Claim response", response);
                    let empty = true;

                    claimStatus = {};
                    if (response.length > 0) {
                        response.forEach(function(element) {
                            claimStatus[element.slug] = element.claimable;
                            if (element.claimable === true) {
                                empty = false;
                            }
                        });
                    }

                    if (empty === true) {
                        vm.msg = "No claimable devices found.";
                    }
                })
                .catch(function(err) {
                    const httpError = new IOTileCloudModule.HttpError(err);
                    $log.warn(
                        "[SetupScanCtrl] Error checking claims: " +
                            httpError.extraInfo()
                    );
                    vm.error = httpError.longUserErrorMsg();
                    $ionicLoading.hide();
                });
        };

        // pull to refresh
        vm.onRefresh = function() {
            vm.onRefreshAsync().catch(err =>
                $log.warn("[SetupScanCtrl] Error refreshing", err)
            );
        };

        vm.onRefreshAsync = async function() {
            vm.scanning = true;

            if (NetService.isOnline()) {
                vm.msg = null;

                const enabled = await IOTileAdapter.enabled();

                if (!enabled) {
                    vm.scanning = false;
                    $scope.$broadcast("scroll.refreshComplete");
                    vm.msg = "Bluetooth is *not* available/enabled";
                    $scope.$apply();
                    return;
                }

                try {
                    vm.devices = await IOTileAdapter.scan(4.0);
                    checkClaims();
                } catch (err) {
                    $log.warn("[SetupScanCtrl] Error while scanning:", err);
                    vm.msg = "No IOTile Devices found: " + err;
                } finally {
                    $scope.$broadcast("scroll.refreshComplete");
                    vm.scanning = false;
                    $scope.$apply();
                }
            } else {
                UIService.messageBox(
                    "Offline!",
                    "Must be connected to the internet to claim devices."
                );
            }
        };

        vm.alreadyConnected = function(advert: IOTileAdvertisement): boolean {
            return advert.flags.otherConnected;
        };

        vm.onSelectDevice = function(advert: IOTileAdvertisement) {
            $log.log("[SetupScanCtrl] Device selected", advert);
            if (vm.alreadyConnected(advert)) {
                UIService.messageBox(
                    "Connected!",
                    "Device already has an active connection, please wait and try again."
                );
            } else {
                $state.go("main.bleDetail", { deviceId: advert.slug });
            }
        };

        $scope.$on("$ionicView.beforeEnter", function() {
            if (NetService.isOnline()) {
                // initial scan
                vm.msg = null;
                vm.scanning = true;
                vm.onRefresh();
            } else {
                vm.msg = "Offline.  Must have a network connection.";
            }
        });
    });
