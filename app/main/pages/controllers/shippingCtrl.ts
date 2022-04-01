import { IOTileCloud, Variable } from "@iotile/iotile-cloud";
import {
    delay,
    MessageSeverity,
    ProgressNotifier,
    UISeverity
} from "@iotile/iotile-common";
import {
    FlexibleDictionaryReport,
    IndividualReport,
    IOTileEvent,
    POD1M,
    RawReading
} from "@iotile/iotile-device";
import angular = require("angular");
import { get } from "lodash";
import * as moment from "moment";
import {
    DeviceBaseController,
    Position,
    ProgressModal,
    StreamStyle,
    UserService
} from "ng-iotile-app";
import { NoteModal } from "../../controllers/modals/note-modal";

const eventStream = "5a08";
const dataStream = "5a0c";

const TOGGLE_RECORDING_TIMEOUT = 1000; // ms
const TOGGLE_RECORDING_DELAY = 200; // ms
const ACCEL_SETTLED_DELAY = 500; // ms

interface TripState {
    NOT_STARTED: string;
    RECORDING: string;
    PAUSED: string;
    SETTLING: string;
    UPLOAD_NEEDED: string;
    FINISHED: string;
}

interface TripInfo {
    startTime: Date;
    endTime: Date;
    lastUploadTime: Date;
    shockCount: number;
    lastShock: string;
    tripDuration: string;
    maxGShock: string;
    maxDVShock: string;
    minTemp: string;
    maxHumidity: string;
    latestMaxG: number;
    latestDV: number;
    latestMinTemp: number;
    latestMaxHumidity: number;
    exposureDuration: string;
    rawExposureDuration: number;
    waveformMaxReached: boolean;
    tripState: string;
}

interface SessionInfo {
    analyzed: boolean;
    latestUploaded: boolean;
    toggling: boolean;
    loaded: boolean;
    canAccessSettings: boolean;
}

interface ShippingUIInfo {
    statusIcon: string;
    statusCircle: string;
    actionMsg: string;
    deviceStatus: string;
    deviceStatusColor: string;
}

export class ShippingController extends DeviceBaseController {
    public tripInfo: Partial<TripInfo>;
    public sessionInfo: Partial<SessionInfo>;
    public shippingUIInfo: Partial<ShippingUIInfo>;

    public user: UserService;
    public position: Position;

    public readonly TRIP_STATE: TripState;
    private pod1m: POD1M;

    private variables: { [key: string]: Variable };
    private cloud: IOTileCloud;
    private geolocation;

    constructor($stateParams, $injector, $scope, IOTileCloud, User) {
        super("ShippingController", $stateParams.deviceId, $injector, $scope);

        this.variables = {};
        this.cloud = IOTileCloud;
        this.user = User;
        this.pod1m = null;
        this.geolocation = $injector.get("Geolocation");
        this.sessionInfo = {
            loaded: false,
            canAccessSettings: false
        };
        this.TRIP_STATE = {
            NOT_STARTED: "not_started",
            RECORDING: "recording",
            PAUSED: "paused",
            SETTLING: "settling",
            UPLOAD_NEEDED: "upload_needed",
            FINISHED: "finished"
        };
    }

    public async analyzeTrip() {
        const modal = new ProgressModal(
            this.$injector,
            "Analyzing Trip",
            "Downloading data from device to provide summary data"
        );
        modal.manageOperation(notifier => this.summarize(notifier), true);

        try {
            await modal.run();
            this.log_info("Modal finished.");
            this.sessionInfo.analyzed = true;
        } catch (err) {
            this.log_warn("Error fetching summary data", JSON.stringify(err));
        }
    }

    public async memoryPopup() {
        this.alert(
            "Device Storage Full",
            "The device can only store 2047 waveforms per trip. Waveform details are unavailable for subsequent shocks, but shock counts and max values will continue to be shown."
        );
    }

