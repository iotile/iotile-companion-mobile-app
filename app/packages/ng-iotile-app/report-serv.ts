import * as IOTileCloudModule from "@iotile/iotile-cloud";
import {
    ArgumentError,
    createStreamerSlug,
    delay,
    deviceIDToSlug,
    endsWith,
    MessageSeverity,
    Mutex,
    numberToHexString,
    ProgressNotifier,
    UnknownFileSystemError
} from "@iotile/iotile-common";
import {
    AdapterEvent,
    COMBINED_REPORT_STREAMER,
    IOTileAdapter,
    IOTileDevice,
    ReportParser,
    ReportReassembler,
    SignatureStatus,
    SignedListReport,
    SignedListReportMerger,
    SignedReportSelectors,
    UserRedirectionInfo
} from "@iotile/iotile-device";
// tslint:disable-next-line: no-duplicate-imports
import { FlexibleDictionaryReport } from "@iotile/iotile-device";
import angular = require("angular");
import { AsyncWorkQueue } from "./classes/async-queue";
import { DATA_DIRECTORY, FileSystemService } from "./filesystem-serv";
import { Entry } from "./mocks/mock-filesystem";
import { UserService } from "./user-serv";

/**
 * @ngdoc service
 * @name main.service:RobustReportService
 * @description
 *
 * The RobustReportService is in charge of handling all tasks
 * related to getting reports from devices and uploading them to the
 * cloud.  It interacts with the IOTileAdapter service to get reports and
 * notify devices what readings have been properly received in the cloud.
 *
 * ## Internal Workings
 * Whenever IOTileAdapter connects to a device, by default, any reports that the
 * devices has are streamed to the RobustReportService, which saves them to a file
 * on the phone's file system and keeps track of metadata about the report in the
 * app's database.
 *
 * The user can click a button to upload all reports to the cloud, which also downloads
 * confirmations of the highest reading from the device that has been received in the cloud.
 *
 * Whenever IOTileAdapter connects to a device, any acknowledgments from the cloud previously
 * received are sent to the device before new data is streamed so that the device doesn't send
 * old data.
 *
 * All of this behavior is automatic so the main API for the report service is just related to
 * querying its current state and telling it when to try to upload data.
 *
 * ## Public API
 * There are, by design, not a lot of public methods in RobustReportService.
 * The service is meant to be fully autonomous, managing reports on behalf
 * of the app.
 *
 * Interested users can get the state of the service by either:
 * - calling await RobustReportService.state()
 * - subscribing to angular events on 'STREAMER_REPORT_EVENT' which broadcasts
 *   the same information as RobustReportService.state() every time the state changes
 *   in a user visible way.
 *
 * The only three other methods for managing the report service are:
 * - uploadAllReports which tries to upload all reports currently stored in the app
 *   to the cloud and download corresponding acknowledgments.
 * - clearAllErrors which clears any errors that have been saved in the service like
 *   reports that failed to be uploaded or errors sending acknowledgments back to a
 *   device.
 * - deleteAllReports which should not be generally called but will forcible remove
 *   all reports currently stored in the device.
 *
 * By default, all reports received from a device are stored for later upload to the cloud.
 *
 * If you want to ignore reports from a certain device you can use:
 * - ignoreReportsFromDevice(deviceSlug)
 *
 * If you want to later stop ignoring reports, you can use:
 * - unignoreReportsFromDevice(deviceSlug)
 *
 * The ignore/unignore state is not stored persistently and must be set every time the app
 * loads.
 */

const ACK_FILE_NAME: string = "report_acks.json";

export interface SerializedReportData {
    device: number;
    deviceSlug: string;
    timestamp: Date;
    numReadings: number;
    lowestReadingId: number;
    highestReadingId: number;
    streamer: number;
    key: string;
    length: number;
    uploaded: boolean;
    error?: string;
    isFlexibleDict?: boolean;
}

export interface DBReportEntry extends SerializedReportData {
    acknowledged: boolean;
}

export interface DBReports {
    reports: DBReportEntry[];
}

export interface ReportServiceState {
    reports: DBReportEntry[];
    cleanReportsToUpload: boolean;
    reportsToUpload: boolean;
    hasErrors: boolean;
    hasFinished: boolean;
    globalError: string;
}

export interface DeviceReportStatus {
    hasReportsToUpload: boolean;
    hasUnacknowledged: boolean;
}

export interface ReportUploadStatus {
    numberSuccessful: number;
    numberFailed: number;
}

export interface StreamerAcknowledgement {
    streamerID: number;
    ackValue: number;
}

interface DeviceBackoffInfo {
    lastCheck: Date;
    checkCount: number;
}

interface SerializedAcknowledgements {
    [key: string]: { [key: number]: StreamerAcknowledgement };
}

export class RobustReportService {
    public cache: ReportCache;

    private queue: AsyncWorkQueue;
    private adapter: IOTileAdapter;
    private log: ng.ILogService;
    private fs: FileSystemService;
    private initialized: Promise<void>;
    private $rootScope: ng.IRootScopeService;
    private cloud: IOTileCloudModule.IOTileCloud;
    private _errorMessage: string;
    private ignoredDevices: {
        [key: string]: { allStreamers: boolean; onlyStreamer: number };
    };
    private user: UserService;
    private net;
    private hasGlobalAckList: boolean;

    private fsMutex: Mutex;

