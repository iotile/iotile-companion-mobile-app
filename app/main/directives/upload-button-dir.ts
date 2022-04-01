import angular = require("angular");
import {
    CacheService,
    ReportServiceState,
    ReportUIService,
    RobustReportService
} from "ng-iotile-app";

interface UploadButtonScope extends ng.IScope {
    hasData: boolean;
    inProgress: boolean;
    rawIncludeErrors: string;
    includeErrors: () => boolean;
    buttonText: () => string;
    buttonClass: () => string;
    buttonDisabled: () => boolean;
    uploadAll: () => Promise<void>;
}

angular
    .module("main")
    .directive("uploadLogsButton", function(
        $log,
        RobustReportService: RobustReportService,
        NetService,
        ReportUIService: ReportUIService
    ) {
        return {
            scope: {
                rawIncludeErrors: "@includeErrors"
            },
            template:
                '<button ng-click="uploadAll()" style="margin-top:4px; border-color: #015083" ng-disabled="buttonDisabled()" ng-class="buttonClass()"><i class="icon ion-upload"></i><b>{{ buttonText() }}</b></button>',
            restrict: "E",
            async link(scope: UploadButtonScope) {
                scope.hasData = false;
                scope.inProgress = false;

                // Process includeErrors string
                scope.includeErrors = function() {
                    if (scope.rawIncludeErrors == null) {
                        return false;
                    } else if (typeof scope.rawIncludeErrors === "string") {
                        return scope.rawIncludeErrors === "true";
                    }

                    return false;
                };

                scope.buttonText = function() {
                    if (!NetService.isOnline()) {
                        return "Offline";
                    }
                    if (scope.inProgress) {
                        return "Uploading";
                    } else if (scope.hasData) {
                        return "Upload";
                    }

                    return "Upload";
                };

                scope.buttonClass = function() {
                    if (scope.inProgress) {
                        return "button button-positive button-energized";
                    }

                    return "button button-positive button-assertive";
                };

                scope.buttonDisabled = function() {
                    if (!NetService.isOnline()) {
                        return true;
                    }

                    if (scope.inProgress) {
                        return true;
                    } else if (scope.hasData) {
                        return false;
                    }

                    return true;
                };

                scope.uploadAll = async function() {
                    scope.inProgress = true;

                    try {
                        await ReportUIService.uploadAllData(
                            scope.includeErrors()
                        );
                    } catch (err) {
                        $log.error("[UploadButton] Error uploading data", err);
                    } finally {
                        scope.inProgress = false;
                        scope.$apply();
                    }
                };

                // Keep ourselves up to date
                scope.$on("STREAMER_REPORT_EVENT", function(
                    name,
                    state: ReportServiceState
                ) {
                    if (scope.includeErrors()) {
                        scope.hasData = state.reportsToUpload;
                    } else {
                        scope.hasData = state.cleanReportsToUpload;
                    }

                    scope.$apply();
                });

                // Initialize out state explicitly
                const state = await RobustReportService.state();

                if (scope.includeErrors()) {
                    scope.hasData = state.reportsToUpload;
                } else {
                    scope.hasData = state.cleanReportsToUpload;
                }
                scope.$apply();
            }
        };
    });
