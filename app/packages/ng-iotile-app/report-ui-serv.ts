import {
    IOTileAdapter,
    IOTileAdvertisement,
    UserRedirectionInfo
} from "@iotile/iotile-device";
import angular = require("angular");
import { ProgressModal } from "./modals/progress-modal";
import { DeviceReportStatus, RobustReportService } from "./report-serv";
import { UIService } from "./ui-serv";

/**
 * @ngdoc service
 * @name main.service:ReportUIService
 * @description
 *
 * The ReportUIService is in charge of managing user facing aspects of Robust reports.
 * In particular it is in charge of showing popup boxes when a user connects to a device
 * that has data that has not yet been acknowledged from the cloud.  It also is in charge
 * of showing modal uploading boxes when a user is uploading reports.
 *
 * It exists to avoid having to embed UI code inside the RobustReportService so that
 * the RobustReportService can be reused more easily in contexts where the desired UI
 * is different or nonexistant.
 */

export class ReportUIService {
    private reportService: RobustReportService;
    private adapter: IOTileAdapter;
    private net;
    private $injector;
    private $log;
    private ui: UIService;

    constructor(
        $log,
        $injector,
        UIService: UIService,
        IOTileAdapter: IOTileAdapter,
        RobustReportService: RobustReportService,
        NetService
    ) {
        this.reportService = RobustReportService;
        this.adapter = IOTileAdapter;
        this.net = NetService;
        this.ui = UIService;
        this.$injector = $injector;
        this.$log = $log;

        // Hook into IOTileAdapter to warn the user if they are reconnecting to a device with
        // unacknowledged reports.  This will show popups that ask the user to confirm that they
        // want to connect to a device again.
        const that = this;

        $log.info("[ReportUIService] Started");

        this.adapter.registerPreconnectionHook(async function(
            advert: IOTileAdvertisement,
            adapter: IOTileAdapter
        ): Promise<UserRedirectionInfo> {
            // Don't show anything if we are not in an interactive mode where we can pop up UI elements
            if (!adapter.interactive) {
                return null;
            }

            const status = that.reportService.reportStatusForDevice(
                advert.slug
            );

            if (
                status.hasReportsToUpload === false &&
                status.hasUnacknowledged === false
            ) {
                return null;
            }

            return that.confirmUserConnection(status, advert);

            return null;
        });

        $log.info("[ReportUIService] Hooked into device adapter");
    }

    /*
     * Show a modal dialog box while uploading all reports
     */
    public async uploadAllData(includeErrors: boolean) {
        const desc = "Securely uploading data from IOTile Device to the cloud.";
        const modal = new ProgressModal(
            this.$injector,
            "Uploading Data to the Cloud",
            desc
        );
        modal.manageOperation(notifier =>
            this.reportService.uploadAllReports(includeErrors, notifier)
        );

        try {
            // This also kicks off the process and synchronously waits until it is done since it's managing the operation
            await modal.run();
        } catch (err) {
            this.$log.warn(
                "[ReportUIService] Error uploading reports to the cloud",
                err
            );
        }
    }

    private async confirmUserConnection(
        status: DeviceReportStatus,
        advert: IOTileAdvertisement
    ) {
        const online = this.net.isOnline();

        if (status.hasReportsToUpload) {
            if (online) {
                return this.promptUploadReports(advert);
            } else {
                return this.notifyRepeatData(advert);
            }
        } else {
            if (online) {
                return this.promptWaitForAcknowledge(advert);
            } else {
                return this.notifyRepeatData(advert);
            }
        }
    }

    /*
     * Show a UI popup asking the user to confirm that they want to connect to a device that
     * has unacknowledged reports.  This is wired into a preconnection hook that runs before
     * device connections are allowed.
     */
    private async promptUploadReports(
        advert: IOTileAdvertisement
    ): Promise<UserRedirectionInfo> {
        const result = await this.ui.alert(
            "You Have Data to Upload",
            "<p><b>You should upload data to the cloud before connecting.</b></p>" +
                "<p>It is okay to continue connecting but there will be a delay while old data is downloaded again before you can use the device.</p>"
        );

        return null;
    }

    private async notifyRepeatData(
        advert: IOTileAdvertisement
    ): Promise<UserRedirectionInfo> {
        await this.ui.alert(
            "Data Will Be Downloaded Again",
            "<p><b>You are offline and have data that has not been processed by the cloud yet.</b></p>" +
                "<p>The data will be downloaded again when you connect to this device.  This is not a problem, we just wanted to let you know.</p>"
        );

        return null;
    }

    private async promptWaitForAcknowledge(
        advert: IOTileAdvertisement
    ): Promise<UserRedirectionInfo> {
        const result = await this.ui.confirm(
            "Still Waiting for Cloud Acknowledgment",
            "<p><b>Connecting now will have a short delay as data is downloaded again</b></p>" +
                "<p>It is ok to continue connecting and get the old data again. To avoid this delay, wait around 30 seconds to receive cloud confirmation.</p>",
            "Go Back",
            "OK"
        );

        if (result === false) {
            return {
                reason: "Uploading pending report data",
                userNotified: true,
                redirectState: "main.activeProject"
            };
        }

        return null;
    }
}

angular.module("iotile.app").service("ReportUIService", ReportUIService);