    constructor(
        Config,
        IOTileCloud,
        User,
        NetService,
        IOTileAdapter: IOTileAdapter,
        $log: ng.ILogService,
        FileSystemService: FileSystemService,
        $rootScope
    ) {
        const that = this;
        this.adapter = IOTileAdapter;
        this.log = $log;
        this.user = User;
        this.fs = FileSystemService;
        this.$rootScope = $rootScope;
        this.cloud = IOTileCloud;
        this.ignoredDevices = {};
        this.cache = new ReportCache();
        this.net = NetService;

        this.hasGlobalAckList = false;

        this._errorMessage = null;

        this.fsMutex = new Mutex();

        /**
         * Create an internal async work queue whose job is to asynchronously process reports that
         * are received from an IOTile Device and store them on the phone's filesystem.
         */
        this.queue = new AsyncWorkQueue(async function(
            type: string,
            value: any
        ): Promise<any> {
            await that.initialized;
            return that.processReport(value);
        });

        // NB This call happens asynchronously since constructors cannot be async
        // This promise is used to gate all report services activities to only occur
        // after filesystem and database initialization.
        this.initialized = this.prepareFileSystem();

        // Register with IOTileAdapter to receive robust reports when they come in
        this.adapter.subscribe(AdapterEvent.RawRobustReport, async function(
            event,
            report
        ) {
            try {
                await that.queue.process("robust_report", report);
            } catch (err) {
                that.log.error(
                    "[ReportService] Could not process report received from IOTileAdapter",
                    err
                );
            }
        });

        // Hook into IOTileAdapter to acknowledge reports back to devices automatically
        this.adapter.registerConnectionHook(async function(
            device,
            adapter
        ): Promise<UserRedirectionInfo> {
            await that.acknowledgeReportsToDevice(device);

            return null;
        });

        // Hook into the UserService to clean out our data whenever we login and logout
        this.user.addLoginHook((event: string) =>
            this.onUserChangedHook(event)
        );
        this.user.addLogoutHook((event: string) =>
            this.onUserChangedHook(event)
        );

        // Start our infinite background task checking for acknowledgments to reports that we have
        // uploaded.
        this.periodicAckCheckLoop();

        this.log.log(
            "[ReportService] Initialized and subscribed to report events"
        );
    }

    public ignoreReportsFromDevice(deviceSlug: string, onlyStreamer?: number) {
        const ignoreData = { allStreamers: true, onlyStreamer: null };

        if (onlyStreamer != null) {
            ignoreData.onlyStreamer = onlyStreamer;
            ignoreData.allStreamers = false;
        }

        this.ignoredDevices[deviceSlug] = ignoreData;
    }

    public unignoreReportsFromDevice(deviceSlug: string) {
        if (deviceSlug in this.ignoredDevices) {
            delete this.ignoredDevices[deviceSlug];
        }
    }

    public async state(): Promise<ReportServiceState> {
        await this.initialized;

        const reports = this.cache.allReports();
        return this.stateInternal(reports);
    }

    public async deleteReport(key: string) {
        await this.initialized;

        const releaseFS = await this.fsMutex.acquire();

        try {
            await this.deleteReportUnsafe(key);
        } finally {
            releaseFS();
        }
    }

    public async deleteAllReports() {
        await this.initialized;

        const releaseFS = await this.fsMutex.acquire();
        let lastError = null;
        const reports = this.cache.allReports();

        try {
            // tslint:disable-next-line: prefer-for-of
            for (let i = 0; i < reports.length; ++i) {
                try {
                    await this.deleteReportUnsafe(reports[i].key);
                } catch (err) {
                    lastError = err;
                }
            }

            await this.deleteAcknowledgementsUnsafe();
        } finally {
            releaseFS();
        }

        this.notifyChange(this.cache.allReports());

        if (lastError !== null) {
            throw lastError;
        }
    }

    public async pushReport(
        report: SignedListReport | FlexibleDictionaryReport
    ): Promise<void> {
        return this.queue.process("robust_report", report);
    }

    /**
     * Return the highest currently cached acknowledge value for a given streamer.
     *
     * If there is no acknowledgement value cached, 0 is returned.
     *
     * @param slug The device slug for the streamer that we are interested in
     * @param streamerIndex The index of the streamer that we are interested in
     */
    public highestAckForStreamer(slug: string, streamerIndex: number): number {
        const acks = this.cache.acksForDevice(slug);

        for (const ack of acks) {
            if (ack.streamerID === streamerIndex) {
                return ack.ackValue;
            }
        }

        return 0;
    }

    public async clearErrors() {
        await this.initialized;

        const releaseFS = await this.fsMutex.acquire();

        if (this._errorMessage) {
            this._errorMessage = null;
        }

        try {
            const reports = this.cache.allReports();

            // tslint:disable-next-line: prefer-for-of
            for (let i = 0; i < reports.length; ++i) {
                if (reports[i].error === null) {
                    continue;
                }

                const report = reports[i];
                try {
                    this.log.debug(
                        "Clearing report with key: " +
                            report.key +
                            " with error: " +
                            report.error
                    );
                    await this.deleteReportUnsafe(report.key);
                } catch (err) {
                    this._errorMessage =
                        "Error clearing reports: " + JSON.stringify(err);
                } finally {
                    this.notifyChange(this.cache.allReports());
                }
            }
        } finally {
            releaseFS();
        }
    }

    public async clearFinished() {
        await this.initialized;

        const releaseFS = await this.fsMutex.acquire();

        try {
            const reports = this.cache.allReports();

            // tslint:disable-next-line: prefer-for-of
            for (let i = 0; i < reports.length; ++i) {
                if (!reports[i].acknowledged) {
                    continue;
                }

                const report = reports[i];

                try {
                    this.log.debug(
                        "Clearing acknowledged report with key: " + report.key
                    );
                    await this.deleteReportUnsafe(report.key);
                } catch (err) {
                    this._errorMessage =
                        "Error clearing report: " + JSON.stringify(err);
                }
            }
        } finally {
            releaseFS();
            this.notifyChange(this.cache.allReports());
        }
    }

