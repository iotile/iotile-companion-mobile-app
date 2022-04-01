import { ModalBase } from "@iotile/iotile-common";
import {
    COMBINED_REPORT_STREAMER,
    SYSTEM_REPORT_STREAMER
} from "@iotile/iotile-device";
import { DBReportEntry, UserService } from "ng-iotile-app";

export class ReportModal extends ModalBase {
    public report: DBReportEntry;
    public streamerDisplay: string;
    public statusDisplay: string;

    protected User: UserService;

    constructor($injector, report: DBReportEntry) {
        super(
            "ReportModal",
            "main/templates/modals/report-info.html",
            $injector,
            {
                animation: "slide-in-up",
                backdropClickToClose: false,
                hardwareBackButtonClose: true
            }
        );
        this.report = report;
        this.User = $injector.get("User");

        this.streamerDisplay = "User Data";
        if (report.streamer === SYSTEM_REPORT_STREAMER) {
            this.streamerDisplay = "System Data";
        } else if (report.streamer === COMBINED_REPORT_STREAMER) {
            this.streamerDisplay = "Combined Data";
        } else if (report.streamer === 0x100) {
            this.streamerDisplay = "Event Data";
        }

        if (report.error) {
            this.statusDisplay = report.error;
        } else if (report.acknowledged) {
            this.statusDisplay = "Uploaded and Acknowledged";
        } else if (report.uploaded) {
            this.statusDisplay = "Waiting for Cloud Acknowledgment";
        } else {
            this.statusDisplay = "Needs to be Uploaded";
        }
    }

    public parseDate(report: DBReportEntry) {
        return (
            report.timestamp.toDateString() +
            " " +
            report.timestamp.toLocaleTimeString()
        );
    }

    public isStaff(): boolean {
        return this.User.isStaff();
    }
}
