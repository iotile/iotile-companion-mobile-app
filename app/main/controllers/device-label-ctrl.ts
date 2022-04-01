import * as IOTileCloudModule from "@iotile/iotile-cloud";
import { ArgumentError } from "@iotile/iotile-common";
import angular = require("angular");
// tslint:disable-next-line: no-submodule-imports
import { BaseSettingsController } from "ng-iotile-app/classes/settings-base";

export class LabelSettingsController extends BaseSettingsController {
    public label: string;

    constructor($injector, $scope) {
        super("LabelSettings", $injector, $scope);

        this.label = "";
    }

    protected async postInitialize() {
        this.label = this.device.label;
    }

    protected getChanges(): IOTileCloudModule.DeviceDelta[] {
        if (this.label.length > 60) {
            throw new ArgumentError(
                "Device label is too long, 60 characters max!"
            );
        }

        if (this.label.length === 0) {
            throw new ArgumentError("Please enter a device label");
        }

        return [
            new IOTileCloudModule.DeviceLabelDelta(
                this.origDevice.label,
                this.label,
                this.device.slug
            )
        ];
    }
}

angular
    .module("main")
    .controller("LabelSettingsCtrl", LabelSettingsController as any);