    public reportStatusForDevice(slug: string): DeviceReportStatus {
        return {
            hasReportsToUpload: this.cache.hasReportsToUpload(slug),
            hasUnacknowledged: this.cache.hasUnacknowledgedReports(slug)
        };
    }

    public async uploadReportsForDevice(
        deviceSlug: string,
        includeErrors: boolean,
        progress?: ProgressNotifier
    ) {
        await this.initialized;
        await this.cloud.initialized;

        if (!progress) {
            progress = new ProgressNotifier();
        }

        const releaseFS = await this.fsMutex.acquire();

        try {
            const reports = this.cache.waitingReportsForDevice(
                deviceSlug,
                false
            );
            const toUploadCount = this.cache.countReportsToUpload(
                includeErrors
            );
            let uploaded: number = 0;
            let errors: number = 0;

            try {
                progress.setTotal(toUploadCount);

                // tslint:disable-next-line: prefer-for-of
                for (let i = 0; i < reports.length; ++i) {
                    const report = reports[i];
                    const metaPath = "reports/" + reports[i].key + ".json";
                    let filePath = "reports/" + reports[i].key;

                    if (report.isFlexibleDict === true) {
                        filePath += ".mp";
                    } else {
                        filePath += ".bin";
                    }

                    progress.startOne(
                        "Uploading report from " + report.deviceSlug,
                        1
                    );

                    // Don't try to upload reports that have already been uploaded or that have errors (unless we're told we should try errored reports again)
                    // Also, don't upload reports that are duplicates of what has already been acknowledged in the cloud.  A report can be acknowledged but not
                    // uploaded if it is a duplicate or subset of a report that has already been uploaded.
                    if (report.uploaded || report.acknowledged) {
                        continue;
                    }

                    if (report.error && !includeErrors) {
                        continue;
                    }

                    try {
                        await this.uploadReport(filePath, report.timestamp);
                        report.uploaded = true;
                        report.error = null; // If we uploaded the report correctly, clear any associated error
                        uploaded += 1;
                        this.log.debug(
                            "[ReportService] Successfully uploaded report at path '" +
                                filePath +
                                "'"
                        );
                    } catch (err) {
                        this.log.error(
                            "[ReportService] Error uploading report at path: " +
                                filePath,
                            err
                        );
                        let msg = "Error uploading report from device";

                        // The most likely error is an http error, so in that case show a nice message
                        if (err instanceof IOTileCloudModule.HttpError) {
                            msg = err.userMessage;
                        }

                        report.error = msg;
                        errors += 1;
                    } finally {
                        if (report.uploaded) {
                            this.cache.setUploaded(report.key);
                        }

                        if (report.error) {
                            this.cache.setError(report.key, report.error);
                            progress.addMessage(
                                MessageSeverity.Error,
                                report.error
                            );
                            progress.fatalError(
                                `Failed to Upload Report for streamer ${
                                    report.streamer
                                } to Cloud`
                            );
                        }

                        await this.fs.writeJSONFile(metaPath, report);
                    }

                    progress.finishOne();
                }
            } finally {
                this.notifyChange(reports);
                this.log.info(
                    "[ReportService] Uploaded " +
                        uploaded +
                        " reports with " +
                        errors +
                        " errors"
                );
            }

            return { numberFailed: errors, numberSuccessful: uploaded };
        } finally {
            releaseFS();
        }
    }

    public async uploadAllReports(
        includeErrors: boolean,
        progress?: ProgressNotifier
    ): Promise<ReportUploadStatus> {
        await this.initialized;
        await this.cloud.initialized;

        if (!progress) {
            progress = new ProgressNotifier();
        }

        const releaseFS = await this.fsMutex.acquire();

        try {
            const reports = this.cache.allReports();
            const toUploadCount = this.cache.countReportsToUpload(
                includeErrors
            );
            let uploaded: number = 0;
            let errors: number = 0;

            try {
                progress.setTotal(toUploadCount);

                // tslint:disable-next-line: prefer-for-of
                for (let i = 0; i < reports.length; ++i) {
                    const report = reports[i];
                    const metaPath = "reports/" + reports[i].key + ".json";
                    let filePath = "reports/" + reports[i].key;

                    if (report.isFlexibleDict === true) {
                        filePath += ".mp";
                    } else {
                        filePath += ".bin";
                    }

                    progress.startOne(
                        "Uploading report from " + report.deviceSlug,
                        1
                    );

                    // Don't try to upload reports that have already been uploaded or that have errors (unless we're told we should try errored reports again)
                    // Also, don't upload reports that are duplicates of what has already been acknowledged in the cloud.  A report can be acknowledged but not
                    // uploaded if it is a duplicate or subset of a report that has already been uploaded.
                    if (report.uploaded || report.acknowledged) {
                        continue;
                    }

                    if (report.error && !includeErrors) {
                        continue;
                    }

                    try {
                        await this.uploadReport(filePath, report.timestamp);
                        report.uploaded = true;
                        report.error = null; // If we uploaded the report correctly, clear any associated error
                        uploaded += 1;
                        this.log.debug(
                            "[ReportService] Successfully uploaded report at path '" +
                                filePath +
                                "'"
                        );
                    } catch (err) {
                        this.log.error(
                            "[ReportService] Error uploading report at path: " +
                                filePath,
                            err
                        );
                        let msg = "Error uploading report from device";

                        // The most likely error is an http error, so in that case show a nice message
                        if (err instanceof IOTileCloudModule.HttpError) {
                            msg = err.userMessage;
                        }

                        report.error = msg;
                        errors += 1;
                    } finally {
                        if (report.uploaded) {
                            this.cache.setUploaded(report.key);
                        }

                        if (report.error) {
                            this.cache.setError(report.key, report.error);
                            progress.addMessage(
                                MessageSeverity.Warn,
                                report.error
                            );
                        }

                        await this.fs.writeJSONFile(metaPath, report);
                    }

                    progress.finishOne();
                }
            } finally {
                this.notifyChange(reports);
                this.log.info(
                    "[ReportService] Uploaded " +
                        uploaded +
                        " reports with " +
                        errors +
                        " errors"
                );
            }

            return { numberFailed: errors, numberSuccessful: uploaded };
        } finally {
            releaseFS();
        }
    }

