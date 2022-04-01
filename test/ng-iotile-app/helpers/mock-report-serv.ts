import { delay, deviceIDToSlug, guid } from "@iotile/iotile-common";
import { DBReportEntry, ReportServiceState } from "ng-iotile-app";

export class MockReportService {
    public reports: DBReportEntry[];
    public error;

    public $rootScope: ng.IRootScopeService;
    constructor($rootScope) {
        this.reports = [];
        this.error = null;
        this.$rootScope = $rootScope;
    }

    public addReport(
        uploaded: boolean,
        acked: boolean,
        system?: boolean,
        error?: string
    ) {
        if (system == null) {
            system = false;
        }

        const entry: DBReportEntry = {
            key: guid(),
            device: 5,
            deviceSlug: deviceIDToSlug(5),
            timestamp: new Date(),
            numReadings: 10,
            lowestReadingId: 1,
            highestReadingId: 10,
            streamer: system ? 1 : 0,
            length: 100,
            uploaded,
            acknowledged: acked,
            error: error ? error : null
        };

        this.reports.push(entry);
    }

    public async state() {
        // Preserve async semantics like the actual version
        await delay(0);
        return this.internalState();
    }

    public notify() {
        this.$rootScope.$broadcast(
            "STREAMER_REPORT_EVENT",
            this.internalState()
        );
    }

    private internalState() {
        const result: ReportServiceState = {
            reports: this.reports,
            hasFinished: false,
            reportsToUpload: false,
            cleanReportsToUpload: false,
            hasErrors: false,
            globalError: null
        };

        if (this.error !== null) {
            result.hasErrors = true;
            result.globalError = this.error;
        }

        for (const report of this.reports) {
            if (report.uploaded === false && report.error == null) {
                result.cleanReportsToUpload = true;
            }

            if (report.uploaded === false) {
                result.reportsToUpload = true;
            }

            if (report.acknowledged) {
                result.hasFinished = true;
            }

            if (report.error !== null) {
                result.hasErrors = true;
            }
        }

        return result;
    }
}
