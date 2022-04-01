import { ControllerBase } from "@iotile/iotile-common";
import { COMBINED_REPORT_STREAMER } from "@iotile/iotile-device";
import angular = require("angular");
import {
    DBReportEntry,
    ReportServiceState,
    ReportUIService,
    RobustReportService
} from "ng-iotile-app";
import { ReportModal } from "./modals/report-modal";

export class ReportListController extends ControllerBase {
    public reports: DBReportEntry[];
    public hasErrors: boolean;
    public hasFinished: boolean;

    protected RobustReportService: RobustReportService;
    protected ReportUIService: ReportUIService;
    protected $state;

    constructor(
        $injector,
        $scope,
        $state,
        RobustReportService,
        ReportUIService
    ) {
        super("ReportListController", $injector, $scope);
        this.RobustReportService = RobustReportService;
        this.ReportUIService = ReportUIService;
        this.$state = $state;

        const that = this;

        $scope.$on("STREAMER_REPORT_EVENT", function(
            name,
            state: ReportServiceState
        ) {
            that.reports = state.reports;
            that.error = state.globalError;
            that.hasErrors = state.hasErrors;
            that.hasFinished = state.hasFinished;
            $scope.$apply();
        });
    }

    public parseDate(report: DBReportEntry) {
        return (
            report.timestamp.toDateString() +
            " " +
            report.timestamp.toLocaleTimeString()
        );
    }

    public reportInfo(report: DBReportEntry) {
        const modal = new ReportModal(this.$injector, report);
        this.showIsolatedModal(modal);
    }

    public reportLabel(report: DBReportEntry) {
        if (report.streamer === 1) {
            return "System Data";
        } else if (report.streamer === COMBINED_REPORT_STREAMER) {
            return "Combined Data";
        } else if (report.streamer === 0x100) {
            return "Event Data";
        }

        return "User Data";
    }

    public reportBadgeClass(report: DBReportEntry) {
        if (report.error) {
            return "icon ion-android-alert assertive";
        } else if (report.acknowledged) {
            return "icon ion-checkmark-circled balanced";
        } else if (report.uploaded) {
            return "icon ion-ios-timer energized";
        }

        return "icon ion-ios-cloud-upload assertive";
    }

    public async clearAllErrors() {
        await this.showLoading("Clearing Errors");

        try {
            await this.RobustReportService.clearErrors();
        } catch (err) {
            this.log_error("Error clearing report errors", err);
        } finally {
            await this.hideLoading();
        }
    }

    public async clearFinished() {
        await this.showLoading("Clearing Acknowledged Reports");

        try {
            await this.RobustReportService.clearFinished();
        } catch (err) {
            this.log_error("Error clearing acknowledged report ", err);
        } finally {
            await this.hideLoading();
        }
    }

    protected async initialize() {
        this.reports = [];
        this.hasErrors = false;
        this.hasFinished = false;

        const state = await this.RobustReportService.state();

        this.reports = state.reports;
        this.error = state.globalError;
        this.hasErrors = state.hasErrors;
        this.hasFinished = state.hasFinished;
        this.$scope.$apply();
    }
}

angular.module("main").controller("ReportsCtrl", ReportListController as any);
