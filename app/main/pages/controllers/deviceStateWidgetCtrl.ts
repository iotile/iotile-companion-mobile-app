import {
    DisplayWidget,
    Project,
    RPCArgs,
    StatefulRPCArgs,
    StatefulSwitchArgs
} from "@iotile/iotile-cloud";
import { WidgetChannel } from "@iotile/iotile-common";
import { IOTileAdapter } from "@iotile/iotile-device";
import angular = require("angular");
import { DeviceBaseController } from "ng-iotile-app";

export class DeviceStateWidgetController extends DeviceBaseController {
    public allWidgets: { [key: string]: DisplayWidget };
    // widgets currently displayed
    public widgets: DisplayWidget[];
    public deviceChannel: WidgetChannel;

    constructor($stateParams, $injector, $scope) {
        super(
            "DeviceStateWidgetController",
            $stateParams.deviceId,
            $injector,
            $scope
        );

        this.allWidgets = {};
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
                this.allWidgets[widget.label] = widget;

                // set up initial widget display
                if (widget.type !== "val" && widget.args.currentState) {
                    this.widgets.push(widget);
                }
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
            getUnits: (stream: string) => this.getStreamUnits(stream),
            setState: (state: string) => this.setState(state)
        };
    }

    private setState(state: string) {
        const widget: DisplayWidget = this.allWidgets[state];
        widget.args.currentState = true;

        if (this.widgets.indexOf(widget) === -1) {
            this.widgets.push(widget);
        }
        this.$scope.$apply();
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
    .controller("deviceStateWidgetCtrl", DeviceStateWidgetController as any);