    public async startTrip() {
        const start = await this.confirm(
            "Start Trip",
            "Are you sure you are ready to start a trip? You can only start a trip once.",
            UISeverity.Warn
        );
        if (!start) {
            return;
        }
        if (
            !this.tripInfo.startTime ||
            (this.tripInfo.endTime &&
                this.tripInfo.startTime < this.tripInfo.endTime)
        ) {
            await this.showLoading("Starting Trip...", true);
            try {
                this.tripInfo.startTime = new Date();
                const time = this.tripInfo.startTime.valueOf() / 1000;

                await this.synchronizeRealTimeClock();
                await this.device.graphInput("system input 1536", time);
                // Start Recording
                this.setRecording(true);

                this.log_info(
                    `Started Trip on device ${this.device.slug} at ${time}`
                );
            } finally {
                await this.hideLoading();

                // Show Note modal
                const modal = new NoteModal(
                    this.$injector,
                    [this.cloudDevice],
                    "Trip Started",
                    this.position
                );
                this.showIsolatedModal(modal);

                // make sure insomnia isn't interrupted
                if (window.plugins) {
                    window.plugins.insomnia.keepAwake();
                }
            }
        } else {
            await this.alert(
                "Trip Already Started",
                "Please re-connect to device to update status.",
                UISeverity.Error
            );
            this.log_error("startTrip called after trip has already started.");
        }
    }

    public async endTrip() {
        const stop = await this.confirm(
            "End Trip",
            "Once a trip has ended, you may not resume. If you are ready to stop recording and finalize this trip, please click 'Okay'.",
            UISeverity.Warn
        );
        if (!stop) {
            return;
        }
        if (
            (this.tripInfo.startTime && !this.tripInfo.endTime) ||
            (this.tripInfo.startTime &&
                this.tripInfo.startTime > this.tripInfo.endTime)
        ) {
            await this.showLoading("Stopping Trip...", true);
            try {
                const recording = await this.isRecording();
                if (recording) {
                    // Pause Recording
                    await this.device.graphInput("system input 1538", 0);
                }

                const time = Date.now() / 1000;
                await this.device.graphInput("system input 1537", time);

                this.log_info(
                    `Ended Trip on device ${this.device.slug} at ${time}`
                );
                await this.syncTrip();
                this.sessionInfo.latestUploaded = false;
            } finally {
                await this.hideLoading();
            }

            // Show Note modal
            const modal = new NoteModal(
                this.$injector,
                [this.cloudDevice],
                "Trip Ended",
                this.position
            );
            this.showIsolatedModal(modal);

            // make sure insomnia isn't interrupted
            if (window.plugins) {
                window.plugins.insomnia.keepAwake();
            }
        } else {
            await this.alert(
                "Trip Not Started",
                "Please re-connect to device to update status.",
                UISeverity.Error
            );
            this.log_error("endTrip called before trip has started.");
        }
    }

    public async uploadTrip() {
        const modal = new ProgressModal(
            this.$injector,
            "Uploading Trip",
            "Upload all data from device to the cloud"
        );
        modal.manageOperation(notifier => this.upload(notifier));

        try {
            await modal.run();
            this.log_info("Modal finished.");
            this.setTripState(this.TRIP_STATE.FINISHED);
        } catch (err) {
            this.log_warn(
                "Error uploading data to the cloud",
                JSON.stringify(err)
            );
        }
    }

    public async uploadLatest() {
        const modal = new ProgressModal(
            this.$injector,
            "Uploading Recent Data",
            "Upload latest data from device to the cloud"
        );
        modal.manageOperation(notifier => this.upload(notifier));

        try {
            await modal.run();
            this.log_info("Modal finished.");
            // We post to the mid-trip update data stream to trigger a report on the cloud
            const stream = this.buildStreamID(dataStream);
            await this.cloud.postStreamData(stream, "Num", 1);
            await this.createDataUploadedNote();
        } catch (err) {
            this.log_warn(
                "Error uploading data to the cloud",
                JSON.stringify(err)
            );
        }
    }

    public async createDataUploadedNote() {
        const timestamp = new Date();
        const note = "Data Uploaded";
        const resp = await this.cloud.postNote(
            this.device.slug,
            timestamp,
            note
        );
        await this.cloud.postLocation(
            this.device.slug,
            timestamp,
            this.position.coords.latitude,
            this.position.coords.longitude
        );
    }

