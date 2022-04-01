import { Device, Project, SensorGraph, Variable } from "@iotile/iotile-cloud";
import { ControllerBase, UISeverity } from "@iotile/iotile-common";
import { IOTileAdapter, IOTileDevice } from "@iotile/iotile-device";
import angular = require("angular");
import { CacheService, UIService, UserService } from "ng-iotile-app";

export class ShippingSettingsController extends ControllerBase {
    public deviceSlug: string;
    public drifterMode: boolean;
    public project: Project;
    public device: Device;
    public ioTileDevice: IOTileDevice;
    public sg: SensorGraph;
    public tripStarted: boolean;

    public ioInfo;
    public variables: Variable[];
    public user: UserService;

    public hasAccessToAdvancedOptions: boolean;

    private cache: CacheService;
    private state;
    private stateParams;
    private adapter: IOTileAdapter;
    private ui: UIService;

    constructor(
        $scope,
        $stateParams,
        $state,
        $ionicHistory,
        User,
        UIService,
        CacheService,
        $injector
    ) {
        super("shippingSettingsController", $injector, $scope);
        this.adapter = $injector.get("IOTileAdapter");
        this.cache = CacheService;
        this.deviceSlug = $stateParams.deviceId;
        this.state = $state;
        this.stateParams = $stateParams;
        this.user = User;
        this.ui = UIService;
        this.sg = null;
        this.project = null;
        this.ioInfo = null;
        this.ioTileDevice = null;
        this.drifterMode = false;
        this.variables = [];
        this.hasAccessToAdvancedOptions = false;
    }

    public async getThreshold() {
        if (!this.tripStarted) {
            this.state.go("main.deviceSettings", {
                deviceId: this.deviceSlug,
                controller: "thresholdSettingsCtrl",
                template: "threshold-settings"
            });
        } else {
            await this.alert(
                "Trip in Progress",
                "Shock threshold cannot be changed while a trip is in progress.",
                UISeverity.Warn
            );
        }
    }

    public async getUserTimer() {
        if (!this.tripStarted) {
            this.state.go("main.deviceSettings", {
                deviceId: this.deviceSlug,
                controller: "userTimerSettingsCtrl",
                template: "user-timer-settings"
            });
        } else {
            await this.alert(
                "Trip in Progress",
                "Environmental reading interval cannot be changed while a trip is in progress.",
                UISeverity.Warn
            );
        }
    }

    public getProperties() {
        this.state.go("main.deviceSettings", {
            deviceId: this.deviceSlug,
            controller: "propertySettingsCtrl",
            template: "property-settings"
        });
    }

    public async resetData() {
        if (this.ioTileDevice == null) {
            await this.alert(
                "No device connected",
                "Please reconnect to your device before resetting its data.",
                UISeverity.Error
            );
            return;
        }

        const confirm = await this.confirm(
            "Reset All Device Data",
            "Are you sure you want to permanently delete all data from device?",
            UISeverity.Warn
        );

        if (confirm) {
            // check if trip has ended and device can be safely reset
            const safe = await this.getTripEnded();
            if (safe) {
                this.log_info(
                    `Resetting all data on device ${this.deviceSlug}`
                );

                /*
                 * In order to reset all data on the device, we first clear all data stored in the controller
                 * and then we clear all waveforms stored in the accelerometer.
                 */
                try {
                    await this.ioTileDevice.clearAllReadings();
                    await this.adapter.errorHandlingRPC(
                        12,
                        0x8031,
                        "",
                        "L",
                        [],
                        2.0
                    );

                    await this.alert(
                        "Device Reset",
                        "Device data successfully deleted.",
                        UISeverity.Success
                    );

                    this.tripStarted = false;
                    this.stateParams.extraData.tripStarted = false;
                    this.$scope.$apply();
                } catch (err) {
                    this.log_error("Error resetting POD-1M device", err);
                    await this.alert(
                        "Error Resetting Device",
                        "Device could not be reset, please reconnect and try again.",
                        UISeverity.Error
                    );
                }
            } else {
                await this.alert(
                    "Device Not Reset",
                    "Trip in progress. Please End Trip before resetting device data.",
                    UISeverity.Error
                );
            }
        }
    }

    public setLocation() {
        this.state.go("main.deviceGeolocate", { deviceId: this.deviceSlug });
    }

    public setLabel() {
        this.state.go("main.labelSettings", { deviceId: this.deviceSlug });
    }

    public labelModified() {
        if (this.project == null) {
            return false;
        }

        return this.project.overlay.deviceHasDelta(
            this.deviceSlug,
            "DeviceLabelDelta"
        );
    }

    public locationModified() {
        if (this.project == null) {
            return false;
        }

        return this.project.overlay.deviceHasDelta(
            this.deviceSlug,
            "DeviceLocationDelta"
        );
    }

    protected async initialize() {
        if (this.stateParams.extraData) {
            this.tripStarted = this.stateParams.extraData.tripStarted;
        }

        this.ioTileDevice = this.adapter.getConnectedDevice();
        if (this.ioTileDevice == null) {
            this.setError(
                "No device connected, please go back and reconnect to the device."
            );
        }

        try {
            this.project = await this.cache.getActiveProject();
            if (this.project == null) {
                this.setError(
                    "Error: no active project, please restart the app."
                );
                return;
            }

            this.device = this.project.getDevice(this.deviceSlug);
            this.sg = this.project.getSensorGraph(this.device.sensorGraphSlug);
            this.drifterMode = this.device.drifterMode;
            this.ioInfo = this.sg.getIoInfo("mobile");
            this.hasAccessToAdvancedOptions = this.user.hasAccessToAdvancedOptions(
                this.project.orgSlug
            );

            if (this.ioInfo) {
                this.log_info("IO Info from sensor graph", this.ioInfo);
            } else {
                // TODO: Verify if we still want to support devices that do not have
                // ioInfo specified.
                this.variables = [];
                for (const variable of this.project.variables) {
                    if (!variable.webOnly && !variable.appOnly) {
                        this.variables.push(variable);
                    }
                }

                this.variables.sort((a, b) => b.lid - a.lid);
                this.log_info("Got variables", this.variables);
            }
        } catch (err) {
            this.setError(
                "Error loading device settings, please restart the app."
            );
            this.log_warn("Error initializing device settings", err);
        }
    }

    private async getTripEnded(): Promise<boolean> {
        const startStream = await this.ioTileDevice.downloadStream(
            "system buffered node 1536"
        );
        const endStream = await this.ioTileDevice.downloadStream(
            "system buffered node 1537"
        );

        const lastStart = startStream[startStream.length - 1];
        const lastEnd = endStream[endStream.length - 1];

        // true if the last trip was completed, or no trip has been started
        if (
            (lastStart && lastEnd && lastStart.value < lastEnd.value) ||
            (!lastStart && !lastEnd)
        ) {
            return true;
        } else {
            return false;
        }
    }
}

angular
    .module("main")
    .controller("shippingSettingsCtrl", ShippingSettingsController as any);
