import {
    AdapterEvent,
    IOTileAdapter,
    ReportParserEvent
} from "@iotile/iotile-device";
import angular = require("angular");

export interface ReportProgressScope extends ng.IScope {
    inProgress: boolean;
    percentage: number;
    dataType: string;
}

export function ReportProgressDirective(
    $log,
    IOTileAdapter: IOTileAdapter
): ng.IDirective {
    return {
        template:
            '<ion-item class="item-msg item text-center" ng-show="inProgress">' +
            "<h2>Receiving {{ dataType }} Data: {{ percentage }}% Done</h2><br/>" +
            '<ion-spinner icon="ripple" class="spinner-positive"></ion-spinner></ion-item>',
        scope: {},
        restrict: "E",
        link: (scope: ReportProgressScope) => {
            const progressCallback = function(
                eventName: string,
                event: ReportParserEvent
            ) {
                if (event.finishedPercentage === 100) {
                    scope.$apply(function() {
                        scope.inProgress = false;
                        scope.percentage = event.finishedPercentage;
                    });
                } else {
                    scope.$apply(function() {
                        scope.inProgress = true;
                        scope.percentage = event.finishedPercentage;

                        // For now, hardcode that streamer 1 will be system data and streamer 0 (and possible 2-8) are user data
                        if (event.reportIndex === 1) {
                            scope.dataType = "System";
                        } else {
                            scope.dataType = "Historical";
                        }
                    });
                }
            };

            const disconnectCallback = function(
                eventName: string,
                event: ReportParserEvent
            ) {
                scope.$apply(function() {
                    scope.inProgress = false;
                    scope.percentage = 0;
                });
            };

            scope.inProgress = false;
            scope.percentage = 0;
            scope.dataType = "Historical";

            const startHandler = IOTileAdapter.subscribe(
                AdapterEvent.RobustReportStarted,
                progressCallback
            );
            const progressHandler = IOTileAdapter.subscribe(
                AdapterEvent.RobustReportProgress,
                progressCallback
            );
            const finishedHandler = IOTileAdapter.subscribe(
                AdapterEvent.RobustReportFinished,
                progressCallback
            );
            const disconnectHandler = IOTileAdapter.subscribe(
                AdapterEvent.Disconnected,
                disconnectCallback
            );

            // If we are put into the background while connected to a device, we can miss notifications so we need
            // to cancel any in progress reports that we are receiving.
            const interruptedHandler = IOTileAdapter.subscribe(
                AdapterEvent.StreamingInterrupted,
                disconnectCallback
            );

            scope.$on("$destroy", startHandler);
            scope.$on("$destroy", progressHandler);
            scope.$on("$destroy", finishedHandler);
            scope.$on("$destroy", disconnectHandler);
            scope.$on("$destroy", interruptedHandler);
        }
    };
}

angular
    .module("main")
    .directive("reportProgressIndicator", ReportProgressDirective);
