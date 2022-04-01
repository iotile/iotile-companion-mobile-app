import { IOTileDevice } from "@iotile/iotile-device";
import angular = require("angular");

interface RssiScope extends ng.IScope {
    rssiBatchClass: (device: IOTileDevice) => string;
}

export function RssiDirective(): ng.IDirective {
    return {
        template:
            '<ion-item class="item item-icon-left">' +
            '<i class="icon ion-connection-bars"></i>' +
            "<p>RSSI</p>" +
            '<span class="badge" ng-class="rssiBatchClass(vm.device)" ng-if="vm.device">' +
            "  {{ vm.device.advertisement.rssi }}" +
            "</span></ion-item>",
        scope: true,
        restrict: "E",
        link: (scope: RssiScope) => {
            scope.rssiBatchClass = function(device): string {
                if (device.advertisement.rssi < -90) {
                    return "badge-assertive";
                }
                if (device.advertisement.rssi < -80) {
                    return "badge-energized";
                } else {
                    return "badge-balanced";
                }
            };
        }
    };
}

angular.module("main").directive("rssi", RssiDirective);
