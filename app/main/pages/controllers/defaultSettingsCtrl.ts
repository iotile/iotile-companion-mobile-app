import * as IOTileCloudModule from "@iotile/iotile-cloud";
import { ArgumentError } from "@iotile/iotile-common";
import angular = require("angular");
import { StreamSettingsController } from "ng-iotile-app";

export class DefaultSettingsController extends StreamSettingsController {
    public dataLabel: string;
    public labelPrefix: string = null;
    private origDerivedStreams: IOTileCloudModule.Stream[];

    constructor($injector, $scope) {
        super("DefaultIOSettings", $injector, $scope);
        this.origDerivedStreams = [];
        this.dataLabel = "";
    }

    protected async postInitialize() {
        this.origDerivedStreams = [];
        this.dataLabel = this.stream.dataLabel;

        const ioInfo = this.sg.getIoInfo("mobile");
        if (ioInfo) {
            const ioObject = ioInfo.map[this.variable.getHexLid()];
            if (ioObject) {
                this.labelPrefix = ioObject.label;
                const derived = ioObject.derived;
                if (derived) {
                    for (const key in derived) {
                        const lid: string = derived[key].lid;
                        const slug: string = [
                            "s",
                            this.project.gid,
                            this.device.gid,
                            lid
                        ].join("--");
                        const stream = this.project.getStream(slug, true);

                        if (!stream) {
                            throw new ArgumentError(
                                "Linked streams were not properly configured in the cloud.  Contact Arch."
                            );
                        }

                        this.origDerivedStreams.push(
                            new IOTileCloudModule.Stream(stream.toJson())
                        );
                    }
                }
            }
        }

        this.log_info(
            "Derived streams for current IO",
            this.origDerivedStreams
        );
    }

    protected getChanges(): IOTileCloudModule.StreamDelta[] {
        const inputUnit = this.vartype.getInputUnitForSlug(this.inputUnitSlug);
        const outputUnit = this.vartype.getOutputUnitForSlug(
            this.outputUnitSlug
        );

        if (this.mdo.m <= 0 || this.mdo.d <= 0) {
            throw new ArgumentError(
                "Multiply and Divide must be greater than zero!"
            );
        }

        if (!inputUnit || !outputUnit) {
            throw new ArgumentError(
                "Internal Error. Could not find input and/or output units."
            );
        }

        if (this.dataLabel.length > 50) {
            throw new ArgumentError(
                "The Data Label must be 50 characters or less."
            );
        }

        // Create deltas to update this stream and if there are any derived streams, update them as well
        let deltas = this.updateStreamWithSettings(
            this.origStream,
            this.dataLabel,
            inputUnit,
            outputUnit,
            this.mdo
        );

        for (const stream of this.origDerivedStreams) {
            deltas = deltas.concat(
                this.updateStreamWithSettings(
                    stream,
                    this.dataLabel,
                    inputUnit,
                    outputUnit,
                    this.mdo
                )
            );
        }

        return deltas;
    }
}

angular
    .module("main")
    .controller("defaultSettingsCtrl", DefaultSettingsController as any);
