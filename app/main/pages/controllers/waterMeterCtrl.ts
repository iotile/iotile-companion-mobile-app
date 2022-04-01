import angular = require("angular");
import { DeviceBaseController, StreamStyle, UIService } from "ng-iotile-app";

class WaterMeterController extends DeviceBaseController {
    public title: string;
    private ioInfo;

    // Internal services we use, in addition to what is provided by our base class
    private UIService: UIService;

    constructor($stateParams, $injector, $scope, UIService) {
        super("WaterMeterCtrl", $stateParams.deviceId, $injector, $scope);

        this.UIService = UIService;
    }

    public async resetWidget(primaryLid: number) {
        const resetConfigId = {
            "100d": 8207,
            "100e": 8208
        };

        const label = this.ioInfo.map[primaryLid].label;
        const lid = this.ioInfo.map[primaryLid].derived.odometer.lid;
        const streamId = this.buildStreamID(lid);

        if (!(lid in resetConfigId)) {
            this.log_warn(
                "Attempting to reset counter for an unknown stream, aborting.  lid = " +
                    lid
            );
            return;
        }

        const internalStream = resetConfigId[lid];

        // Pop up a dialog box confirming that we should reset the trip counter
        const res = await this.UIService.confirm(
            "Reset?",
            'Would you like to reset the counter for "' + label + '"?'
        );
        if (!res) {
            return;
        }

        try {
            // Get current value after the user clicks so that we don't have a stale old value
            // if the user takes a bunch of time to click the okay button.
            const currentValue: number = this.lastValue(
                streamId,
                true
            ) as number;
            this.forceLastValue(streamId, "0", 0);
            this.$scope.$apply();

            const [oldOffset] = await this.adapter.errorHandlingRPC(
                8,
                0x200b,
                "H",
                "LL",
                [internalStream]
            );
            await this.adapter.errorHandlingRPC(8, 0x2000, "LH", "L", [
                oldOffset + currentValue,
                internalStream
            ]);
        } catch (err) {
            this.log_error("Error resetting trip counter", err);
            this.UIService.messageBox(
                "Error!",
                "Error resetting the counter.  Please try again."
            );
        }
    }

    protected async preInitialize() {
        this.ioInfo = this.sg.getIoInfo("mobile");
        this.title = this.sg.name;

        // Initialize the binding of all of the streams that we might want to show
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

angular
    .module("main")
    .controller("waterMeterCtrl", WaterMeterController as any);