    public async saveAcknowledgements() {
        await this.initialized;

        const releaseFS = await this.fsMutex.acquire();

        try {
            await this.saveAcknowledgementsUnsafe();
        } finally {
            releaseFS();
        }
    }

    private async onUserChangedHook(event: string) {
        this.log.info(
            "[ReportData] Clearing all report data on user login/logout"
        );
        await this.deleteAllReports();
    }

    private stateInternal(reports: DBReportEntry[]): ReportServiceState {
        const result: ReportServiceState = {
            reports,
            reportsToUpload: false,
            cleanReportsToUpload: false,
            hasErrors: false,
            globalError: null,
            hasFinished: false
        };

        if (this._errorMessage !== null) {
            result.hasErrors = true;
            result.globalError = this._errorMessage;
        }

        // tslint:disable-next-line: prefer-for-of
        for (let i = 0; i < reports.length; ++i) {
            if (
                reports[i].uploaded === false &&
                reports[i].error == null &&
                reports[i].acknowledged === false
            ) {
                result.cleanReportsToUpload = true;
            }

            if (
                reports[i].uploaded === false &&
                reports[i].acknowledged === false
            ) {
                result.reportsToUpload = true;
            }

            if (reports[i].error !== null) {
                result.hasErrors = true;
            }

            if (reports[i].acknowledged) {
                result.hasFinished = true;
            }
        }

        return result;
    }

    private async loadReportUnsafe(key: string): Promise<SignedListReport> {
        const contents = await this.fs.readFile("reports/" + key + ".bin");
        const parser = new ReportParser(contents.byteLength);
        const parsed = parser.pushData(contents);

        if (parsed.length !== 1) {
            throw new ArgumentError("Could not parse saved report");
        }

        return parsed[0] as SignedListReport;
    }

    private async deleteReportUnsafe(key: string) {
        // Remove report from our in memory cache and then
        // remove the files from disk.
        try {
            const report = this.cache.get(key);
            this.cache.removeReport(key);

            await this.fs.removeFile("reports/" + report.key + ".json");

            if (report.isFlexibleDict) {
                await this.fs.removeFile("reports/" + report.key + ".mp");
            } else {
                await this.fs.removeFile("reports/" + report.key + ".bin");
            }
        } catch (err) {
            this.log.warn("Error deleting report", err);
            throw err;
        }
    }

    private async acknowledgeReportsToDevice(device: IOTileDevice) {
        await this.initialized;

        const releaseFS = await this.fsMutex.acquire();

        try {
            const acks = this.cache.acksForDevice(device.slug);

            /*
             * We had a previous issue where we used streamers with ids > 255 (0xFF) to
             * keep track of device related data but did not have an actual streamer allocated in the
             * device.  This made sense because there was only one byte used in the device for a streamer
             * index, so any streamer with ID > 255 was invalid.
             *
             * Unfortunately, The streamer parameter in the RPC argument structure was encoded as 16-bit integer
             * but interpreted as an 8-bit integer with the high byte masked off by the firmware, which means that
             * streamer 0x100 wraps around to 0x00.  In particular, this meant that the fake streamer 0x100 that
             * was used to keep track of the UTC timestamps of waveforms that we have uploaded was incorrectly
             * applied to streamer 0, causing it to lose track of what readings had been correctly uploaded.
             *
             * We now add a check here for whether the device has a 0x100 streamer that was incorrectly applied
             * and if so, we force roll back streamer 0. We have to also handle the case where the POD-1M is
             * reset so there are no streamer records in the cloud but it has incorrect streamer information
             * stored in firmware.  To handle that case, if the device has a POD-1M app tag, we always check
             * for invalid streamer acks and reset them.
             */

            try {
                const info = await device.getDeviceInfo();

                this.log.info(`Device Information: ${JSON.stringify(info)}`);
                if (info.appTag === 2049) {
                    const userInfo = await device.queryStreamerRPC(0);
                    const highestAck = await device.highestUniqueIDRPC();

                    if (userInfo.highestAck > highestAck) {
                        this.log.warn(
                            "[ReportService] Found POD-1M with streamer 0x100 wrapped to 0x00"
                        );
                        device.acknowledgeStreamerRPC(0, 1, true);
                        this.log.error(
                            `[ReportService] Fixed POD-1M with streamer 0x100 wrapped to 0x00 (slug: ${
                                device.slug
                            }, oldValue: ${userInfo.highestAck})`
                        );
                    }
                }
            } catch (err) {
                this.log.warn(
                    `[ReportService] Error getting device info: ${JSON.stringify(
                        err
                    )}`
                );
            }

            // If there are no reports for a device, we're done.
            if (acks.length === 0) {
                return;
            }

            let streamer256: number = null;
            for (const ack of acks) {
                if (ack.streamerID === 0x100) {
                    streamer256 = ack.ackValue;
                    break;
                }
            }

            // We have a critical bug in controller version 2.9.0 that causes the ack for streamer 1 to
            // be incorrectly applied to streamer 0, so if that happens, reset the ack for streamer 0 to
            // what we have in the cloud always when we connect.
            //
            // If the user upgraded from 2.9.0 to 2.9.1 however, they may still have an incorrect ack stored
            // on the device, so make sure we check for this bug on both 2.9.0 and 2.9.1

            const version = await device.controllerVersionRPC();

            let errorCount = 0;
            let fixUserAck = false;

            if (version === "2.9.0" || version === "2.9.1") {
                try {
                    const userInfo = await device.queryStreamerRPC(0);
                    const systemInfo = await device.queryStreamerRPC(1);

                    if (userInfo.highestAck === systemInfo.highestAck) {
                        this.log.warn(
                            "[ReportService] Forcing user ack fix from buggy 2.9.0 controller firmware"
                        );
                        fixUserAck = true;
                    }
                } catch (err) {
                    this.log.warn(
                        "[ReportService] Error querying streamers on device.  This usually means the device isn't a production device.",
                        err
                    );
                }
            }

            if (streamer256 !== null) {
                try {
                    const userInfo = await device.queryStreamerRPC(0);

                    if (
                        streamer256 !== null &&
                        userInfo.highestAck === streamer256
                    ) {
                        this.log.error(
                            "[ReportService] Fixing streamer 0x100 wraparound that overwrote streamer 0"
                        );
                        fixUserAck = true;
                    }
                } catch (err) {
                    this.log.warn(
                        "[ReportService] Error querying streamers on device.  This usually means the device isn't a production device.",
                        err
                    );
                }
            }

            // tslint:disable-next-line: prefer-for-of
            for (let i = 0; i < acks.length; ++i) {
                const ack = acks[i];

                if (ack.streamerID > 255) {
                    continue;
                }

                this.log.info(
                    "[ReportService] Sending ack to device for streamer " +
                        ack.streamerID +
                        " and id " +
                        ack.ackValue
                );
                try {
                    if (ack.streamerID === 0 && fixUserAck) {
                        await device.acknowledgeStreamerRPC(
                            ack.streamerID,
                            ack.ackValue,
                            true
                        );
                    } else {
                        await device.acknowledgeStreamerRPC(
                            ack.streamerID,
                            ack.ackValue,
                            false
                        );
                    }
                } catch (err) {
                    errorCount += 1;
                    this.log.error(
                        "[ReportService] Error sending acknowledgment to device: " +
                            JSON.stringify(err)
                    );
                }
            }

            if (errorCount) {
                try {
                    this.notifyChange(this.cache.allReports());
                } catch (err) {
                    this.log.error(
                        "[ReportService] Error updating report list and notifying after ackowledgment to device: " +
                            JSON.stringify(err)
                    );
                }
            }
        } finally {
            releaseFS();
        }
    }

