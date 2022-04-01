import {
    Device,
    IOTileCloud,
    Project,
    ProjectTemplate
} from "@iotile/iotile-cloud";
import { ProgressNotifier } from "@iotile/iotile-common";
import {
    FlexibleDictionaryReport,
    IndividualReport,
    IOTileReport,
    POD1M,
    SignedListReport
} from "@iotile/iotile-device";
import angular = require("angular");
import { get } from "lodash";
import { DeviceBaseController, RobustReportService } from "ng-iotile-app";
// tslint:disable-next-line: no-duplicate-imports
import { ProgressModal } from "ng-iotile-app";

interface DeviceInfo {
    osTag: number;
    osVersion: string;

    appTag: number;
    appVersion: string;

    controllerHWString: string;
}

export class DeviceDebugController extends DeviceBaseController {
    public discoveredStreams: { [key: string]: number };
    public deviceInfo: DeviceInfo;
    public connectionInterval: string;
    public cloud: IOTileCloud;
    protected reportService: RobustReportService;

    constructor(
        $stateParams,
        $injector,
        $scope,
        RobustReportService: RobustReportService,
        IOTileCloud
    ) {
        super(
            "DeviceDebugController",
            $stateParams.deviceId,
            $injector,
            $scope
        );
        this.reportService = RobustReportService;
        this.cloud = IOTileCloud;
    }

    public onStreamReceived(report: IOTileReport) {
        if (!(report instanceof IndividualReport)) {
            return;
        }

        this.discoveredStreams[report.reading.variable] = report.reading.value;
        this.$scope.$apply();
    }

    public async downloadPOD1M(
        acknowledge: boolean = false,
        saveReports: boolean = false
    ): Promise<void> {
        const modal = new ProgressModal(
            this.$injector,
            "Downloading Data",
            `Downloading ${acknowledge ? "new" : "all"} data to your phone`
        );
        modal.manageOperation(notifier =>
            this.downloadOperation(notifier, acknowledge, saveReports)
        );

        try {
            await modal.run();
            this.log_info("Modal finished.");
        } catch (err) {
            this.log_warn("Error downloading data from device", err);
        }
    }

    public async downloadPOD1MReportsOnly(): Promise<void> {
        const modal = new ProgressModal(
            this.$injector,
            "Downloading Reports Only",
            "Downloading reports only to your phone"
        );
        modal.manageOperation(notifier =>
            this.downloadReportOperation(notifier)
        );

        try {
            await modal.run();
            this.log_info("Modal finished.");
        } catch (err) {
            this.log_warn("Error downloading data from device", err);
        }
    }

    protected async preInitialize() {
        this.discoveredStreams = {};
        this.deviceInfo = null;

        this.delegateBindings((report: IOTileReport) =>
            this.onStreamReceived(report)
        );
    }

    protected async postInitialize() {
        this.deviceInfo = await this.getDeviceInfo();

        const connInterval = await this.getConnectionInterval();
        if (connInterval != null) {
            this.connectionInterval = connInterval.toFixed(2) + " ms";
        }

        this.$scope.$apply();
    }

    protected async getDeviceInfo(): Promise<DeviceInfo> {
        try {
            const conHW = await this.device.controllerHWVersionRPC();
            const [
                osTag,
                osVersion,
                appTag,
                appVersion
            ] = await this.getVersionTags();

            return {
                osTag,
                appTag,
                appVersion,
                osVersion,
                controllerHWString: conHW
            };
        } catch (err) {
            this.setError(err);
        }
    }

    protected processVersionTag(info: number) {
        const tag = info & ((1 << 20) - 1);
        const version = info >> 20;

        const major = version >> 6;
        const minor = version & ((1 << 6) - 1);

        return {
            tag,
            version: `${major}.${minor}`
        };
    }

    protected async getVersionTags(): Promise<any[]> {
        const [
            uuid,
            stateFlags,
            otherFlags,
            osInfo,
            appInfo
        ] = await this.adapter.typedRPC(8, 0x1008, "", "LLLLL", [], 1.0);

        const osTag = this.processVersionTag(osInfo);
        const appTag = this.processVersionTag(appInfo);

        return [osTag.tag, osTag.version, appTag.tag, appTag.version];
    }

    protected async getConnectionInterval(): Promise<number> {
        try {
            const [
                interval,
                timeout,
                pref_min,
                pref_max,
                pref_timeout
            ] = await this.adapter.errorHandlingRPC(
                8,
                0x8000,
                "",
                "LHHHHHH",
                [],
                1.0
            );
            return interval * 1.25;
        } catch (err) {
            this.log_info(
                `Could not get connection interval because code=${
                    err.errorCode
                }`
            );
        }

        return null;
    }

    protected async downloadOperation(
        progress: ProgressNotifier,
        acknowledge: boolean,
        saveReports: boolean
    ) {
        const pod1m = new POD1M(this.device, this.adapter);
        let highestAckedWaveform: number = null;

        if (acknowledge) {
            try {
                const acks = await this.cloud.fetchAcknowledgements(
                    this.device.slug
                );
                highestAckedWaveform = get(
                    acks.find(ack => ack.index === 256),
                    "highestAck",
                    0
                );
                this.logInfo(
                    `Acknowledging highest received waveform 0x${highestAckedWaveform.toString(
                        16
                    )} from cloud`
                );
            } catch (err) {
                this.logWarning("Couldn't reach the cloud:", err);
                highestAckedWaveform = this.reportService.highestAckForStreamer(
                    this.device.slug,
                    0x100
                );
                this.logInfo(
                    `Acknowledging highest received waveform 0x${highestAckedWaveform.toString(
                        16
                    )}`
                );
            }
        }

        let reports: SignedListReport[] = [];
        let waveforms: any[] = [];

        try {
            this.reportService.ignoreReportsFromDevice(this.device.slug);

            progress.setTotal(6);
            progress.addWarning("Do Not Close App", true);
            // @ts-ignore
            [reports, waveforms] = await pod1m.downloadData(
                progress,
                highestAckedWaveform
            );

            progress.addInfo(`Received ${reports.length} reports`);
            progress.addInfo(`Received ${waveforms.length} waveforms`);
        } finally {
            this.reportService.unignoreReportsFromDevice(this.device.slug);
        }

        const waveformReport = new FlexibleDictionaryReport(
            this.device.deviceID,
            [],
            waveforms
        );

        for (const report of reports) {
            progress.addInfo(
                `Report from streamer ${report.streamer} with ${
                    report.readings.length
                } readings`
            );
        }

        if (saveReports) {
            for (const report of reports) {
                await this.reportService.pushReport(report);
            }

            await this.reportService.pushReport(waveformReport);
        }
    }

    protected async downloadReportOperation(progress: ProgressNotifier) {
        const pod1m = new POD1M(this.device, this.adapter);

        progress.setTotal(3);
        progress.addWarning("Do Not Close App", true);
        // @ts-ignore

        try {
            this.reportService.ignoreReportsFromDevice(this.device.slug);

            const reports = await pod1m.downloadReports(progress);
            progress.addInfo(`Received ${reports.length} reports`);

            for (const report of reports) {
                progress.addInfo(
                    `Report from streamer ${report.streamer} with ${
                        report.readings.length
                    } readings`
                );
            }
        } finally {
            this.reportService.unignoreReportsFromDevice(this.device.slug);
        }
    }
}

angular
    .module("main")
    .controller("deviceDebugCtrl", DeviceDebugController as any);
