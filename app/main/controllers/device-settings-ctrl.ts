import * as IOTileCloudModule from "@iotile/iotile-cloud";
import { ControllerBase, UISeverity } from "@iotile/iotile-common";
import angular = require("angular");
import { get } from "lodash";
import { CacheService, RobustReportService, UIService } from "ng-iotile-app";

export class DeviceSettingsController extends ControllerBase {
    public deviceSlug: string;
    public drifterMode: boolean;
    public isTimerConfigurable: boolean;
    public project: IOTileCloudModule.Project;
    public device: IOTileCloudModule.Device;
    public sg: IOTileCloudModule.SensorGraph;

    public ioInfo;
    public variables: IOTileCloudModule.Variable[];

    private cache: CacheService;
    private state;
    private User;
    private ui: UIService;
    private reportService: RobustReportService;

    constructor(
        $scope,
        $stateParams,
        $state,
        RobustReportService,
        $ionicHistory,
        User,
        UIService,
        CacheService,
        $injector
    ) {
        super("DeviceSettingsController", $injector, $scope);
        this.cache = CacheService;
        this.deviceSlug = $stateParams.deviceId;
        this.state = $state;
        this.reportService = RobustReportService;
        this.User = User;
        this.ui = UIService;

        this.sg = null;
        this.project = null;
        this.ioInfo = null;
        this.drifterMode = false;
        this.isTimerConfigurable = false;
        this.variables = [];
    }

    public setLocation() {
        this.state.go("main.deviceGeolocate", { deviceId: this.deviceSlug });
    }

    public setLabel() {
        this.state.go("main.labelSettings", { deviceId: this.deviceSlug });
    }

    public setIO(lid: string) {
        const variableSlug = ["v", this.project.gid, lid].join("--");
        this.log_info("Moving to IO settings for " + variableSlug);

        let template: string = null;
        let controller: string = null;
        if (this.sg) {
            template = this.sg.getSettingsTemplate(lid);
            controller = this.sg.getSettingsController(lid);
        }

        if (template && controller) {
            this.state.go("main.ioSettings", {
                deviceId: this.deviceSlug,
                varId: variableSlug,
                template,
                controller
            });
        } else {
            this.setError(
                "Error: Project and/or Device is incorrectly configured"
            );
        }
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

    public variableModified(lid: string) {
        if (this.project == null) {
            return false;
        }

        return this.project.overlay.variableModified(lid);
    }

    public async toggleDrifterMode() {
        if (this.drifterMode) {
            const confirm = await this.ui.confirm(
                "Confirm No Data Upload",
                "<p><b>NO HISTORICAL DATA will be saved to the cloud. </b></p>  <p>You will only be able to see realtime readings while connected to a device with your phone</p><p>System performance data will still be sent to the cloud.</p>",
                "Cancel",
                "Confirm"
            );
            if (!confirm) {
                this.drifterMode = false;
                this.$scope.$apply();
                return;
            }
        }

        const delta = new IOTileCloudModule.DeviceDrifterDelta(
            !this.drifterMode,
            this.drifterMode,
            this.device.slug
        );
        const overlay = new IOTileCloudModule.ProjectOverlay([delta]);

        try {
            this.log_info("Setting drifter mode to " + this.drifterMode);
            await this.cache.updateActiveProject(overlay, false);
        } catch (err) {
            let msg =
                "An error occurred changing realtime status mode, please try again";
            if (err.userMessage) {
                msg = err.userMessage;
            } else if (err.message) {
                msg = err.message;
            }

            this.log_error("Error updating drifter mode", err);

            // Return the setting box back to what it was since we had an error updating it.
            this.drifterMode = !this.drifterMode;
            this.setError(msg);
        }
    }

    public async getUserTimer() {
        this.state.go("main.deviceSettings", {
            deviceId: this.deviceSlug,
            controller: "userTimerSettingsCtrl",
            template: "user-timer-settings"
        });
    }

    protected async initialize() {
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
            this.isTimerConfigurable = get(
                this.sg.getUiExtra("mobile"),
                "settings.isTimerConfigurable",
                false
            );
            this.ioInfo = this.sg.getIoInfo("mobile");

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
}

angular
    .module("main")
    .controller("DeviceSettingsCtrl", DeviceSettingsController as any);