    private async uploadReport(filePath: string, timestamp: Date) {
        const found = await this.fs.checkFile(filePath);

        if (!found) {
            throw new UnknownFileSystemError(
                UnknownFileSystemError.NOT_FOUND_ERR
            );
        }

        const jwt: string = this.user.getToken();
        const options = {
            fileName: filePath,
            fileKey: "file",
            chunkedMode: false,
            mimeType: "application/octet-stream",
            headers: {
                "cache-control": "no-cache",
                Authorization: "JWT " + jwt
            }
        };

        const uploadURL = encodeURI(
            this.cloud.server.url +
                "/streamer/report/?timestamp=" +
                timestamp.toISOString()
        );
        this.log.info(
            "[Report Service] Uploading report at path '" +
                filePath +
                "' to URL '" +
                uploadURL +
                "'"
        );
        await this.fs.uploadFile(filePath, uploadURL, options, true);
    }

    private parseSavedMetaData(key: string, report: any): SerializedReportData {
        return {
            device: report.device,
            deviceSlug: report.deviceSlug,
            timestamp: new Date(report.timestamp),
            numReadings: report.numReadings,
            lowestReadingId: report.lowestReadingId,
            highestReadingId: report.highestReadingId,
            streamer: report.streamer,
            key,
            length: report.length,
            uploaded: report.uploaded,
            error: report.error,
            isFlexibleDict: report.isFlexibleDict
        };
    }

    private createReportDBEntry(
        report: SignedListReport | FlexibleDictionaryReport,
        path: string
    ): DBReportEntry {
        const timestamp = new Date();
        let numReadings = 0;

        if (report instanceof SignedListReport) {
            numReadings = report.readings.length;
        } else {
            numReadings = report.numEvents;
        }

        const entry: DBReportEntry = {
            device: report.deviceID,
            deviceSlug: deviceIDToSlug(report.deviceID),
            timestamp,
            numReadings,
            lowestReadingId: report.readingIDRange[0],
            highestReadingId: report.readingIDRange[1],
            streamer: report.streamer,
            key: path,
            length: report.rawData.byteLength,
            uploaded: false,
            error: null,
            acknowledged: false,
            isFlexibleDict: report instanceof FlexibleDictionaryReport
        };

        return entry;
    }

    private async processReport(
        report: SignedListReport | FlexibleDictionaryReport
    ) {
        await this.initialized;

        const duplicate = await this.checkDuplicate(report);
        if (duplicate) {
            this.log.info("[ReportService] Dropping duplicate report");
            return;
        }

        if (this.checkIgnored(report)) {
            this.log.info(
                "[ReportService] Dropping report from ignored device"
            );
            return;
        }

        if (
            report instanceof SignedListReport &&
            report.validity === SignatureStatus.Invalid
        ) {
            this.log.error(
                `[ReportService] Dropping report with invalid signature from streamer ${
                    report.streamer
                }`
            );
            return;
        }

        await this.saveReport(report);
        this.notifyChange(this.cache.allReports());
    }

    private notifyChange(reportList: DBReportEntry[]) {
        const result = this.stateInternal(reportList);
        this.$rootScope.$broadcast("STREAMER_REPORT_EVENT", result);
    }

