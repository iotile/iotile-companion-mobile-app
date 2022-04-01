import * as IOTileCloudModule from "@iotile/iotile-cloud";
import { ArgumentError } from "@iotile/iotile-common";
import angular = require("angular");
import { StreamSettingsController } from "ng-iotile-app";

interface Factor {
    upp: number;
    ppu: number;
}

export class WaterMeterSettings extends StreamSettingsController {
    public labelPrefix: string;
    public dataLabel: string;
    public type: string;
    public mdoType: string;
    public factor: Factor;

    public flowOutputUnitSlug: string;
    public flowStream: IOTileCloudModule.Stream;
    public flowVarType: IOTileCloudModule.VarType;

    public origFlowStream: IOTileCloudModule.Stream;
    public origOdoStream: IOTileCloudModule.Stream;

    constructor($injector, $scope) {
        super("WaterMeterIOSettings", $injector, $scope);

        this.dataLabel = "";
        this.labelPrefix = null;
        this.type = null;
        this.mdoType = null;
        this.factor = {
            upp: 1.0,
            ppu: 1.0
        };
    }

    public factorChanged(type: string) {
        if (this.factor.upp <= 0 || this.factor.ppu <= 0) {
            this.error = "Invalid factor, must be greater than zero!";
            return;
        } else {
            this.error = null;
        }

        if (type === "UPP") {
            this.factor.ppu = 1 / this.factor.upp;
        } else {
            this.factor.upp = 1 / this.factor.ppu;
        }
    }

    protected async postInitialize() {
        this.type = this.stream.mdo.label || "UPP";
        this.mdoType = this.stream.mdoType;
        this.dataLabel = this.stream.dataLabel;

        // Make sure to truncate initial values we show the user in case they are repeating decimals
        // or irrational
        if (this.mdo.m != null && this.mdo.d != null) {
            this.factor.upp = parseFloat(
                (this.stream.mdo.m / this.stream.mdo.d).toFixed(8)
            );
            this.factor.ppu = parseFloat(
                (this.stream.mdo.d / this.stream.mdo.m).toFixed(8)
            );
        } else {
            this.factor.upp = 1.0;
            this.factor.ppu = 1.0;
        }

        const ioInfo = this.sg.getIoInfo("mobile");
        const info = ioInfo.map[this.variable.getHexLid()];
        this.labelPrefix = info.label;

        const flowStreamSlug = [
            "s",
            this.project.gid,
            this.device.gid,
            info.derived.flow.lid
        ].join("--");
        this.flowStream = this.project.getStream(flowStreamSlug);
        this.origFlowStream = this.project.getStream(flowStreamSlug, true);
        const flowVariable = this.project.getVariable(this.flowStream.variable);
        this.flowVarType = await this.cache.getVariableType(flowVariable.type);
        this.flowOutputUnitSlug = this.flowStream.outputUnit.slug;

        const odoStreamSlug = [
            "s",
            this.project.gid,
            this.device.gid,
            info.derived.odometer.lid
        ].join("--");
        this.origOdoStream = this.project.getStream(odoStreamSlug, true);
    }

    protected getChanges(): IOTileCloudModule.StreamDelta[] {
        const inputUnit = this.vartype.getInputUnitForSlug(this.inputUnitSlug);
        const outputUnit = this.vartype.getOutputUnitForSlug(
            this.outputUnitSlug
        );
        const flowInputUnitSlug = this.getFlowUnitSlug(
            this.inputUnitSlug,
            this.flowVarType.slug
        );
        const flowInputUnit = this.flowVarType.getInputUnitForSlug(
            flowInputUnitSlug
        );
        const flowOutputUnit = this.flowVarType.getOutputUnitForSlug(
            this.flowOutputUnitSlug
        );
        let deltas = [];

        if (this.factor.upp <= 0 || this.factor.ppu <= 0) {
            throw new ArgumentError("Factor must be greater than zero!");
        }

        this.mdo.setFromFactor(this.factor.upp, false);

        if (this.dataLabel.length > 50) {
            throw new ArgumentError(
                "The Data Label must be 50 characters or less."
            );
        }

        if (!inputUnit || !outputUnit || !flowInputUnit || !flowOutputUnit) {
            throw new ArgumentError(
                "Internal Error. Could not find input and/or output units."
            );
        }

        deltas = deltas.concat(
            this.updateStreamWithSettings(
                this.origStream,
                this.dataLabel,
                inputUnit,
                outputUnit,
                this.mdo
            )
        );
        deltas = deltas.concat(
            this.updateStreamWithSettings(
                this.origOdoStream,
                this.origOdoStream.dataLabel,
                inputUnit,
                outputUnit,
                this.mdo
            )
        );
        deltas = deltas.concat(
            this.updateStreamWithSettings(
                this.origFlowStream,
                this.origFlowStream.dataLabel,
                flowInputUnit,
                flowOutputUnit,
                this.mdo
            )
        );
        return deltas;
    }

    private getFlowUnitSlug(volumeUnitSlug: string, flowVarTypeSlug: string) {
        const volumeParts = volumeUnitSlug.split("--");
        return [volumeParts[0], flowVarTypeSlug, volumeParts[2]].join("--");
    }
}

angular
    .module("main")
    .controller("waterMeterSettingsCtrl", WaterMeterSettings as any);