    public async pauseRecordUpload() {
        switch (this.tripInfo.tripState) {
            case this.TRIP_STATE.RECORDING:
                await this.setRecording(false);
                break;
            case this.TRIP_STATE.PAUSED:
                await this.setRecording(true);
                break;
            case this.TRIP_STATE.UPLOAD_NEEDED || this.TRIP_STATE.FINISHED:
                await this.uploadTrip();
                break;
            default:
                break;
        }
    }

    public async setRecording(recording: boolean) {
        if (!this.sessionInfo.toggling) {
            this.sessionInfo.toggling = true;

            if (recording) {
                // Start recording
                await this.device.graphInput("system input 1538", 1);
                await this.waitForRecordingToggle(
                    false,
                    TOGGLE_RECORDING_DELAY,
                    TOGGLE_RECORDING_TIMEOUT
                );
                this.setTripState(this.TRIP_STATE.SETTLING);
                await this.waitForSettling(ACCEL_SETTLED_DELAY);
                this.setTripState(this.TRIP_STATE.RECORDING);
                // New data to be uploaded
                this.sessionInfo.latestUploaded = false;
            } else {
                // Pause Recording
                const pause = await this.confirm(
                    "Pause Recording",
                    "Are you sure you want to pause data recording on this device? No data will be collected until the trip has been resumed."
                );
                if (pause) {
                    await this.device.graphInput("system input 1538", 0);
                    await this.waitForRecordingToggle(
                        true,
                        TOGGLE_RECORDING_DELAY,
                        TOGGLE_RECORDING_TIMEOUT
                    );
                    this.setTripState(this.TRIP_STATE.PAUSED);
                }
            }

            this.sessionInfo.toggling = false;
        }
    }

    public async waitForSettling(delayTime: number) {
        let settled = await this.isSettled();

        while (!settled) {
            await delay(delayTime);
            settled = await this.isSettled();
        }

        this.log_info(`Device ${this.device.slug} is settled`);
    }

    public async sendMidTripUpdate() {
        const stream = this.buildStreamID(eventStream);

        const summary = {
            "Max Peak (G)": this.tripInfo.latestMaxG, // number G
            "DeltaV at Max Peak (in/s)": this.tripInfo.latestDV, // number [in/s]
            "Min Temp (C)": this.tripInfo.latestMinTemp, // number
            "Max Humidity (% RH)": this.tripInfo.latestMaxHumidity, // number
            "Below 17C": this.tripInfo.rawExposureDuration // number, seconds
        };

        if (this.tripInfo.waveformMaxReached) {
            summary["Device Full"] = true;
            summary["Waveform Storage"] = `100% (2047/2047)`;
        } else {
            summary["Device Full"] = false;
            summary["Waveform Storage"] = `${(
                (this.tripInfo.shockCount / 2047) *
                100
            ).toFixed(0)}% (${this.tripInfo.shockCount}/2047)`;
        }

        await this.cloud.postEvent(stream, summary);

        await this.alert(
            "Update Sent!",
            "Trip data successfully uploaded to the cloud.",
            UISeverity.Success
        );

        // Show Note modal
        const modal = new NoteModal(
            this.$injector,
            [this.cloudDevice],
            "Trip Update sent",
            this.position
        );
        this.showIsolatedModal(modal);

        // make sure insomnia isn't interrupted
        if (window.plugins) {
            window.plugins.insomnia.keepAwake();
        }
    }