    /*
     * Load metadata from all saved reports into memory
     */
    private async loadSavedReports() {
        let entries: Entry[];
        try {
            entries = await this.fs.listDirectory("reports");
        } catch (err) {
            this.log.log(
                "[ReportService] error listing reports directory",
                err
            );
        }

        const foundKeys = {};
        let foundCount = 0;

        // tslint:disable-next-line: prefer-for-of
        for (let i = 0; i < entries.length; ++i) {
            const entry = entries[i];

            this.log.debug(
                "[ReportService] found file in reports directory on initialization",
                entry
            );

            if (!entry.isFile) {
                this.log.warn(
                    "[ReportService] Unexpected directory in reports folder, skipping",
                    entry
                );
                continue;
            }

            let name = entry.name;
            let fileType: string = null;

            if (name === ACK_FILE_NAME) {
                continue;
            }

            if (endsWith(name, ".json")) {
                name = name.substring(0, name.length - 5);
                fileType = "json";
            } else if (endsWith(name, ".bin")) {
                name = name.substring(0, name.length - 4);
                fileType = "bin";
            } else if (endsWith(name, ".mp")) {
                name = name.substring(0, name.length - 3);
                fileType = "bin";
            } else {
                try {
                    this.log.info(
                        "[ReportService] Removing unexpected file in reports folder: ",
                        entry.fullPath
                    );
                    await this.fs.removeFile(entry.fullPath);
                } catch (err) {
                    this.log.warn(
                        "[ReportService] Could not remove unexpected file in reports folder, skipping: " +
                            entry.fullPath,
                        err
                    );
                }

                continue;
            }

            if (!(name in foundKeys)) {
                foundKeys[name] = { json: null, bin: null };
                foundCount += 1;
            }

            foundKeys[name][fileType] = entry.fullPath;
        }

        // Now we have a dictionary of all of the reports in this folder
        this.log.info(
            "[ReportService] Found " + foundCount + " potential reports"
        );

        for (const key in foundKeys) {
            const report = foundKeys[key];

            if (!report.json || !report.bin) {
                this.log.warn(
                    "[ReportService] Incomplete report found in reports directory, cleaning " +
                        key
                );

                try {
                    if (report.json !== null) {
                        await this.fs.removeFile(report.json);
                    }

                    if (report.bin !== null) {
                        await this.fs.removeFile(report.bin);
                    }
                } catch (err) {
                    this.log.error(
                        "[ReportService] Error removing partial report during service initialization",
                        err
                    );
                }

                continue;
            }

            try {
                const reportMetaData: {} = await this.fs.readJSONFile(
                    report.json
                );
                const parsedMetaData = this.parseSavedMetaData(
                    key,
                    reportMetaData
                );
                this.cache.addReport(parsedMetaData);
            } catch (err) {
                this.log.error(
                    "[ReportService] Error reading report metadata from filesystem",
                    err
                );
                this.log.info(
                    "[ReportService] Purging metadata file",
                    report.json
                );
                await this.fs.removeFile(report.json);
                this.log.error(
                    "[ReportService] Purging report file",
                    report.bin
                );
                await this.fs.removeFile(report.bin);
            }
        }

        // Check if we have an any saved acknowledgments to load
        await this.loadSavedAcknowledgementsUnsafe();
    }

    private async loadSavedAcknowledgementsUnsafe() {
        const ackPath = "reports/" + ACK_FILE_NAME;

        if (!(await this.fs.checkFile(ackPath))) {
            return;
        }

        try {
            const savedAcks: SerializedAcknowledgements = await this.fs.readJSONFile(
                ackPath
            );

            for (const slug in savedAcks) {
                for (const streamer in savedAcks[slug]) {
                    const ack = savedAcks[slug][streamer];
                    this.cache.addAcknowledgement(
                        slug,
                        ack.streamerID,
                        ack.ackValue
                    );
                }
            }

            this.hasGlobalAckList = true;
        } catch (err) {
            this.log.error(
                "[ReportService] Error loading saved acknowledgments",
                err
            );
            await this.fs.removeFile(ackPath);
        }
    }

    private async saveAcknowledgementsUnsafe() {
        const ackPath = "reports/" + ACK_FILE_NAME;

        const acks = this.cache.getAllAcknowledgments();
        await this.fs.writeJSONFile(ackPath, acks);
        this.hasGlobalAckList = true;
    }

    private async deleteAcknowledgementsUnsafe() {
        const ackPath = "reports/" + ACK_FILE_NAME;

        if (await this.fs.checkFile(ackPath)) {
            await this.fs.removeFile(ackPath);
        }

        this.hasGlobalAckList = false;
        this.cache.clearAcknowledgements();
    }

    private async prepareFileSystem() {
        // We only start our work after the User Service has authenticated the logged in user
        await this.user.initialized;
        await this.cloud.initialized;

        try {
            if (!(await this.fs.checkDirectory("reports"))) {
                await this.fs.createDirectory("reports");
            }

            await this.loadSavedReports();
        } catch (err) {
            this._errorMessage = "Could not prepare filesytem: " + err.message;
            this.log.error(
                "[ReportService] Could not check or create reports directory",
                err
            );

            throw err;
        }
    }

    private createFilename(
        report: SignedListReport | FlexibleDictionaryReport
    ) {
        const filename: string =
            numberToHexString(report.deviceID, 8) +
            "-" +
            numberToHexString(report.streamer, 4);
        const now = new Date().getTime().toString();

        return filename + "-" + now;
    }

    private async checkDuplicate(
        report: SignedListReport | FlexibleDictionaryReport
    ) {
        // FIXME: Check for duplicates here
        return false;
    }

    private checkIgnored(report: SignedListReport | FlexibleDictionaryReport) {
        const slug = deviceIDToSlug(report.deviceID);

        if (slug in this.ignoredDevices && this.ignoredDevices[slug]) {
            const ignoreData = this.ignoredDevices[slug];

            if (
                ignoreData.allStreamers ||
                ignoreData.onlyStreamer === report.streamer
            ) {
                return true;
            }
        }

        return false;
    }

