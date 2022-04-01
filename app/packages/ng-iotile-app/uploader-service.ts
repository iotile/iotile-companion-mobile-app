import * as IOTileCloudModule from "@iotile/iotile-cloud";
import {
    delay,
    MessageSeverity,
    ObjectBase,
    ProgressNotifier
} from "@iotile/iotile-common";
import {
    AdapterEvent,
    IOTileAdapter,
    IOTileAdvertisement,
    ReportParserEvent
} from "@iotile/iotile-device";
import angular = require("angular");
import { CacheService } from "./cache-serve";
import { RobustReportService } from "./report-serv";

export class UploaderService extends ObjectBase {
    private adapter: IOTileAdapter;
    private reportService: RobustReportService;
    private cache: CacheService;

    private reportInProgress: boolean;
    private reportPercentage: number;
    private reportType: string;
    private reportCount: number;

    constructor($injector, RobustReportService, CacheService, IOTileAdapter) {
        super("UploaderService", $injector);

        this.adapter = IOTileAdapter;
        this.cache = CacheService;
        this.reportService = RobustReportService;

        const that = this;
        const progressCallback = function(
            eventName: string,
            event: ReportParserEvent
        ) {
            if (event.finishedPercentage === 100) {
                that.reportInProgress = false;
                that.reportPercentage = event.finishedPercentage;
                that.reportCount += 1;
            } else {
                that.reportInProgress = true;
                that.reportPercentage = event.finishedPercentage;

                // For now, hardcode that streamer 1 will be system data and streamer 0 (and possibly 2-8) are user data
                if (event.reportIndex === 1) {
                    that.reportType = "System";
                } else {
                    that.reportType = "Historical";
                }
            }
        };

        const disconnectCallback = function(
            eventName: string,
            event: ReportParserEvent
        ) {
            that.reportInProgress = false;
            that.reportPercentage = 0;
            that.reportType = null;
        };

        that.reportInProgress = false;
        that.reportPercentage = 0;
        that.reportType = null;
        this.reportCount = 0;

        IOTileAdapter.subscribe(
            AdapterEvent.RobustReportStarted,
            progressCallback
        );
        IOTileAdapter.subscribe(
            AdapterEvent.RobustReportStalled,
            progressCallback
        );
        IOTileAdapter.subscribe(
            AdapterEvent.RobustReportProgress,
            progressCallback
        );
        IOTileAdapter.subscribe(
            AdapterEvent.RobustReportFinished,
            progressCallback
        );
        IOTileAdapter.subscribe(AdapterEvent.Disconnected, disconnectCallback);
    }

    public async scanAndUpload(notifier: ProgressNotifier) {
        if (notifier == null) {
            notifier = new ProgressNotifier();
        }

        if (window.plugins) {
            window.plugins.insomnia.keepAwake();
            this.log_info("Keeping alive...");
        }

        // Keep track of how many total reports we have received
        this.reportCount = 0;

        notifier.setTotal(3);

        try {
            notifier.startOne("Scanning for nearby devices", 1);
            const [devices, adverts] = await this.scanAndFilter(4.0);
            notifier.finishOne();

            let devicesString: string = "";
            if (devices.length === 1) {
                devicesString = devices.length + " nearby device.";
            } else {
                devicesString = devices.length + " nearby devices.";
            }

            notifier.addMessage(MessageSeverity.Info, "Found " + devicesString);

            let subNotifier = notifier.startOne(
                "Collecting data from " + devicesString,
                devices.length
            );
            for (let i = 0; i < devices.length; ++i) {
                subNotifier.startOne("Gathering from " + devices[i].label, 1);
                await this.gatherData(devices[i], adverts[i], subNotifier);
                subNotifier.finishOne();
            }
            notifier.finishOne();

            subNotifier = notifier.startOne("Uploading", 1);
            const status = await this.reportService.uploadAllReports(
                false,
                subNotifier
            );
            notifier.addMessage(
                MessageSeverity.Info,
                "Uploaded " + status.numberSuccessful + " report(s)."
            );

            if (status.numberFailed > 0) {
                notifier.addMessage(
                    MessageSeverity.Error,
                    "Encountered " + status.numberFailed + " error(s)."
                );
            }
            notifier.finishOne();
        } catch (err) {
            let msg: string = " Error collecting data";
            if (err.userMessage) {
                msg = err.userMessage;
            } else if (err.message) {
                msg = err.message;
            }

            this.log_error("Error encountered in scanAndUpload", err);
            notifier.fatalError(msg);
        } finally {
            if (window.plugins) {
                window.plugins.insomnia.allowSleepAgain();
                this.log_info("Allowing sleep again");
            }
        }
    }

    public async scanAndFilter(
        period: number
    ): Promise<[IOTileCloudModule.Device[], IOTileAdvertisement[]]> {
        const adverts = await this.adapter.scan(period);
        const project = await this.cache.getActiveProject();
        const advertMap = {};

        for (const advert of adverts) {
            advertMap[advert.slug] = advert;
        }

        const cloudDevices = adverts
            .filter(advert => !advert.flags.otherConnected)
            .map(advert => project.getDevice(advert.slug))
            .filter(device => device != null);
        const filteredAdverts: IOTileAdvertisement[] = cloudDevices.map(
            device => advertMap[device.slug]
        );
        return [cloudDevices, filteredAdverts];
    }

    /*
     * The gather data loop is fairly simple:
     * 1. Connect to a device and wait .5 seconds to make sure it starts streaming data if there is Any
     * 2. As long as there is a robust report in progress, stay connected and check for it to be finished in half second intervals separated by 100 ms
     *    so we avoid a tiny race between when one report ends and another starts.
     */
    private async gatherData(
        cloudDevice: IOTileCloudModule.Device,
        advert: IOTileAdvertisement,
        notifier: ProgressNotifier
    ) {
        const beforeReports = this.reportCount;

        try {
            const device = await this.adapter.connect(advert, {
                noninteractive: true
            }); // Make sure we don't pop up any dialog boxes on connect

            notifier.updateDescription("Connected to " + cloudDevice.label);
            do {
                await delay(500);

                if (this.reportInProgress === false) {
                    await delay(100);
                    if (this.reportInProgress === false) {
                        break;
                    }
                } else {
                    notifier.updateDescription(
                        "Receiving " +
                            this.reportType +
                            " Data: " +
                            this.reportPercentage +
                            "% Done"
                    );
                }
            } while (true);

            const fromDevice = this.reportCount - beforeReports;

            if (fromDevice === 0) {
                notifier.addMessage(
                    MessageSeverity.Info,
                    "Received no data from " + cloudDevice.label
                );
            } else {
                notifier.addMessage(
                    MessageSeverity.Info,
                    "Collected " +
                        fromDevice +
                        " report(s) from " +
                        cloudDevice.label
                );
            }

            /**
             * If we got any messages during the connection process, patch in our device label in place of the placeholder
             * ${label} and add it to the progress manager.
             */
            for (const message of this.adapter.connectionMessages) {
                notifier.addMessage(
                    message.severity,
                    // tslint:disable-next-line: no-invalid-template-strings
                    message.message.replace("${label}", cloudDevice.label)
                );
            }
        } catch (err) {
            this.log_warn(
                "Error gathering data from device: " + cloudDevice.slug,
                err
            );
            notifier.addMessage(
                MessageSeverity.Warn,
                "Could not gather data from " + cloudDevice.label
            );
        } finally {
            await this.adapter.disconnect();
        }
    }
}

angular.module("iotile.app").service("UploaderService", UploaderService);
