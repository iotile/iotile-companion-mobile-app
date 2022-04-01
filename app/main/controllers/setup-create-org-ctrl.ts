import * as IOTileCloudModule from "@iotile/iotile-cloud";
import angular = require("angular");

angular
    .module("main")
    .controller("SetupCreateOrgCtrl", function(
        $log,
        $scope,
        $ionicLoading,
        $state,
        $timeout,
        $q,
        UIService,
        Config,
        $ionicHistory,
        IOTileCloud
    ) {
        const vm = this;
        $log.log("[SetupCreateOrgCtrl] Initializing :", vm);

        vm.addOrg = () => {
            const deferred = $q.defer();
            $ionicLoading.show({
                template: "Creating Company",
                duration: 20000
            });

            IOTileCloud.createOrg(vm.newOrgName, vm.newOrgAbout).then(
                () => {
                    $ionicLoading.hide();
                    deferred.resolve();

                    // After we create an org, we can't create more of them by going back
                    $ionicHistory.nextViewOptions({
                        disableBack: true
                    });

                    $state.go("main.ble");
                },
                response => {
                    $ionicLoading.hide();
                    const httpError = new IOTileCloudModule.HttpError(response);
                    if (httpError.status === -1) {
                        $log.log("No Internet Connection");
                        UIService.messageBox(
                            "Error!",
                            "No internet connection."
                        );
                        deferred.reject(httpError);
                    } else {
                        $log.error(
                            "[SetupCreateOrgCtrl] response: " +
                                httpError.extraInfo()
                        );
                        UIService.messageBox(
                            "Error! Unable to create company!",
                            httpError.shortUserErrorMsg()
                        );
                        deferred.reject(httpError);
                    }
                }
            );
            return deferred.promise;
        };

        $scope.$on("$ionicView.beforeEnter", () => {
            vm.newOrgName = null;
        });

        vm.onCancel = () => {
            // If the user clicks cancel, take them back to the project list.  Don't go
            // to the home screen since that will resync data immediately if they're online
            // and we came here by resyncing anyway and didn't change anything.
            $ionicHistory.nextViewOptions({
                disableBack: true
            });

            $state.go("main.projectList");
        };
    });
