import { delay } from "@iotile/iotile-common";
import * as IOTileAppModule from "ng-iotile-app";
import * as TestHelpers from "../../ng-iotile-app/helpers/standard-jig";

// Make sure main module is defined
import "../../../app/main/directives/upload-button-dir";
import "../../../app/main/main";

describe("UploadButton", function() {
    const jig = new TestHelpers.StandardJig();
    jig.mockReportService();
    jig.mockModule("main");

    describe("has reports to upload", function() {
        beforeEach(function() {
            jig.MockReportService.addReport(false, false);
        });

        jig.directive_it(
            "should be enabled (no errors parameter)",
            "<upload-logs-button></upload-logs-button>",
            async function(element, scope) {
                spyOn(scope, "$apply").and.callThrough();

                // Allow state to resolve
                await delay(0);

                expect(scope.includeErrors()).toBe(false);
                expect(scope.hasData).toBe(true);
                expect(scope.inProgress).toBe(false);
                expect(scope.$apply).toHaveBeenCalledTimes(1);
            }
        );

        jig.directive_it(
            "should be enabled (errors parameter)",
            '<upload-logs-button include-errors="true"></upload-logs-button>',
            async function(element, scope) {
                spyOn(scope, "$apply").and.callThrough();

                // Allow state to resolve
                await delay(0);

                expect(scope.includeErrors()).toBe(true);
                expect(scope.hasData).toBe(true);
                expect(scope.inProgress).toBe(false);
                expect(scope.$apply).toHaveBeenCalledTimes(1);
            }
        );
    });

    describe("no reports to upload", function() {
        beforeEach(function() {
            jig.MockReportService.addReport(true, false);
        });

        jig.directive_it(
            "should be disabled (no errors parameter)",
            "<upload-logs-button></upload-logs-button>",
            async function(element, scope) {
                spyOn(scope, "$apply").and.callThrough();

                // Allow state to resolve
                await delay(0);

                expect(scope.includeErrors()).toBe(false);
                expect(scope.hasData).toBe(false);
                expect(scope.inProgress).toBe(false);
                expect(scope.$apply).toHaveBeenCalledTimes(1);
            }
        );

        jig.directive_it(
            "should be disabled (errors parameter)",
            '<upload-logs-button include-errors="true"></upload-logs-button>',
            async function(element, scope) {
                spyOn(scope, "$apply").and.callThrough();

                // Allow state to resolve
                await delay(0);

                expect(scope.includeErrors()).toBe(true);
                expect(scope.hasData).toBe(false);
                expect(scope.inProgress).toBe(false);
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
            "should be disabled (no errors parameter)",
            "<upload-logs-button></upload-logs-button>",
            async function(element, scope) {
                spyOn(scope, "$apply").and.callThrough();

                // Allow state to resolve
                await delay(0);

                expect(scope.includeErrors()).toBe(false);
                expect(scope.hasData).toBe(false);
                expect(scope.inProgress).toBe(false);
                expect(scope.$apply).toHaveBeenCalledTimes(1);
            }
        );

        jig.directive_it(
            "should be enabled (errors parameter)",
            '<upload-logs-button include-errors="true"></upload-logs-button>',
            async function(element, scope) {
                spyOn(scope, "$apply").and.callThrough();

                // Allow state to resolve
                await delay(0);

                expect(scope.includeErrors()).toBe(true);
                expect(scope.hasData).toBe(true);
                expect(scope.inProgress).toBe(false);
                expect(scope.$apply).toHaveBeenCalledTimes(1);
            }
        );
    });

    jig.directive_it(
        "should update itself (no errors parameter)",
        "<upload-logs-button></upload-logs-button>",
        async function(element, scope) {
            // Allow state to resolve
            await delay(0);

            expect(scope.hasData).toBe(false);
            spyOn(scope, "$apply").and.callThrough();

            jig.MockReportService.addReport(false, false);
            jig.MockReportService.notify();
            expect(scope.hasData).toBe(true);
            expect(scope.$apply).toHaveBeenCalledTimes(1);

            jig.MockReportService.reports = [];
            jig.MockReportService.notify();
            expect(scope.hasData).toBe(false);
            expect(scope.$apply).toHaveBeenCalledTimes(2);
        }
    );

    jig.directive_it(
        "should update itself (errors parameter)",
        '<upload-logs-button include-errors="true"></upload-logs-button>',
        async function(element, scope) {
            // Allow state to resolve
            await delay(0);

            expect(scope.hasData).toBe(false);
            spyOn(scope, "$apply").and.callThrough();

            jig.MockReportService.addReport(false, false, false, "error");
            jig.MockReportService.notify();
            expect(scope.hasData).toBe(true);
            expect(scope.$apply).toHaveBeenCalledTimes(1);

            jig.MockReportService.reports = [];
            jig.MockReportService.notify();
            expect(scope.hasData).toBe(false);
            expect(scope.$apply).toHaveBeenCalledTimes(2);
        }
    );
});
