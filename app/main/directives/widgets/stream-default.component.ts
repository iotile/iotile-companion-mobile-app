import { DataPoint, DisplayWidget, Stream } from "@iotile/iotile-cloud";
import { WidgetBase } from "@iotile/iotile-common";
import { IndividualReport } from "@iotile/iotile-device";
import angular = require("angular");
import { StreamStyle } from "ng-iotile-app";

export class StreamDefaultWidget extends WidgetBase {
    public value: string;

    constructor($injector, $scope) {
        super("StreamWidget", $injector, $scope);
    }

    public async initialize() {
        this.channel = (this.$scope.$parent as any).channel;
        this.widget = (this.$scope.$parent as any).widget;

        const streamID = this.channel.getStreamID(this.widget.lid);

        this.channel.bindCallback(
            (data: IndividualReport, styledValue: string) => {
                this.onStreamData(data, styledValue);
            },
            streamID
        );
        this.value = "Waiting...";
    }

    public onStreamData(data: IndividualReport, styledValue: string) {
        const units = this.channel.getUnits(this.widget.lid);

        this.value = styledValue + " " + units;
        this.$scope.$apply();
    }

    public async cleanup() {
        // Do any required cleanup here
    }
}

// Register our component so we can invoke it from a directive
angular.module("main").component("streamDefault", {
    bindings: {
        widget: "<",
        channel: "<",
        value: "<"
    },
    controller: StreamDefaultWidget,
    template: `<div class="card">
                <div class="item item-text-wrap"> 
                    <div>
                        {{$ctrl.widget.label}}
                        <span class="badge badge-positive">
                        {{$ctrl.value}}
                        </span>
                    </div>
                </div>
            </div>`
});
