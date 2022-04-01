import * as IOTileAppModule from "ng-iotile-app";
import * as TestHelpers from "../../ng-iotile-app/helpers/standard-jig";

// Make sure main module is defined
import { ReportListController } from "../../../app/main/controllers/reports-ctrl";
import "../../../app/main/main";

describe("ReportsController", function() {
    const jig = new TestHelpers.StandardJig();

    // Choose our mock configuration
    jig.mockReportService();
    jig.mockModule("main");

    beforeEach(function() {
        jig.MockReportService.addReport(false, false, false);
        jig.MockReportService.addReport(false, false, true);
        jig.MockReportService.addReport(true, false, false);
        jig.MockReportService.addReport(true, true, false);
        jig.MockReportService.addReport(true, false, false, "error");
    });

    jig.controller_it(
        "should initialize with reports",
        "ReportsCtrl",
        async function(con: ReportListController, scope) {
            expect(con.reports).toEqual(jig.MockReportService.reports);
            expect(con.error).toEqual(jig.MockReportService.error);

            expect(con.reportBadgeClass(con.reports[0])).toEqual(
                "icon ion-ios-cloud-upload assertive"
            );
            expect(con.reportBadgeClass(con.reports[1])).toEqual(
                "icon ion-ios-cloud-upload assertive"
            );
            expect(con.reportBadgeClass(con.reports[2])).toEqual(
                "icon ion-ios-timer energized"
            );
            expect(con.reportBadgeClass(con.reports[3])).toEqual(
                "icon ion-checkmark-circled balanced"
            );
            expect(con.reportBadgeClass(con.reports[4])).toEqual(
                "icon ion-android-alert assertive"
            );

            expect(con.reportLabel(con.reports[0])).toEqual("User Data");
            expect(con.reportLabel(con.reports[1])).toEqual("System Data");
        }
    );

    jig.controller_it(
        "should update icons on report events",
        "ReportsCtrl",
        async function(con: ReportListController, scope) {
            spyOn(scope, "$apply").and.callThrough();

            jig.MockReportService.reports[0].uploaded = true;
            jig.MockReportService.reports[1].uploaded = true;
            jig.MockReportService.reports[1].acknowledged = true;
            jig.MockReportService.notify();

            expect(con.reportBadgeClass(con.reports[0])).toEqual(
                "icon ion-ios-timer energized"
            );
            expect(con.reportBadgeClass(con.reports[1])).toEqual(
                "icon ion-checkmark-circled balanced"
            );
            expect(scope.$apply).toHaveBeenCalled();
        }
    );
});
