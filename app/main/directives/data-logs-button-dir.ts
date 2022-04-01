import angular = require("angular");
import {
    CacheService,
    DBReportEntry,
    ReportServiceState,
    RobustReportService
} from "ng-iotile-app";

interface LogsButtonScope extends ng.IScope {
    hasData: boolean;
    hasErrors: boolean;
    uploadCount: number;
    onDataLogs: () => void;
}

angular
    .module("main")
    .directive("logsButton", function(
        $log,
        $timeout,
        $state,
        RobustReportService: RobustReportService
    ) {
        return {
            scope: {},
            template:
                '<button ng-click="onDataLogs()" class="button button-positive">Logs <i class="icon ion-android-alert assertive" ng-show="hasErrors"></i> <span class="badge badge-assertive" ng-show="hasData && !hasErrors">{{ uploadCount }}</span></button>',
            restrict: "E",
            async link(scope: LogsButtonScope) {
                scope.hasData = false;
                scope.hasErrors = false;
                scope.uploadCount = 0;

                scope.onDataLogs = function() {
                    $state.go("main.reports");
                };

                function updateUploadCount(reports: DBReportEntry[]) {
                    let count = 0;
                    for (const report of reports) {
                        if (report.uploaded === false) {
                            count += 1;
                        }
                    }

                    return count;
                }

                // Keep ourselves up to date
                scope.$on("STREAMER_REPORT_EVENT", function(
                    name,
                    state: ReportServiceState
                ) {
                    scope.hasData = state.cleanReportsToUpload;
                    scope.hasErrors = state.hasErrors;
                    scope.uploadCount = updateUploadCount(state.reports);
                    scope.$apply();
                });

                // Initialize out state explicitly
                const state = await RobustReportService.state();
                scope.hasData = state.cleanReportsToUpload;
                scope.hasErrors = state.hasErrors;
                scope.uploadCount = updateUploadCount(state.reports);
                scope.$apply();
            }
        };
    });
