import {
    ArgumentError,
    CustomModalBase,
    delay,
    deviceIDToSlug,
    InvalidOperationError,
    UISeverity
} from "@iotile/iotile-common";
import { IOTileAdapter } from "@iotile/iotile-device";
import angular = require("angular");
import { UIService } from "ng-iotile-app";

interface SaverInfo {
    timerEvents: number;
    totalTimerSpace: number;
    signalEvents: number;
    totalSignalSpace: number;
    serialNumber: string;
    fromField: string;
    toField: string;
}

interface UploadProgress {
    task: string;
    finished: number;
    total: number;
}

class UploadInfo {
    public inProgress: boolean = false;
    public iotileID: string = null;
    public progress: UploadProgress = { task: null, finished: 0, total: 1 };
    public saverID: string = null;
}

// tslint:disable: max-classes-per-file
class SetupInfo {
    public inProgress: boolean = false;
    public templatesLoaded: boolean = false;
    public templates: string[] = [];
    public selectedTemplate: string = null;
    public programming: boolean = false;
}

enum DaemonAction {
    None = 0,
    Scan = 1,
    Upload = 2,
    Check = 3,
    Remove = 4,
    GetTemplates = 5,
    Program = 6
}

enum DaemonStatus {
    Idle = 0,
    ScanningSaver = 1,
    UploadingData = 2,
    FetchingTemplates = 3,
    ProgrammingSaver = 4,
    ProgrammingFinished = 254, // Internal state to force the user to disconnect the saver before clicking more buttons
    Busy = 255 // Internal busy code for when we are requesting data from the saver dock before it responds
}

/**
 * The trip information stored in the saver is accessible
 * by passing a numeric code that indicates what information
 * you are looking for.  These numeric constants must stay
 * in sync with the lansmont package in proj_kladatalogger
 * so that you query the right thing.
 */
const MetadataCodes = {
    Serial: 0,
    ShipTo: 1,
    ShipFrom: 2,
    Message: 3,
    ShipVia: 4,
    TransportType: 5,
    TripID: 6,
    LoadingType: 7,
    ProjectID: 8,
    Notes: 9,
    CargoDescription: 10,
    Country: 11,
    Region: 11
};

export class SaverDockModal extends CustomModalBase {
    public get busy(): boolean {
        return this.statusCode !== DaemonStatus.Idle;
    }

    public get status(): string {
        if (this.statusCode == null) {
            return "Getting Information...";
        }

        switch (this.statusCode) {
            case DaemonStatus.Idle:
                if (this.saverInfo) {
                    return "Idle, Saver Attached";
                }

                return "Idle";

            case DaemonStatus.ScanningSaver:
                return "Scanning Attached Saver";

            case DaemonStatus.Busy:
                return "Contacting Saver Dock";

            case DaemonStatus.UploadingData:
                return "Upload in Progress";

            case DaemonStatus.ProgrammingSaver:
                return "Programming Saver";

            case DaemonStatus.FetchingTemplates:
                return "Fetching Templates";

            case DaemonStatus.ProgrammingFinished:
                return "Setup Complete, Please Unplug";
        }
    }
    public statusCode: DaemonStatus;
    public saverInfo: SaverInfo;

    public uploadInfo: UploadInfo;
    public setupInfo: SetupInfo;
    public adapter: IOTileAdapter;

    private ui: UIService;

    private modalOpen: boolean;

    constructor($injector, $scope) {
        super("Saver Dock", $injector, $scope);

        this.uploadInfo = new UploadInfo();
        this.setupInfo = new SetupInfo();

        this.ui = $injector.get("UIService");

        this.adapter = null;
        this.modalOpen = false;
        this.error = null;
    }

    public async initialize(...args) {
        if (args.length !== 1 || !(args[0] instanceof IOTileAdapter)) {
            throw new ArgumentError(
                "Created a SaverDockModal without passing it an IOTileAdapter"
            );
        }

        this.statusCode = DaemonStatus.Busy;
        this.error = null;
        this.adapter = args[0];
        this.modalOpen = true;
        this.uploadInfo = new UploadInfo();

        if ((await this.getDaemonStatus()) === DaemonStatus.UploadingData) {
            try {
                this.uploadInfo.saverID = await this.getSaverIOTileID();
            } catch (err) {
                this.log_warn(
                    "Error getting saver ID for upload on initialization",
                    err
                );
            }

            await this.maintainUploadStatus();
        } else {
            await this.scanForSaver();
        }
    }

    public async scanForSaver() {
        try {
            this.setError(null);
            this.statusCode = DaemonStatus.Busy;
            this.saverInfo = null;

            try {
                await this.triggerAction(DaemonAction.Check);
            } catch (err) {
                this.setError("The Saver Dock was busy, try again.");
                return;
            }

            await delay(1000);

            let statusCode: DaemonStatus = this.statusCode;
            this.$scope.$apply();

            while (statusCode !== DaemonStatus.Idle) {
                await delay(500);
                statusCode = await this.getDaemonStatus();

                // Avoid a glitch when we finish the loop where the status code
                // will be idle before we get the saver info below
                if (statusCode !== DaemonStatus.Idle) {
                    this.statusCode = statusCode;
                    this.$scope.$apply();
                }
            }

            this.saverInfo = await this.getSaverInfo();
            this.statusCode = statusCode;
            this.$scope.$apply();
        } catch (err) {
            this.log_warn("Error scanning for an attached saver.");
        }
    }

