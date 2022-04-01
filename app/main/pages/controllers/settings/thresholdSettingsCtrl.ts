import { IOTileCloud } from "@iotile/iotile-cloud";
import { ControllerBase } from "@iotile/iotile-common";
import { IOTileAdapter, IOTileDevice } from "@iotile/iotile-device";
import angular = require("angular");
import { CacheService, RobustReportService, UIService } from "ng-iotile-app";

export class ThresholdSettingsController extends ControllerBase {
    public deviceSlug: string;
    public shockThreshold: string;
    public newThreshold: number;

    protected cache: CacheService;
    private state;
    private User;
    private ui: UIService;
    private cloud: IOTileCloud;
    private adapter: IOTileAdapter;
    private device: IOTileDevice;

    constructor(
        $scope,
        $stateParams,
        $state,
        $ionicHistory,
        User,
        UIService,
        CacheService,
        $injector,
        IOTileCloud
    ) {
        super("thresholdSettingsController", $injector, $scope);
        this.cache = CacheService;
        this.deviceSlug = $stateParams.deviceId;
        this.state = $state;
        this.User = User;
        this.ui = UIService;
        this.cloud = IOTileCloud;

        this.adapter = $injector.get("IOTileAdapter");
        this.device = null;
    }

    public async updateThreshold() {
        if (this.device == null) {
            this.setError("No device connected, cannot update threshold.");
            return;
        }

        if (this.newThreshold >= 0.6) {
            await this.showLoading(
                "Setting Shock Threshold on Device...",
                true
            );

            try {
                await this.device
                    .config()
                    .setConfigVariable(
                        "slot 2",
                        0x8000,
                        "H",
                        this.newThreshold / 0.049
                    );

                await this.adapter.errorHandlingRPC(12, 0x8022, "H", "L", [
                    this.newThreshold / 0.049
                ]);

                // refresh current threshold value
                const accelConfig = await this.adapter.typedRPC(
                    12,
                    0x8021,
                    "",
                    "HBBHHHBB",
                    []
                );

                this.shockThreshold =
                    (accelConfig[0] * 0.049).toFixed(1) + " G";
                if (this.shockThreshold === "0.0 G") {
                    this.shockThreshold += " (Disabled)";
                }

                this.$scope.$apply();
            } finally {
                await this.hideLoading();
            }
        }
    }

    protected async initialize() {
        this.device = this.adapter.getConnectedDevice();
        if (this.device == null) {
            this.setError("No device connected, please connect again.");
            return;
        }

        try {
            const accelConfig = await this.adapter.typedRPC(
                12,
                0x8021,
                "",
                "HBBHHHBB",
                []
            );

            this.shockThreshold = (accelConfig[0] * 0.049).toFixed(1) + " G";
            if (this.shockThreshold === "0.0 G") {
                this.shockThreshold += " (Disabled)";
            }

            this.$scope.$apply();
        } catch (err) {
            this.setError("Could not get current shock threshold from device");
            this.log_warn(
                `Failed to fetch current shock threshold from ${
                    this.deviceSlug
                }`,
                err
            );
        }
    }
}

angular
    .module("main")
    .controller("thresholdSettingsCtrl", ThresholdSettingsController as any);
