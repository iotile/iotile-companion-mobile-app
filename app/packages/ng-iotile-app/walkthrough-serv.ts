import * as IOTileCloudModule from "@iotile/iotile-cloud";
import angular = require("angular");
import { Walkthrough } from "./classes/walkthrough";

export class WalkService {
    private _wt: Walkthrough;
    private _active: boolean;
    private _home: any;
    private $log: any;
    private _device;
    private _project;
    private $state: any;

    constructor($log, $state) {
        this.$log = $log;
        this.$state = $state;
        this._wt = new Walkthrough();
        this._active = false;
        this._home = {
            name: "main.home",
            args: null
        };
        this._device = null;
        this._project = null;
    }

    public reset(): void {
        const $state = this.$state;
        this._active = false;
        this._device = null;
        this._wt = new Walkthrough();
        $state.go(this._home.name, this._home.args);
    }

    public progress(): any {
        return this._wt.progress();
    }

    public active(): boolean {
        return this._active;
    }

    public next(): void {
        const $log = this.$log;
        const $state = this.$state;
        const next = this._wt.nextState();
        if (next) {
            $state.go(next.name, next.args);
        } else {
            this._active = false;
            $state.go(this._home.name, this._home.args);
        }
    }

    public back(): void {
        const $state = this.$state;
        const next = this._wt.prevState();
        if (next) {
            $state.go(next.name, next.args);
        } else {
            this._active = false;
            $state.go(this._home.name, this._home.args);
        }
    }

    public begin(
        device: IOTileCloudModule.Device,
        project: IOTileCloudModule.Project
    ): void {
        this._wt = new Walkthrough();
        this._active = true;
        this._device = device;
        this._project = project;

        this._wt.addState("main.labelSettings", { deviceId: device.slug });
        this._wt.addState("main.deviceGeolocate", { deviceId: device.slug });
        this.setupIO(project, device);
        const next = this._wt.begin();
        if (next) {
            this.$state.go(next.name, next.args);
        }
    }

    private setupIO(project, device): void {
        const that = this;
        const sg: IOTileCloudModule.SensorGraph =
            project.sensorGraphMap[device.sensorGraphSlug];
        const ioInfo: any = sg.getIoInfo("mobile");

        if (ioInfo && ioInfo.order) {
            // Order defined by Sensor Graph
            for (const lid of ioInfo.order) {
                const template = sg.getSettingsTemplate(lid);
                const controller = sg.getSettingsController(lid);
                const vId = "v--" + project.gid + "--" + lid;
                const args = {
                    deviceId: device.slug,
                    varId: vId,
                    template,
                    controller
                };

                this._wt.addState("main.ioSettings", args);
            }
        } else {
            // Order is not defined in Sensor Graph. Default to checking variables
            angular.forEach(
                project.sensorGraphMap[device.sensorGraphSlug]
                    .variableTemplates,
                function(varTemplate, index) {
                    if (varTemplate.web_only === false) {
                        const template = sg.getSettingsTemplate(
                            varTemplate.lid_hex
                        );
                        const controller = sg.getSettingsController(
                            varTemplate.lid_hex
                        );
                        const vId =
                            "v--" + project.gid + "--" + varTemplate.lid_hex;
                        const args = {
                            deviceId: device.slug,
                            varId: vId,
                            template,
                            controller
                        };
                        that._wt.addState("main.ioSettings", args);
                    }
                }
            );
        }
    }
}

angular.module("iotile.app").service("WalkService", WalkService);
