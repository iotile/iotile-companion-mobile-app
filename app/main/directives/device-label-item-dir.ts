angular.module("main").directive("deviceLabelItem", function() {
    return {
        // NB: This directive will only work on device pages that derive from DeviceBase since they need cloudDevice
        template:
            '<ion-item class="item item-divider item-icon-right ng-show="vm.cloudDevice">' +
            "  {{ vm.cloudDevice.label }}" +
            '  <i class="icon ion-flash-off assertive" ng-if="vm.cloudDevice.drifterMode"></i>' +
            "  <br><br><p>ID: {{ vm.cloudDevice.slug }}</p>" +
            "</ion-item>",
        restrict: "E",
        replace: true
    };
});