    public async cleanup() {
        this.modalOpen = false;
    }

    public async getSaverInfo(): Promise<SaverInfo> {
        const [
            err,
            u1,
            u2,
            u3,
            insertTime,
            timerUsed,
            timerTotal,
            signalUsed,
            signalTotal
        ] = await this.adapter.typedRPC(11, 0x8002, "", "BBBBLHHHH", [], 5.0);

        if (err !== 0) {
            return null;
        }

        try {
            await this.captureMetadata();

            return {
                timerEvents: timerUsed,
                totalTimerSpace: timerTotal,
                signalEvents: signalUsed,
                totalSignalSpace: signalTotal,
                serialNumber: await this.getMetadataValue("Serial"),
                toField: await this.getMetadataValue("ShipTo"),
                fromField: await this.getMetadataValue("ShipFrom")
            };
        } catch (err) {
            if (err instanceof InvalidOperationError) {
                return null;
            }

            throw err;
        }
    }

    public async maintainUploadStatus() {
        this.statusCode = await this.getDaemonStatus();

        while (this.statusCode === DaemonStatus.UploadingData) {
            this.uploadInfo.inProgress = true;
            const progress = await this.getUploadProgress();
            this.statusCode = await this.getDaemonStatus();
            this.uploadInfo.progress = progress;
            this.$scope.$apply();

            await delay(1000);
        }

        this.uploadInfo.progress.task = "Finished";
        this.uploadInfo.progress.finished = null;
        this.uploadInfo.progress.total = null;
        this.$scope.$apply();
    }

    public async showSetupCard() {
        this.setupInfo = new SetupInfo();
        this.setupInfo.inProgress = true;

        try {
            this.setupInfo.templates = await this.fetchTemplateList();

            if (this.setupInfo.templates.length > 0) {
                this.setupInfo.selectedTemplate = this.setupInfo.templates[0];
            }

            this.setupInfo.templatesLoaded = true;
            this.$scope.$apply();
        } catch (err) {
            if (err.userMessage) {
                this.setError(err.userMessage);
            } else {
                this.setError("Unknown error fetching setup templates.");
            }

            this.log_error(err);
            this.setupInfo.inProgress = false;
        }
    }

    public async programSaver() {
        try {
            const result = await this.ui.confirm(
                "Clear and Program?",
                "This will clear all data on the saver, are you sure?",
                UISeverity.Warn
            );
            if (!result) {
                return;
            }

            this.setupInfo.programming = true;
            this.$scope.$apply();

            const selectedIndex = this.setupInfo.templates.indexOf(
                this.setupInfo.selectedTemplate
            );
            if (selectedIndex === -1) {
                throw new ArgumentError("No template was selected");
            }

            this.log_info(
                "Selected programming template",
                selectedIndex,
                this.setupInfo.templates[selectedIndex]
            );

            // Set the programming template on the saver
            await this.adapter.errorHandlingRPC(
                11,
                0x800b,
                "L",
                "L",
                [selectedIndex],
                5.0
            );

            await this.showLoading("Programming...");
            this.triggerAction(DaemonAction.Program);
            await this.waitForIdle();

            // The 3X90 sometimes needs time after programming before it responds to commands
            // again, so force the user to unplug and replug it.
            this.saverInfo = null;
            this.statusCode = DaemonStatus.ProgrammingFinished;
            this.setupInfo.inProgress = false;
            this.$scope.$apply();

            await this.hideLoading();

            await this.ui.alert(
                "Programming Complete",
                "You must now unplug your saver before you can use it.",
                UISeverity.Success
            );
        } catch (err) {
            if (err.userMessage) {
                this.setError(err.userMessage);
            } else {
                this.setError("Unknown error fetching setup templates.");
            }

            this.log_error(err);
            this.setupInfo.inProgress = false;
        } finally {
            this.setupInfo.programming = false;
            this.setupInfo.inProgress = false;
            this.$scope.$apply();

            await this.hideLoading();
        }
    }

    public async waitForIdle() {
        await delay(1000);

        this.statusCode = await this.getDaemonStatus();

        while (this.statusCode !== DaemonStatus.Idle) {
            this.statusCode = await this.getDaemonStatus();
            this.$scope.$apply();

            await delay(500);
        }
    }

    public closeSetupCard() {
        this.setupInfo.inProgress = false;
    }