    protected async preInitialize() {
        this.variables = {};

        this.tripInfo = {
            waveformMaxReached: false
        };

        this.sessionInfo = {
            analyzed: false,
            latestUploaded: false,
            toggling: false,
            loaded: false
        };

        this.shippingUIInfo = {};

        if (this.net.isOnline()) {
            try {
                // Check that device is still active on cloud
                const device = await this.cloud.fetchDevice(this.slug);
                if (device && !device.active) {
                    this.leaveFromError(
                        "Please set up device on IOTile Cloud",
                        "Device Inactive"
                    );
                }
            } catch (err) {
                this.log_error(
                    "Could not fetch latest device record from IOTile Cloud:",
                    JSON.stringify(err)
                );
                this.leaveFromError(
                    "Could not find IOTile Device",
                    "Device Not Found"
                );
            }
        } else {
            this.alert(
                "No Network Access",
                "Communication with the cloud will be postponed until a network connection is etablished."
            );
        }

        if (this.sg.displayWidgetTemplates.length) {
            this.log_info(
                "Widget Count: " + this.sg.displayWidgetTemplates.length
            );

            for (const widget of this.sg.displayWidgetTemplates) {
                if (!widget.showInApp) {
                    continue;
                }

                const varSlug = this.buildVariableID(widget.lid);
                const streamSlug = this.buildStreamID(widget.lid);
                const variable = this.project.getVariable(varSlug);
                if (variable) {
                    this.log_debug("Found widget variable", variable);
                    const stream = this.streams[streamSlug];

                    if (stream) {
                        this.variables[streamSlug] = variable;
                    }
                } else {
                    this.log_info("Widget variable not found: " + varSlug);
                }
            }
        } else {
            this.log_info(
                "Device SG has no display widgets. Defaulting to showing all streams"
            );

            for (const slug in this.streams) {
                const varSlug = this.streams[slug].variable;
                if (varSlug) {
                    const variable = this.project.getVariable(varSlug);

                    if (variable) {
                        this.variables[slug] = variable;
                    }
                }
            }
        }

        // Bind all of the streams we could generate so that we properly style them
        for (const streamID in this.streams) {
            this.bindProperty(
                null,
                streamID,
                StreamStyle.CloudDefault,
                "Waiting...",
                null,
                true
            );
        }

        // Check for updates to Last Shock
        const that = this;
        this.bindCallback(
            (report: IndividualReport, val: string) => {
                that.updateLastShock(report, val);
            },
            0x1012,
            true
        );

        // Get and cache GPS coordinates before device connection to avoid disconnects
        await this.geolocation.captureLocation();
        this.position = {
            coords: {
                latitude: this.geolocation.lat,
                longitude: this.geolocation.lon
            }
        };
    }

    protected async postInitialize() {
        /**
         * this.device is not populated until we connect to the device which
         * happens in our base class and then postInitialize() is called to
         * let us do whatever setup we need to after we are connected.
         */
        try {
            this.pod1m = this.$injector.get("POD1M")(this.device, this.adapter);

            await this.syncTrip();
            await this.synchronizeRealTimeClock();

            this.sessionInfo.loaded = true;
            this.sessionInfo.canAccessSettings = this.user.canModifyDevice(
                this.project.orgSlug
            );
        } catch (err) {
            this.logError(JSON.stringify(err));
            throw err;
        }
    }

    // send trip status information to check available settings operations
    protected showSettings() {
        this.switchingToSettings = true;
        let template: string = "";
        let controller: string = "";

        const uiExtra = this.sg.getUiExtra("mobile");
        if (uiExtra && uiExtra.settings) {
            template = uiExtra.settings.template;
            controller = uiExtra.settings.controller;
        }

        const extraData = {
            tripStarted: this.tripInfo.startTime !== undefined
        };

        this.log_debug(
            "Executing $state.go to main.deviceSettings",
            template,
            controller
        );
        this.$state.go("main.deviceSettings", {
            deviceId: this.slug,
            template,
            controller,
            extraData
        });
    }

    private async updateMaxGShock() {
        const shock = await this.pod1m.getShockInfo(1);
        this.tripInfo.latestMaxG = shock.peakVal;
        this.tripInfo.maxGShock = `${shock.peakVal.toFixed(
            1
        )} G, ${shock.largestDeltaV.toFixed(1)} in/s`;
    }

    private async updateMaxDeltaVShock() {
        const shock = await this.pod1m.getShockInfo(2);
        this.tripInfo.latestDV = shock.largestDeltaV;
        this.tripInfo.maxDVShock = `${shock.peakVal.toFixed(
            1
        )} G, ${shock.largestDeltaV.toFixed(1)} in/s`;
    }

