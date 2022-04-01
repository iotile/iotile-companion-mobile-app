interface WalkthroughFooterScope extends ng.IScope {
    backName: string;
    exitName: string;
    nextName: string;

    backClass: string;
    exitClass: string;
    nextClass: string;

    backHide: boolean;

    step: number;
    total: number;

    back: () => void;
    next: () => void;
    exit: () => void;
    progress: () => void;
    check: () => boolean;
    callback: () => Promise<void>;
}

angular
    .module("main")
    .directive("walkthroughFooter", function(WalkService, $ionicPopup, $log) {
        return {
            scope: {
                callback: "&"
            },
            templateUrl:
                "main/templates/walkthrough/walkthrough-footer-template.html",
            restrict: "E",
            replace: true,
            link($scope: WalkthroughFooterScope) {
                $scope.backName = "Back";
                $scope.exitName = "Exit";
                $scope.nextName = "Next";

                $scope.backClass =
                    "button button-success icon-left ion-chevron-left";
                $scope.exitClass = "button button-assertive";
                $scope.nextClass =
                    "button button-balanced icon-right ion-chevron-right";

                $scope.back = function() {
                    WalkService.back();
                };

                $scope.next = function() {
                    $scope.callback().then(function() {
                        WalkService.next();
                    });
                };

                $scope.exit = function() {
                    const confirmPopup = $ionicPopup.confirm({
                        title: "Exiting New Device Setup",
                        template: "Are you sure you want to exit?"
                    });
                    confirmPopup.then(function(res) {
                        if (res) {
                            WalkService.reset();
                        }
                    });
                };

                $scope.progress = function() {
                    const results = WalkService.progress();
                    $scope.step = results.step;
                    $scope.total = results.total;
                };
                $scope.progress();

                $scope.check = function() {
                    const progress = WalkService.progress();
                    if (progress.step === 1) {
                        $scope.backHide = true;
                    } else {
                        $scope.backHide = false;
                    }

                    if (progress.step === progress.total) {
                        $scope.nextName = "Finish";
                        $scope.nextClass = "button button-balanced";
                    } else {
                        $scope.nextName = "Next";
                        $scope.nextClass =
                            "button button-balanced icon-right ion-chevron-right";
                    }

                    // We never disable the back button, we just hide it
                    return false;
                };
            }
        };
    });
