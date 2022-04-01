import { delay } from "@iotile/iotile-common";
import * as IOTileAppModule from "ng-iotile-app";
import * as TestHelpers from "../../ng-iotile-app/helpers/standard-jig";

// Make sure main module is defined
import "../../../app/main/directives/data-logs-button-dir";
import "../../../app/main/main";

describe("UploadButton", function() {
    const jig = new TestHelpers.StandardJig();
    jig.mockReportService();
    jig.mockModule("main");

    describe("has reports to upload", function() {
        beforeEach(function() {
            jig.MockReportService.addReport(false, false);
            jig.MockReportService.addReport(false, false);
        });

        jig.directive_it(
            "should be enabled",
            "<logs-button></logs-button>",
            async function(element, scope) {
                spyOn(scope, "$apply").and.callThrough();

                // Allow state to resolve
                await delay(0);

                expect(scope.hasData).toBe(true);
                expect(scope.hasErrors).toBe(false);
                expect(scope.uploadCount).toEqual(2);
                expect(scope.$apply).toHaveBeenCalledTimes(1);
            }
        );
    });

    describe("no reports to upload", function() {
        beforeEach(function() {
            jig.MockReportService.addReport(true, false);
        });

        jig.directive_it(
            "should be disabled",
            "<logs-button></logs-button>",
            async function(element, scope) {
                spyOn(scope, "$apply").and.callThrough();

                // Allow state to resolve
                await delay(0);

                expect(scope.hasData).toBe(false);
                expect(scope.hasErrors).toBe(false);
                expect(scope.uploadCount).toEqual(0);
                expect(scope.$apply).toHaveBeenCalledTimes(1);
            }
        );
    });

    describe("has (errored) reports to upload", function() {
        beforeEach(function() {
            jig.MockReportService.addReport(
                false,
                false,
                false,
                "Error in report."
            );
        });

        jig.directive_it(
            "should show errors",
            "<logs-button></logs-button>",
            async function(element, scope) {
                spyOn(scope, "$apply").and.callThrough();

                // Allow state to resolve
                await delay(0);

                expect(scope.hasData).toBe(false);
                expect(scope.hasErrors).toBe(true);
                expect(scope.uploadCount).toEqual(1);
                expect(scope.$apply).toHaveBeenCalledTimes(1);
            }
        );
    });

    jig.directive_it(
        "should update itself",
        "<logs-button></logs-button>",
        async function(element, scope) {
            // Allow state to resolve
            await delay(0);

            expect(scope.hasData).toBe(false);
            spyOn(scope, "$apply").and.callThrough();

            jig.MockReportService.addReport(false, false);
            jig.MockReportService.notify();
            expect(scope.hasData).toBe(true);
            expect(scope.hasErrors).toBe(false);
            expect(scope.uploadCount).toEqual(1);
            expect(scope.$apply).toHaveBeenCalledTimes(1);

            jig.MockReportService.reports = [];
            jig.MockReportService.notify();
            expect(scope.hasData).toBe(false);
            expect(scope.hasErrors).toBe(false);
            expect(scope.uploadCount).toEqual(0);
            expect(scope.$apply).toHaveBeenCalledTimes(2);
        }
    );
});