    private async getMinTemp(progress: ProgressNotifier) {
        const tempStream = await this.device.downloadStream(
            "output 35",
            progress
        );

        if (tempStream.length === 0) {
            this.log_info(
                `No Temperature readings downloaded: ${this.device.slug}`
            );
            this.tripInfo.minTemp = "n/a";
            progress.finishOne();
            progress.startOne("Getting Exposure Duration", 1);
            await this.getExposure(tempStream, progress);
        } else {
            const temps: number[] = [];

            for (const temp of tempStream) {
                // convert from 1/100th degree C to C
                temps.push(temp.value / 100.0);
            }
            this.tripInfo.latestMinTemp = Math.min(...temps);
            this.tripInfo.minTemp =
                this.tripInfo.latestMinTemp.toFixed(1) + "° C";

            progress.finishOne();
            progress.startOne("Getting Exposure Duration", 1);
            await this.getExposure(tempStream, progress);
        }
    }

    private async getMaxHumidity(progress: ProgressNotifier) {
        const humidityStream = await this.device.downloadStream(
            "output 34",
            progress
        );
        if (humidityStream.length === 0) {
            this.log_info(
                `No Humidity readings downloaded: ${this.device.slug}`
            );
            this.tripInfo.maxHumidity = "n/a";
        } else {
            const humidities: number[] = [];

            for (const h of humidityStream) {
                humidities.push(h.value / 1024); // Humidity values are stored in fractions of 1/1024. of a %RH.
            }
            this.tripInfo.latestMaxHumidity = Math.max(...humidities);
            this.tripInfo.maxHumidity =
                this.tripInfo.latestMaxHumidity.toFixed(1) + "% RH";
        }
    }

    private async getExposure(
        tempStream: RawReading[],
        progress: ProgressNotifier
    ) {
        let duration = 0;
        let expStart: RawReading;

        for (const temp of tempStream) {
            // convert from 1/100th degree C to C
            if (temp.value / 100.0 < 17 && !expStart) {
                expStart = temp;
            } else if (
                expStart &&
                (temp.value / 100.0 >= 17 ||
                    tempStream.indexOf(temp) === tempStream.length - 1)
            ) {
                duration += temp.timestamp - expStart.timestamp;
                expStart = undefined;
            }
        }

        this.tripInfo.rawExposureDuration = duration;
        this.tripInfo.exposureDuration = this.getTimeInterval(duration);
    }

    private getTimeInterval(seconds: number): string {
        let formattedDuration: string = "";
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const sec = seconds % 60;
        if (hours > 0) {
            formattedDuration = hours + " hrs";
        }
        if (minutes > 0) {
            if (formattedDuration.length > 0) {
                formattedDuration += " ";
            }
            formattedDuration += minutes + " min";
        }
        if (sec > 0 && hours === 0) {
            if (formattedDuration.length > 0) {
                formattedDuration += " ";
            }
            formattedDuration += sec + " s";
        }
        return formattedDuration || "0 min";
    }

    private async summarize(progress: ProgressNotifier) {
        if (!progress) {
            progress = new ProgressNotifier();
        }
        progress.setTotal(6);

        progress.startOne("Getting Trip Duration", 1);
        this.tripInfo.tripDuration = this.getTripDuration();
        progress.finishOne();

        progress.startOne("Getting Largest Shock [by Max G]", 1);
        await this.updateMaxGShock();
        progress.finishOne();

        progress.startOne("Getting Largest Shock [by Delta V]", 1);
        await this.updateMaxDeltaVShock();
        progress.finishOne();

        progress.startOne("Getting Min Temp", 1);
        await this.getMinTemp(progress);
        progress.finishOne();

        progress.startOne("Getting Max Humidity", 1);
        await this.getMaxHumidity(progress);
        progress.finishOne();
    }

    private async updateLastShock(
        report: IndividualReport,
        styledValue: string
    ) {
        if (
            !this.tripInfo.shockCount ||
            this.tripInfo.shockCount < report.reading.value
        ) {
            this.tripInfo.shockCount = report.reading.value;

            if (this.pod1m) {
                const shock = await this.pod1m.getShockInfo(0);
                this.tripInfo.lastShock = `${shock.peakVal.toFixed(
                    1
                )} G, ${shock.largestDeltaV.toFixed(1)} in/s`;
            }
        }
        if (this.tripInfo.shockCount >= 2047) {
            this.tripInfo.waveformMaxReached = true;
        }
    }

