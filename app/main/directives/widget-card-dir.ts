import { DisplayWidget } from "@iotile/iotile-cloud";
import angular = require("angular");

export interface DeviceWidgetScope extends ng.IScope {
    widget: DisplayWidget;
}

export function WidgetCardDirective($compile): ng.IDirective {
    return {
        scope: { widget: "=", channel: "=" },
        replace: true,
        restrict: "E",
        link: (scope: DeviceWidgetScope, element) => {
            let dynamicContent: string;

            switch (scope.widget.type) {
                case "val":
                    const varType = "default";
                    dynamicContent =
                        "<stream-" +
                        varType +
                        ' widget="widget" channel="channel"></stream-' +
                        varType +
                        ">";
                    break;
                case "btn":
                    const rpc_type = scope.widget.varType || "default";
                    dynamicContent =
                        "<rpc-" +
                        rpc_type +
                        ' widget="widget" channel="channel"></rpc-' +
                        rpc_type +
                        ">";
                    break;
                case "sbt":
                    const sbt_type = scope.widget.varType || "default";
                    dynamicContent =
                        "<stch-" +
                        sbt_type +
                        ' widget="widget" channel="channel"></stch-' +
                        sbt_type +
                        ">";
                    break;
            }

            const widget = $compile(dynamicContent)(scope);
            element.append(widget);
        }
    };
}

angular.module("main").directive("widgetCard", WidgetCardDirective);
