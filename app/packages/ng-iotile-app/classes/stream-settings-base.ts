import * as IOTileCloudModule from "@iotile/iotile-cloud";
import { UISeverity } from "@iotile/iotile-common";
import { BaseSettingsController } from "./settings-base";

export abstract class StreamSettingsController extends BaseSettingsController {
    public stream: IOTileCloudModule.Stream;
    public origStream: IOTileCloudModule.Stream;
    public mdo: IOTileCloudModule.Mdo;

    public inputUnitSlug: string;
    public outputUnitSlug: string;
    protected variable: IOTileCloudModule.Variable;
    protected vartype: IOTileCloudModule.VarType;
    protected sg: IOTileCloudModule.SensorGraph;

    protected variableSlug: string;
    protected streamSlug: string;

    constructor(name: string, $injector, $scope) {
        super(name, $injector, $scope);

        this.variable = null;
        this.vartype = null;
        this.stream = null;
        this.sg = null;
        this.mdo = new IOTileCloudModule.Mdo();

        this.variableSlug = null;
        this.streamSlug = null;
        this.inputUnitSlug = null;
        this.outputUnitSlug = null;
    }

    protected async postInitialize() {}

    /*
     * We need to load in a lot of data to be able to modify an IO Setting:
     * project, device, variable, stream, variable type and sensorgraph
     *
     * If any of them cannot be found or are invalid, throw a fatal error and leave.
     */
    protected async initialize() {
        const continueLoading = await this.loadDeviceData();
        if (!continueLoading) {
            return;
        }

        this.variableSlug = this.params.varId;
        this.variable = this.project.getVariable(this.variableSlug);
        if (!this.variable) {
            await this.ui.alert(
                "Error!",
                "Variable data was not properly downloaded.  Try resyncing cloud data or contact Arch.",
                UISeverity.Error
            );
            this.log_error(
                "No variable in active project in io settings",
                this.variableSlug,
                this.project
            );
            this.$ionicHistory.goBack();
            return;
        }

        this.streamSlug = [
            "s",
            this.project.gid,
            this.device.gid,
            this.variable.getHexLid()
        ].join("--");
        this.stream = this.project.getStream(this.streamSlug);
        this.origStream = this.project.getStream(this.streamSlug, true);
        if (!this.stream) {
            await this.ui.alert(
                "Error!",
                "Stream data was not properly downloaded.  Try resyncing cloud data or contact Arch.",
                UISeverity.Error
            );
            this.log_error(
                "No stream in active project in io settings",
                this.streamSlug,
                this.project
            );
            this.$ionicHistory.goBack();
            return;
        }

        try {
            this.vartype = await this.cache.getVariableType(this.variable.type);
        } catch (err) {
            await this.ui.alert(
                "Error!",
                "Variable type data was not properly downloaded.  Try resyncing cloud data or contact Arch.",
                UISeverity.Error
            );
            this.log_error(
                "No vartype in in io settings",
                this.variable.type,
                this.project
            );
            this.$ionicHistory.goBack();
            return;
        }

        this.log_info("Variable type", this.vartype);
        this.log_info(
            "Initialized IO settings for stream " +
                this.streamSlug +
                " on device " +
                this.deviceSlug
        );
        this.log_info("Stream object", this.stream);

        // Initialize our transform MDO
        if (this.stream.mdoType === "S") {
            this.mdo.setFromMdo(this.stream.mdo);
        } else {
            this.mdo.setFromMdo(this.variable.mdo);
        }

        // Make sure we have input and output units
        const inputUnit = this.project.getInputUnits(this.stream);
        const outputUnit = this.project.getOutputUnits(this.stream);
        if (!inputUnit || !outputUnit) {
            await this.ui.alert(
                "Error!",
                "Stream unit data was not properly downloaded.  Try resyncing cloud data or contact Arch.",
                UISeverity.Error
            );
            this.log_error(
                "No unit in in io settings",
                this.stream,
                this.project
            );
            this.$ionicHistory.goBack();
            return;
        }

        // Initialize our input and output units
        this.outputUnitSlug = outputUnit.slug;
        this.inputUnitSlug = inputUnit.slug;

        // Hook to allow for subclasses to initialize themselves
        try {
            await this.postInitialize();
        } catch (err) {
            let msg = err.message;
            if (!msg) {
                msg = "An unknown initialization error occured.  Contact Arch.";
            }

            this.log_error("Error doing subclass specific initialization", err);
            await this.ui.alert("Error!", msg, UISeverity.Error);
            this.$ionicHistory.goBack();
            return;
        }

        this.$scope.$apply();
    }

    protected updateStreamWithSettings(
        stream: IOTileCloudModule.Stream,
        label: string,
        inputUnit: IOTileCloudModule.Unit,
        outputUnit: IOTileCloudModule.Unit,
        mdo: IOTileCloudModule.Mdo
    ): IOTileCloudModule.StreamDelta[] {
        const deltas: IOTileCloudModule.StreamDelta[] = [];

        deltas.push(
            new IOTileCloudModule.StreamInputUnitsDelta(
                stream.inputUnit,
                inputUnit,
                stream.slug
            )
        );
        deltas.push(
            new IOTileCloudModule.StreamOutputUnitsDelta(
                stream.outputUnit,
                outputUnit,
                stream.slug
            )
        );
        deltas.push(
            new IOTileCloudModule.StreamLabelDelta(
                stream.dataLabel,
                label,
                stream.slug
            )
        );
        deltas.push(
            new IOTileCloudModule.StreamMDODelta(
                stream.mdo,
                stream.mdoType,
                mdo,
                "S",
                stream.slug
            )
        );

        return deltas;
    }
}