    private async syncTrip() {
        try {
            const startStream: RawReading[] = await this.device.downloadStream(
                "system buffered node 1536"
            );
            const endStream: RawReading[] = await this.device.downloadStream(
                "system buffered node 1537"
            );
            const uploadStream: RawReading[] = await this.device.downloadStream(
                "system buffered node 1539"
            );

            const lastStart = startStream[startStream.length - 1];
            const lastEnd = endStream[endStream.length - 1];
            const lastUpload = uploadStream[uploadStream.length - 1];

            // Make sure that the accelerometer isn't in streaming mode
            const status = await this.pod1m.getAccelerometerStatus();
            if (status.tile_state === "streaming") {
                // don't show any other modals overtop
                this.hideLoading();

                this.log_info(
                    "Accelerometer tile out of sync; setting to capture mode"
                );
                const modal = new ProgressModal(
                    this.$injector,
                    "Syncing Accelerometer",
                    "The device state has become out of sync. Setting the device accelerometer to 'Capture Mode'"
                );
                modal.manageOperation(notifier =>
                    this.synchronizeAccelerometer(notifier)
                );

                try {
                    await modal.run();
                    this.log_info("Modal finished.");
                } catch (err) {
                    this.log_warn(
                        "Error synchronizing accelerometer tile",
                        JSON.stringify(err)
                    );
                }
            }

            if (!lastStart) {
                // The trip hasn't started
                this.setTripState(this.TRIP_STATE.NOT_STARTED);
            } else if (
                (lastStart && !lastEnd) ||
                lastStart.value > lastEnd.value
            ) {
                // The trip is in progress
                this.tripInfo.startTime = new Date(lastStart.value * 1000);
                this.tripInfo.endTime = undefined;
                this.tripInfo.tripDuration = this.getTripDuration();
                if (await this.isRecording()) {
                    this.setTripState(this.TRIP_STATE.RECORDING);
                } else {
                    this.setTripState(this.TRIP_STATE.PAUSED);
                }
            } else if (
                lastStart &&
                lastEnd &&
                lastStart.value < lastEnd.value
            ) {
                // The trip has ended
                this.tripInfo.startTime = new Date(lastStart.value * 1000);
                this.tripInfo.endTime = new Date(lastEnd.value * 1000);
                this.tripInfo.tripDuration = this.getTripDuration();

                if (lastUpload && lastUpload.value > lastEnd.value) {
                    // The last trip data has been uploaded
                    this.tripInfo.lastUploadTime = new Date(
                        lastUpload.value * 1000
                    );
                    this.sessionInfo.latestUploaded = true;
                    this.setTripState(this.TRIP_STATE.FINISHED);
                } else {
                    // The last trip data needs to be uploaded
                    this.setTripState(this.TRIP_STATE.UPLOAD_NEEDED);
                }
            } else {
                throw new Error(
                    `Trip data corrupted. Last Trip Start: ${lastStart} Last Trip End: ${lastEnd} `
                );
            }
            this.$scope.$applyAsync();
        } catch (err) {
            this.logError("Error syncing trip:", JSON.stringify(err));
        }
    }

    private async synchronizeRealTimeClock() {
        try {
            const time = await this.device.currentTime();

            this.log_info("Time is ", JSON.stringify(time));

            if (time.isUTC && !time.isSynchronized) {
                await this.device.synchronizeTime();
                this.log_info("Sent updated time, checking now");
                const newTime = await this.device.currentTime();
                this.log_info(
                    "Synchronized device time is",
                    JSON.stringify(newTime)
                );
                if (!newTime.isSynchronized) {
                    this.log_error(
                        `Failed to re-synchronise device RTC on device ${
                            this.slug
                        }`,
                        new Error("RTC Sync Failed")
                    );
                }
            }
        } catch (err) {
            this.log_error(
                `Unable to synchronize device RTC on device ${this.slug}`,
                new Error(JSON.stringify(err))
            );
        }
    }

