import { IOTileCloud } from "@iotile/iotile-cloud";
import { ControllerBase } from "@iotile/iotile-common";
import { IOTileAdapter, IOTileDevice } from "@iotile/iotile-device";
import angular = require("angular");
import { CacheService, RobustReportService, UIService } from "ng-iotile-app";

export class UserTimerSettingsController extends ControllerBase {
    public deviceSlug: string;
    public timerInterval: string;
    public newTimer: number;

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
        super("userTimerSettingsController", $injector, $scope);
        this.cache = CacheService;
        this.deviceSlug = $stateParams.deviceId;
        this.state = $state;
        this.User = User;
        this.ui = UIService;
        this.cloud = IOTileCloud;

        this.adapter = $injector.get("IOTileAdapter");
        this.device = null;
    }

    public async updateTimer() {
        if (this.device == null) {
            this.setError("No device connected, cannot update time interval.");
            return;
        }

        if (this.newTimer >= 5) {
            const timeInSeconds = this.newTimer * 60;
            await this.showLoading("Setting Timer Interval on Device...", true);

            try {
                await this.device
                    .config()
                    .setConfigVariable(
                        "controller",
                        0x2002,
                        "L",
                        timeInSeconds
                    );
                await this.adapter.errorHandlingRPC(8, 0x2015, "LH", "L", [
                    timeInSeconds,
                    1
                ]);

                // refresh current timer value
                let rawInterval: number;
                [rawInterval] = await this.adapter.errorHandlingRPC(
                    8,
                    0x2014,
                    "H",
                    "LL",
                    [1]
                );
                this.timerInterval = rawInterval / 60 + " min";
                if (this.timerInterval === "0 min") {
                    this.timerInterval += " (Disabled)";
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
            let rawInterval: number;
            [rawInterval] = await this.adapter.errorHandlingRPC(
                8,
                0x2014,
                "H",
                "LL",
                [1]
            );
            this.timerInterval = rawInterval / 60 + " min";
            if (this.timerInterval === "0 min") {
                this.timerInterval += " (Disabled)";
            }
            this.$scope.$apply();
        } catch (err) {
            this.setError("Could not get current timer interval from device");
            this.log_warn(
                `Failed to fetch user timer interval from ${this.deviceSlug}`,
                err
            );
        }
    }
}

angular
    .module("main")
    .controller("userTimerSettingsCtrl", UserTimerSettingsController as any);