    /*
     * This internal function must be called with the fsMutex held
     */
    private async saveReportMetadataUnsafe(report: DBReportEntry) {
        const metaFilePath = "reports/" + report.key + ".json";
        await this.fs.writeJSONFile(metaFilePath, report);
    }

    /*
     * Loop forever, checking for acknowledgments from the server for reports
     * that we have.  At most once per hour, also download preemptively a list
     * of all acks for all devices that we know about so that we have them in
     * case we connect to a device offline.
     */
    private async periodicAckCheckLoop() {
        let lastGlobalCheck: Date = null;

        await this.initialized;
        await this.cloud.initialized;

        while (true) {
            await delay(5000);

            if (!this.net.isOnline() || !this.user.isAuthenticated()) {
                continue;
            }

            const now = new Date();
            let globalCheck = false;

            /*
             * We update our global list of acks for all devices at most once an hour except
             * - if we logout and log back in we would have deleted the global ack list so we get another one immediately
             */
            if (
                !this.hasGlobalAckList ||
                lastGlobalCheck == null ||
                (now.getTime() - lastGlobalCheck.getTime()) / 1000.0 > 60 * 60
            ) {
                lastGlobalCheck = now;
                globalCheck = true;
            }

            try {
                let acks: IOTileCloudModule.StreamerAck[] = [];

                if (globalCheck) {
                    acks = await this.cloud.fetchAcknowledgements();
                    this.log.info(
                        "[ReportService] Preemptively downloaded " +
                            acks.length +
                            " acks for our devices"
                    );
                } else {
                    acks = await this.checkPendingDeviceAcks();
                }

                if (acks.length > 0) {
                    await this.updateAcknowledgements(acks);
                }
            } catch (err) {
                this.log.error("Unhandled error in periodicAckCheckLoop", err);
            }
        }
    }

    /*
     * Periodically check the server for acknowledgements for uploaded streamers
     */
    private async checkPendingDeviceAcks(): Promise<
        IOTileCloudModule.StreamerAck[]
    > {
        const devicesToCheck = this.cache.getDevicesToCheck();
        const checkPromises: Array<
            Promise<IOTileCloudModule.StreamerAck[]>
        > = [];

        if (devicesToCheck.length === 0) {
            return [];
        }

        this.log.info(
            "Checking for acks for " + devicesToCheck.length + " devices"
        );

        for (const deviceSlug of devicesToCheck) {
            const promise = this.cloud.fetchAcknowledgements(deviceSlug);
            this.cache.recordAckCheck(deviceSlug);

            checkPromises.push(promise);
        }

        let acks: IOTileCloudModule.StreamerAck[] = [];

        // tslint:disable-next-line: prefer-for-of
        for (let i = 0; i < checkPromises.length; ++i) {
            try {
                const deviceAcks = await checkPromises[i];
                acks = acks.concat(deviceAcks);
            } catch (err) {
                this.log.error(
                    "Error downloading acknowledgements for device",
                    err
                );
                // Eat the error so we continue downloading acks for other devices
            }
        }

        return acks;
    }

    private async updateAcknowledgements(
        acks: IOTileCloudModule.StreamerAck[]
    ) {
        const releaseFS = await this.fsMutex.acquire();

        try {
            for (const ack of acks) {
                this.cache.addAcknowledgement(
                    ack.deviceSlug,
                    ack.index,
                    ack.highestAck
                );
            }

            await this.saveAcknowledgementsUnsafe();
        } finally {
            releaseFS();
        }

        this.notifyChange(this.cache.allReports());
    }

    private async saveReport(
        report: SignedListReport | FlexibleDictionaryReport
    ): Promise<string> {
        await this.initialized;

        const releaseFS = await this.fsMutex.acquire();

        try {
            const filename = this.createFilename(report);
            let reportFilePath: string = "reports/" + filename;

            if (report instanceof SignedListReport) {
                reportFilePath += ".bin";
            } else {
                reportFilePath += ".mp";
            }

            const data = new Blob([report.rawData], {
                type: "application/octet-stream"
            });
            const reportMetaData = this.createReportDBEntry(report, filename);

            let cleanupReport = false;

            try {
                await this.fs.writeFile(reportFilePath, data);
                cleanupReport = true;

                await this.saveReportMetadataUnsafe(reportMetaData);
                this.log.info(
                    "[ReportService] Saved report to disk with key: " + filename
                );

                this.cache.addReport(reportMetaData);
                this.log.info(
                    "[ReportService] Successfully processed report: " +
                        JSON.stringify(reportMetaData)
                );
            } catch (err) {
                if (cleanupReport) {
                    await this.fs.removeFile(reportFilePath);
                }

                throw err;
            }

            return filename;
        } finally {
            releaseFS();
        }
    }
}

/*
 * An in memory cache of report files stored on disk that can be updated and queried
 * in various ways.
 */
// tslint:disable-next-line: max-classes-per-file
class ReportCache {
    public static readonly AckCheckSchedule = [
        0,
        5,
        5,
        15,
        15,
        60,
        60 * 5,
        60 * 10
    ]; // The number of seconds to wait between checks
    private cache: { [key: string]: DBReportEntry };
    private acks: SerializedAcknowledgements;
    private devicesToCheck: { [key: string]: DeviceBackoffInfo };

    constructor() {
        this.cache = {};
        this.acks = {};
        this.devicesToCheck = {};
    }

    public addReport(entry: SerializedReportData) {
        if (entry.key in this.cache) {
            throw new ArgumentError(
                "Attempted to add a report with an existing key: " + entry.key
            );
        }

        const copy: DBReportEntry = angular.copy(entry) as any;
        copy.acknowledged = this.reportAcknowledged(entry);

        this.cache[entry.key] = copy;
    }