    private async synchronizeAccelerometer(progress: ProgressNotifier) {
        if (!progress) {
            progress = new ProgressNotifier();
        }
        progress.setTotal(3);

        // waiting out waveforms might take like 2 min, so let the user feel optimistic first
        progress.startOne("Syncing", 1);
        progress.finishOne();

        progress.startOne("Receiving data from device", 1);
        const subNotifier = progress.startOne(
            "Receiving accelerometer data",
            150
        );
        let status = await this.pod1m.getAccelerometerStatus();

        while (status.streaming) {
            await delay(500);
            status = await this.pod1m.getAccelerometerStatus();
            subNotifier.finishOne();
        }
        progress.finishOne();

        progress.startOne("Setting device state to capture mode", 1);
        await this.adapter.errorHandlingRPC(12, 0x8039, "", "L", []);
        status = await this.pod1m.getAccelerometerStatus();
        this.log_info(
            `Accelerometer tile synchronized; tile state ${status.tile_state}`
        );
        progress.finishOne();
    }

    private async upload(progress: ProgressNotifier) {
        if (!progress) {
            progress = new ProgressNotifier();
        }
        progress.setTotal(7);
        progress.addMessage(MessageSeverity.Warn, "Do Not Close App", true);

        if (!this.isOnline()) {
            await this.alert(
                "No Network Connection",
                "Please connect to a network and retry upload.",
                UISeverity.Error
            );
            progress.fatalError("No Network Connection");
            return;
        }

        // @ts-ignore
        let received: SignedListReport[] = [];
        let decompressed: IOTileEvent[] = [];
        let highestAckedWaveform: number = null;

        try {
            this.reportService.ignoreReportsFromDevice(this.device.slug);

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
                this.logWarning(
                    "Couldn't reach the cloud:",
                    JSON.stringify(err)
                );
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

            [received, decompressed] = await this.pod1m.downloadData(
                progress,
                highestAckedWaveform
            );
        } finally {
            this.reportService.unignoreReportsFromDevice(this.device.slug);
        }
        /**
         * Create the report containing all of the waveforms and hand all reports over to the
         * report service at the same time.  This minimizes the chances that only some of the
         * reports are
         */
        const report = new FlexibleDictionaryReport(
            this.device.deviceID,
            [],
            decompressed
        );

        for (const report of received) {
            await this.reportService.pushReport(report);
        }

        await this.reportService.pushReport(report);

        progress.startOne("Uploading Trip Data to Cloud", 1);
        await this.uploadTripData(progress, received.length);
        progress.finishOne();

        // Record last upload time on device
        this.tripInfo.lastUploadTime = new Date();
        const time = this.tripInfo.lastUploadTime.valueOf() / 1000;

        await this.device.graphInput("system input 1539", time);

        if (progress.hasErrors) {
            progress.addMessage(MessageSeverity.Error, "Upload Failed", true);
        } else {
            progress.addMessage(
                MessageSeverity.Success,
                "Upload Complete",
                true
            );
        }

        // hide the upload button [NOT persistent for mid-trip uploads]
        this.sessionInfo.latestUploaded = true;
    }

    private async uploadTripData(notifier: ProgressNotifier, reportCount) {
        const subNotifier = notifier.startOne(
            `Uploading Trip Data to Cloud`,
            1
        );

        try {
            const result = await this.reportService.uploadReportsForDevice(
                this.device.slug,
                true,
                subNotifier
            );
            if (result.numberFailed > 0) {
                notifier.fatalError(
                    `Failed to Upload ${result.numberFailed} report. ${
                        result.numberSuccessful
                    } reports uploaded successfully`
                );
            } else {
                notifier.addMessage(
                    MessageSeverity.Info,
                    `Uploaded ${reportCount} Trip Reports`
                );
            }
        } catch (err) {
            this.log_error(
                "Error uploading environmental/waveform reports to cloud: ",
                JSON.stringify(err)
            );
            throw err;
        }
        subNotifier.finishOne();
    }

    private async waitForRecordingToggle(
        changeFrom: boolean,
        delayTime: number,
        timeOut: number
    ) {
        let recording = await this.isRecording();

        // We loop every 'delayTime' ms and check if the recording status has been updated
        const time = Date.now();
        let tick = Date.now();
        while (recording === changeFrom && tick < time + timeOut) {
            recording = await this.isRecording();
            tick = Date.now();
            await delay(delayTime);
        }
        if (tick > time + timeOut) {
            // If device times out before change is registered, log error
            this.log_error(
                `Device ${this.device.slug} failed to update recording status`
            );
        } else {
            this.log_info(
                `${recording ? "Started" : "Paused"} recording on device ${
                    this.device.slug
                }`
            );
        }
    }

