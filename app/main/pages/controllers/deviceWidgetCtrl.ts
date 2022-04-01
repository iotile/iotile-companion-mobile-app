import { DisplayWidget, Project } from "@iotile/iotile-cloud";
import { WidgetChannel } from "@iotile/iotile-common";
import { IOTileAdapter } from "@iotile/iotile-device";
import angular = require("angular");
import { DeviceBaseController } from "ng-iotile-app";

export class DeviceWidgetController extends DeviceBaseController {
    public widgets: DisplayWidget[];
    public deviceChannel: WidgetChannel;

    constructor($stateParams, $injector, $scope) {
        super(
            "DeviceWidgetController",
            $stateParams.deviceId,
            $injector,
            $scope
        );

        this.widgets = [];
    }

    protected async preInitialize() {
        if (this.sg.displayWidgetTemplates.length) {
            this.log_info(
                "Widget Count: " + this.sg.displayWidgetTemplates.length
            );

            for (const widget of this.sg.displayWidgetTemplates) {
                if (!widget.showInApp) {
                    continue;
                }
                this.widgets.push(widget);
            }
        } else {
            this.log_info("Device SG has no display widgets.");
        }

        this.deviceChannel = {
            bindMethod: (func: any, stream: number | string) => {
                if (typeof stream === "string") {
                    stream = parseInt(stream.substr(stream.length - 4), 16);
                }
                this.bindMethod(func, stream);
            },

            bindCallback: (func: any, stream: number | string) => {
                if (typeof stream === "string") {
                    stream = parseInt(stream.substr(stream.length - 4), 16);
                }
                this.bindCallback(func, stream);
            },

            getStreamID: (stream: string) => this.getStreamID(stream),
            callRPC: (
                addr: number,
                rpcID: number,
                call_fmt: string,
                resp_fmt: string,
                args: Array<string | number>,
                timeout?: number
            ) =>
                this.adapter.typedRPC(
                    addr,
                    rpcID,
                    call_fmt,
                    resp_fmt,
                    args,
                    timeout
                ),
            getUnits: (stream: string) => this.getStreamUnits(stream)
        };
    }

    private getStreamID(stream: string): string {
        const streamID = [this.streamIDBase, stream].join("--");
        return streamID;
    }

    private getStreamUnits(stream: string): string {
        return this.getUnits(stream);
    }
}

angular
    .module("main")
    .controller("deviceWidgetCtrl", DeviceWidgetController as any);