    public clearAcknowledgements() {
        this.acks = {};
    }

    public addAcknowledgement(
        deviceSlug: string,
        streamer: number,
        ackValue: number
    ) {
        const ack: StreamerAcknowledgement = {
            streamerID: streamer,
            ackValue
        };

        if (!(deviceSlug in this.acks)) {
            this.acks[deviceSlug] = {};
        }

        this.acks[deviceSlug][streamer] = ack;

        const devicesRemaining = {};

        // Update ack status of any reports that this ack applies to
        for (const key in this.cache) {
            const report = this.cache[key];

            if (report.acknowledged) {
                continue;
            }

            if (this.reportAcknowledged(report)) {
                report.acknowledged = true;
            } else {
                devicesRemaining[report.deviceSlug] = true;
            }
        }

        // Now prune any devices that no longer have pending reports from our list of devices to check
        for (const device in this.devicesToCheck) {
            if (!(device in devicesRemaining)) {
                delete this.devicesToCheck[device];
            }
        }
    }

    public recordAckCheck(deviceSlug: string) {
        if (!(deviceSlug in this.devicesToCheck)) {
            return;
        }

        const info = this.devicesToCheck[deviceSlug];
        info.checkCount += 1;
        info.lastCheck = new Date();
    }

    public getDevicesToCheck(): string[] {
        const now = new Date();

        const checkList: {} = {};

        for (const deviceSlug in this.devicesToCheck) {
            const info = this.devicesToCheck[deviceSlug];
            const delta = (now.getTime() - info.lastCheck.getTime()) / 1000.0;

            // If we have already checked the maximum number of times for this report,
            // don't keep checking, it will be handled in our hourly global check of
            // all reports.
            if (info.checkCount >= ReportCache.AckCheckSchedule.length) {
                continue;
            }

            const checkInterval = ReportCache.AckCheckSchedule[info.checkCount];

            if (delta > 0 && delta < checkInterval) {
                continue;
            }

            checkList[deviceSlug] = true;
        }

        return Object.keys(checkList);
    }

    public getAllAcknowledgments(): SerializedAcknowledgements {
        return this.acks;
    }

    public removeReport(key: string) {
        if (!(key in this.cache)) {
            throw new ArgumentError(
                "Attempted to remove a key that didn't exist, key = " + key
            );
        }

        delete this.cache[key];
    }

    public setUploaded(key: string) {
        if (!(key in this.cache)) {
            throw new ArgumentError(
                "Attempted to set uploaded for a key that didn't exist, key = " +
                    key
            );
        }

        this.cache[key].uploaded = true;

        const backoffState: DeviceBackoffInfo = {
            lastCheck: new Date(),
            checkCount: 0
        };
        this.devicesToCheck[this.cache[key].deviceSlug] = backoffState;
    }

    public setError(key: string, errorMessage: string) {
        if (!(key in this.cache)) {
            throw new ArgumentError(
                "Attempted to set an error message for a key that didn't exist, key = " +
                    key
            );
        }

        this.cache[key].error = errorMessage;
    }

    public exists(key: string): boolean {
        return key in this.cache;
    }

    public get(key: string): DBReportEntry {
        if (!(key in this.cache)) {
            throw new ArgumentError(
                "Attempted to get a report that didn't exist, key = " + key
            );
        }

        return angular.copy(this.cache[key]);
    }

    public waitingReportsForDevice(
        deviceSlug: string,
        onlyUser: boolean
    ): DBReportEntry[] {
        const reports = [];

        for (const key in this.cache) {
            const report = this.cache[key];

            if (report.deviceSlug === deviceSlug && !report.uploaded) {
                reports.push(report);
            }
        }

        // Sort by oldest reports first
        reports.sort((a: DBReportEntry, b: DBReportEntry) => {
            return a.highestReadingId - b.highestReadingId;
        });

        return reports;
    }

    public acksForDevice(deviceSlug: string): StreamerAcknowledgement[] {
        const acks: StreamerAcknowledgement[] = [];

        if (!(deviceSlug in this.acks)) {
            return [];
        }

        for (const streamer in this.acks[deviceSlug]) {
            acks.push(this.acks[deviceSlug][streamer]);
        }

        return acks;
    }

    public reportAcknowledged(report: SerializedReportData): boolean {
        const deviceAcks = this.acks[report.deviceSlug];

        if (deviceAcks == null) {
            return false;
        }

        const ack = deviceAcks[report.streamer];

        if (ack == null) {
            return false;
        }

        return ack.ackValue >= report.highestReadingId;
    }

    public hasUnacknowledgedReports(deviceSlug: string): boolean {
        for (const key in this.cache) {
            const report = this.cache[key];

            if (report.deviceSlug !== deviceSlug) {
                continue;
            }

            if (report.acknowledged === false) {
                return true;
            }
        }

        return false;
    }

    public hasReportsToUpload(deviceSlug: string): boolean {
        for (const key in this.cache) {
            const report = this.cache[key];

            if (report.deviceSlug !== deviceSlug) {
                continue;
            }

            if (report.uploaded === false && !this.reportAcknowledged(report)) {
                return true;
            }
        }

        return false;
    }

    public countReportsToUpload(includeErrors: boolean): number {
        let count = 0;

        for (const key in this.cache) {
            const report = this.cache[key];

            if (report.uploaded) {
                continue;
            }

            if (!report.error || includeErrors) {
                count += 1;
            }
        }

        return count;
    }

    public allReports(): DBReportEntry[] {
        const reports = [];

        for (const key in this.cache) {
            const report = this.cache[key];

            reports.push(angular.copy(report));
        }

        return reports;
    }
}

angular
    .module("iotile.app")
    .service("RobustReportService", RobustReportService);