    private async isRecording(): Promise<boolean> {
        return get(await this.pod1m.getAccelerometerStatus(), "recording");
    }

    private async isSettled(): Promise<boolean> {
        return get(await this.pod1m.getAccelerometerStatus(), "settled");
    }

    private async setTripState(state: string) {
        this.tripInfo.tripState = state;

        switch (state) {
            case this.TRIP_STATE.NOT_STARTED:
                this.shippingUIInfo.deviceStatusColor = "dark";
                this.shippingUIInfo.deviceStatus = "Not Started";
                this.shippingUIInfo.statusIcon = "ion-play";
                this.shippingUIInfo.statusCircle = "circle-ready";
                this.shippingUIInfo.actionMsg = undefined;
                break;
            case this.TRIP_STATE.RECORDING:
                this.shippingUIInfo.deviceStatusColor = "ready";
                this.shippingUIInfo.deviceStatus = "Recording";
                this.shippingUIInfo.statusIcon = "ion-stop";
                this.shippingUIInfo.statusCircle = "circle-ready";
                this.shippingUIInfo.actionMsg = "Pause Recording";
                break;
            case this.TRIP_STATE.PAUSED:
                this.shippingUIInfo.deviceStatusColor = "paused";
                this.shippingUIInfo.deviceStatus = "Sleeping";
                this.shippingUIInfo.statusIcon = "ion-record";
                this.shippingUIInfo.statusCircle = "circle-paused";
                this.shippingUIInfo.actionMsg = "Resume Recording";
                break;
            case this.TRIP_STATE.SETTLING:
                this.shippingUIInfo.deviceStatusColor = "dark";
                this.shippingUIInfo.deviceStatus = "Settling ...";
                this.shippingUIInfo.statusIcon = "ion-record";
                this.shippingUIInfo.statusCircle = "circle-paused";
                this.shippingUIInfo.actionMsg = undefined;
                break;
            case this.TRIP_STATE.UPLOAD_NEEDED:
                this.shippingUIInfo.deviceStatusColor = "assertive";
                this.shippingUIInfo.deviceStatus = "Upload Needed";
                this.shippingUIInfo.statusIcon = "ion-upload";
                this.shippingUIInfo.statusCircle = "circle-upload";
                this.shippingUIInfo.actionMsg = "Upload Data";
                break;
            case this.TRIP_STATE.FINISHED:
                this.shippingUIInfo.deviceStatusColor = "dark";
                this.shippingUIInfo.deviceStatus = "Finished";
                this.shippingUIInfo.statusCircle = "circle-upload";
                this.shippingUIInfo.statusIcon = "ion-android-cloud-done";
                this.shippingUIInfo.actionMsg = undefined;
                break;
            default:
                break;
        }
        this.$scope.$applyAsync();
    }

    private getTripDuration(): string {
        let latestVal: moment.Moment;

        if (this.tripInfo.startTime) {
            if (this.tripInfo.endTime) {
                latestVal = moment(this.tripInfo.endTime);
            } else {
                latestVal = moment();
            }
            const timeDiff = this.formatTimeDiff(
                latestVal,
                moment(this.tripInfo.startTime)
            );

            return timeDiff;
        } else {
            return undefined;
        }
    }

    private formatTimeDiff(
        latest: moment.Moment,
        start: moment.Moment
    ): string {
        let timeDiff: string = "";
        const d = latest.diff(start.clone(), "days");
        const h = latest.diff(start.clone().add(d, "days"), "hours");
        const m = latest.diff(
            start.clone().add({ days: d, hours: h }),
            "minutes"
        );
        const s = latest.diff(
            start.clone().add({ days: d, hours: h, minutes: m }),
            "seconds"
        );
        const times = { " d ": d, " h ": h, " m ": m, " s": s };

        // compress time
        for (const t in times) {
            if (times[t] !== 0) {
                timeDiff += times[t] + t;
            }
        }
        if (timeDiff === "") {
            timeDiff = "0 s";
        }

        return timeDiff;
    }
}

angular.module("main").controller("shippingCtrl", ShippingController as any);
