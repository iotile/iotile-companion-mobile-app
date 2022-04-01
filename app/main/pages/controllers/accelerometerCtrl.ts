import { Variable } from "@iotile/iotile-cloud";
import { IndividualReport } from "@iotile/iotile-device";
import angular = require("angular");
import { DeviceBaseController, StreamStyle, StreamStyler } from "ng-iotile-app";

export class AccelerometerController extends DeviceBaseController {
    public realtimeStreams: string[];
    public eventStreams: string[];
    private variables: { [key: string]: Variable };
    private styler: StreamStyler;

    constructor($stateParams, $injector, $scope) {
        super(
            "AccelerometerController",
            $stateParams.deviceId,
            $injector,
            $scope
        );

        this.variables = {};
        this.realtimeStreams = [];
        this.eventStreams = [];
        this.styler = (report: IndividualReport) => report.reading.toString();
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

                    if (variable.lid < 4117) {
                        this.realtimeStreams.push(streamSlug);
                    } else {
                        this.eventStreams.push(streamSlug);
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
            if (streamID in this.realtimeStreams) {
                this.bindProperty(
                    null,
                    streamID,
                    StreamStyle.CustomFunction,
                    "Waiting...",
                    this.styler,
                    true
                );
            } else {
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
}

angular
    .module("main")
    .controller("accelerometerCtrl", AccelerometerController as any);
