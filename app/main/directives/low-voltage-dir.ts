import angular = require("angular");

interface LowVoltageScope extends ng.IScope {
    lowBatteryIconClass: () => string;
}

angular.module("main").directive("lowVoltageIndicator", function() {
    return {
        scope: true,
        template: '<i class="icon" ng-class="lowBatteryIconClass()"></i>',
        restrict: "E",
        replace: true,
        link(scope: LowVoltageScope, element, attrs) {
            let device;
            scope.$watch(attrs.ngModel, function(value) {
                device = value;
            });
            scope.lowBatteryIconClass = function() {
                if (device && device.flags) {
                    if (device.flags.lowVoltage) {
                        return "ion-alert-circled assertive";
                    }
                }
                return "ion-ios-sunny balanced";
            };
        }
    };
});
