import { Variable } from "@iotile/iotile-cloud";
import angular = require("angular");
import { DeviceBaseController, StreamStyle } from "ng-iotile-app";

export class DefaultController extends DeviceBaseController {
    private variables: { [key: string]: Variable };

    constructor($stateParams, $injector, $scope) {
        super("DefaultController", $stateParams.deviceId, $injector, $scope);

        this.variables = {};
    }

    protected async preInitialize() {
        this.variables = {};

        if (this.sg.displayWidgetTemplates.length) {
            this.log_info(
                "Widget Count: " + this.sg.displayWidgetTemplates.length
            );

            for (const widget of this.sg.displayWidgetTemplates) {
                if (!widget.showInApp) {
                    continue;
                }

                const varSlug = this.buildVariableID(widget.lid);
                const streamSlug = this.buildStreamID(widget.lid);
                const variable = this.project.getVariable(varSlug);
                if (variable) {
                    this.log_debug("Found widget variable", variable);
                    const stream = this.streams[streamSlug];

                    if (stream) {
                        this.variables[streamSlug] = variable;
                    }
                } else {
                    this.log_info("Widget variable not found: " + varSlug);
                }
            }
        } else {
            this.log_info(
                "Device SG has no display widgets. Defaulting to showing all streams"
            );

            for (const slug in this.streams) {
                const varSlug = this.streams[slug].variable;
                if (varSlug) {
                    const variable = this.project.getVariable(varSlug);

                    if (variable) {
                        this.variables[slug] = variable;
                    }
                }
            }
        }

        // Bind all of the streams we could generate so that we properly style them
        for (const streamID in this.streams) {
            this.bindProperty(
                null,
                streamID,
                StreamStyle.CloudDefault,
                "Waiting...",
                null,
                true
            );
        }
    }
}

angular.module("main").controller("defaultCtrl", DefaultController as any);