    public async uploadSaver() {
        this.uploadInfo.progress = { task: null, finished: 0, total: 1 };
        this.uploadInfo.inProgress = true;
        this.error = null;

        try {
            const slug = await this.getSaverIOTileID();
            this.uploadInfo.saverID = slug;
        } catch (err) {
            this.uploadInfo.inProgress = false;
            this.setError("Saver was not registered in iotile.cloud.");
            this.log_error(
                "Attempted upload from unmatched saver: " +
                    this.saverInfo.serialNumber
            );
            return;
        }

        try {
            await this.triggerAction(DaemonAction.Upload);
            await delay(2000); // Make sure the upload has been acknowledged

            this.statusCode = await this.getDaemonStatus();
            if (this.statusCode !== DaemonStatus.UploadingData) {
                this.setError("Error starting upload.");
                return;
            }

            await this.maintainUploadStatus();
        } catch (err) {
            if (err.userMessage) {
                this.setError(err.userMessage);
            } else {
                this.setError("Upload error.");
            }

            this.log_warn(err);
        }
    }

    public async getSaverIOTileID() {
        const [iotile_id, ack] = await this.adapter.errorHandlingRPC(
            11,
            0x8006,
            "",
            "LLL",
            [],
            10.0
        );

        return deviceIDToSlug(iotile_id);
    }

    public closeUploadCard() {
        this.uploadInfo.inProgress = false;
    }

    public async triggerAction(action: DaemonAction) {
        this.adapter.errorHandlingRPC(11, 0x8001, "L", "L", [action], 5.0);
    }

    public async getDaemonStatus(): Promise<DaemonStatus> {
        let status: number;
        [status] = await this.adapter.typedRPC(11, 0x8000, "", "L", [], 5.0);

        return status;
    }

    public async captureMetadata() {
        const [err] = await this.adapter.typedRPC(11, 0x8003, "", "L", [], 5.0);
        if (err !== 0) {
            throw new InvalidOperationError(
                "No saver was attached to capture metadata from"
            );
        }
    }

    /*
     * Tell the daemon to fetch a list of relevant templates from iotile.cloud
     * for the attached saver.
     */
    public async fetchTemplateList(): Promise<string[]> {
        this.triggerAction(DaemonAction.GetTemplates);
        await this.waitForIdle();

        return this.getLocalTemplateList();
    }

    public async getMetadataValue(name: string): Promise<string> {
        if (!(name in MetadataCodes)) {
            throw new ArgumentError("Unknown metadata name: " + name);
        }

        const code = MetadataCodes[name];
        const length: number = await this.getMetadataLength(code);
        let message: string = "";

        while (message.length < length) {
            message += await this.getMetadataChunk(code, message.length);
        }

        return message;
    }

    private async getUploadTask(): Promise<string> {
        // tslint:disable-next-line: prefer-const
        let [err, chunkLength, chunk] = await this.adapter.typedRPC(
            11,
            0x8007,
            "",
            "BB18s",
            [],
            5.0
        );

        if (err !== 0) {
            throw new ArgumentError(
                "Could not get upload task label, code: " + err
            );
        }

        chunk = chunk.substring(0, chunkLength);
        return chunk;
    }

    private async getLocalTemplateList(): Promise<string[]> {
        const [count] = await this.adapter.typedRPC(
            11,
            0x8009,
            "",
            "L",
            [],
            5.0
        );
        const templates: string[] = [];

        for (let i = 0; i < count; ++i) {
            // tslint:disable-next-line: prefer-const
            let [err, length, name] = await this.adapter.typedRPC(
                11,
                0x800a,
                "L",
                "BB18s",
                [i],
                5.0
            );

            if (err !== 0) {
                throw new ArgumentError(
                    "Could not get template list, error: " + err
                );
            }

            name = name.substring(0, length);
            templates.push(name);
        }

        return templates;
    }

    private async getUploadProgress(): Promise<UploadProgress> {
        const task = await this.getUploadTask();

        const [finished, total] = await this.adapter.typedRPC(
            11,
            0x8008,
            "",
            "LL",
            [],
            5.0
        );

        return {
            task,
            finished,
            total
        };
    }

    private async getMetadataLength(code: number): Promise<number> {
        const [err, length] = await this.adapter.typedRPC(
            11,
            0x8004,
            "L",
            "HH",
            [code],
            5.0
        );

        if (err !== 0) {
            throw new InvalidOperationError(
                "No saver attached or invalid metadata code, error code: " + err
            );
        }

        return length;
    }

    private async getMetadataChunk(
        code: number,
        offset: number
    ): Promise<string> {
        // tslint:disable-next-line: prefer-const
        let [err, chunkLength, chunk] = await this.adapter.typedRPC(
            11,
            0x8005,
            "LH",
            "BB18s",
            [code, offset],
            5.0
        );

        if (err !== 0) {
            throw new ArgumentError(
                "Could not get metadata chunk, code: " + code + " error: " + err
            );
        }

        chunk = chunk.substring(0, chunkLength);
        return chunk;
    }
}

angular.module("main").controller("saverDockCtrl", SaverDockModal as any);
