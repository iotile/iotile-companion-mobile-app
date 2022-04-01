import { deviceIDToSlug } from "@iotile/iotile-common";
import * as IOTileAppModule from "ng-iotile-app";
import * as TestHelpers from "../helpers/standard-jig";

import {
    createSequentialReport,
    FlexibleDictionaryReport,
    IOTileEvent,
    ReportParser,
    SignedListReport
} from "@iotile/iotile-device";

describe("module: main, service: RobustReportService", function() {
    let ReportService: IOTileAppModule.RobustReportService;
    let parser: ReportParser;
    let MockFilePlugin: IOTileAppModule.MockCordovaFile;
    let FileSystemService: IOTileAppModule.FileSystemService;
    let $q: ng.IQService;
    let $log: any;
    const jig = new TestHelpers.StandardJig();

    beforeEach(inject(function(
        _Config_,
        _$q_,
        _FileSystemService_,
        _RobustReportService_,
        _MockCordovaFile_,
        _$rootScope_,
        _$log_
    ) {
        $q = _$q_;
        $log = _$log_;
        parser = new ReportParser(16 * 1024);
        ReportService = _RobustReportService_;

        MockFilePlugin = _MockCordovaFile_;
        FileSystemService = _FileSystemService_;
        MockFilePlugin.clear("/");
    }));

    it("should process a report correctly", async function(done) {
        try {
            expect((await ReportService.state()).reports.length).toBe(0);
            expect((await ReportService.state()).cleanReportsToUpload).toBe(
                false
            );

            const report1 = createSequentialReport(10, "output 1", 100, 0);

            const parsedReports = await parser.pushData(report1 as ArrayBuffer);

            expect(parsedReports.length).toBe(1);
            const parsed1 = parsedReports[0] as SignedListReport;

            await ReportService.pushReport(parsed1);

            const state = await ReportService.state();

            // Make sure we got the report stored in the DB correctly
            expect(state.reports.length).toBe(1);
            expect(state.cleanReportsToUpload).toBe(true);

            // Make sure the report's contents are correct
            const report = state.reports[0];

            expect(
                await FileSystemService.checkFile(
                    "reports/" + report.key + ".bin"
                )
            ).toBe(true);
            expect(
                await FileSystemService.checkFile(
                    "reports/" + report.key + ".json"
                )
            ).toBe(true);
            expect(report.numReadings).toBe(100);
            expect(report.device).toBe(10);
            expect(report.lowestReadingId).toBe(1);
            expect(report.highestReadingId).toBe(100);
            expect(report.uploaded).toBe(false);
            done();
        } catch (err) {
            done.fail(err);
        }
    });

    it("should process multiple reports synchronously", async function(done) {
        try {
            expect((await ReportService.state()).reports.length).toBe(0);
            expect((await ReportService.state()).cleanReportsToUpload).toBe(
                false
            );

            const report1 = (await parser.pushData(createSequentialReport(
                10,
                "output 1",
                100,
                0
            ) as ArrayBuffer)[0]) as SignedListReport;
            const report2 = (await parser.pushData(createSequentialReport(
                11,
                "output 2",
                200,
                0
            ) as ArrayBuffer)[0]) as SignedListReport;
            const report3 = (await parser.pushData(createSequentialReport(
                12,
                "output 3",
                300,
                0
            ) as ArrayBuffer)[0]) as SignedListReport;

            const prom1 = ReportService.pushReport(report1);
            const prom2 = ReportService.pushReport(report2);
            const prom3 = ReportService.pushReport(report3);

            await Promise.all([prom1, prom2, prom3]);

            const state = await ReportService.state();

            // Make sure we got the 3 reports stored in the DB correctly
            expect(state.reports.length).toBe(3);
            expect(state.cleanReportsToUpload).toBe(true);

            // Make sure the report's contents are correct
            let report = state.reports[0];
            expect(report.numReadings).toBe(100);
            expect(report.device).toBe(10);
            expect(report.lowestReadingId).toBe(1);
            expect(report.highestReadingId).toBe(100);
            expect(report.uploaded).toBe(false);

            report = state.reports[1];
            expect(report.numReadings).toBe(200);
            expect(report.device).toBe(11);
            expect(report.lowestReadingId).toBe(1);
            expect(report.highestReadingId).toBe(200);
            expect(report.uploaded).toBe(false);

            report = state.reports[2];
            expect(report.numReadings).toBe(300);
            expect(report.device).toBe(12);
            expect(report.lowestReadingId).toBe(1);
            expect(report.highestReadingId).toBe(300);
            expect(report.uploaded).toBe(false);
            done();
        } catch (err) {
            done.fail(err);
        }
    });

    it("should allow ignoring reports from devices", async function(done) {
        try {
            const report1 = (await parser.pushData(createSequentialReport(
                10,
                "output 1",
                100,
                0
            ) as ArrayBuffer)[0]) as SignedListReport;
            const report2 = (await parser.pushData(createSequentialReport(
                11,
                "output 2",
                200,
                0
            ) as ArrayBuffer)[0]) as SignedListReport;
            const report3 = (await parser.pushData(createSequentialReport(
                12,
                "output 3",
                300,
                0
            ) as ArrayBuffer)[0]) as SignedListReport;

            ReportService.ignoreReportsFromDevice("d--0000-0000-0000-000a");

            const prom1 = ReportService.pushReport(report1);
            const prom2 = ReportService.pushReport(report2);
            const prom3 = ReportService.pushReport(report3);

            await Promise.all([prom1, prom2, prom3]);

            const origState = await ReportService.state();
            expect(origState.reports.length).toBe(2);

            ReportService.unignoreReportsFromDevice("d--0000-0000-0000-000a");
            await ReportService.pushReport(report1);

            const state = await ReportService.state();
            expect(state.reports.length).toBe(3);

            done();
        } catch (err) {
            done.fail(err);
        }
    });

    it("should allow uploading all reports", async function(done) {
        try {
            const report1 = (await parser.pushData(createSequentialReport(
                10,
                "output 1",
                100,
                0
            ) as ArrayBuffer)[0]) as SignedListReport;
            const report2 = (await parser.pushData(createSequentialReport(
                11,
                "output 2",
                200,
                0
            ) as ArrayBuffer)[0]) as SignedListReport;

            await ReportService.pushReport(report1);
            await ReportService.pushReport(report2);

            await ReportService.uploadAllReports(false);

            const state = await ReportService.state();

            expect(state.hasErrors).toBe(false);
            expect(state.cleanReportsToUpload).toBe(false);

            expect(state.reports[0].acknowledged).toEqual(false);
            expect(state.reports[0].error).toBe(null);
            expect(state.reports[1].acknowledged).toEqual(false);
            expect(state.reports[1].error).toBe(null);

            // Make sure the report was saved
            const report1Saved = await FileSystemService.readJSONFile(
                "reports/" + state.reports[0].key + ".json"
            );
            const report2Saved = await FileSystemService.readJSONFile(
                "reports/" + state.reports[1].key + ".json"
            );

            done();
        } catch (err) {
            done.fail(err);
        }
    });

    it("should allow deleting all reports", async function(done) {
        try {
            const report1 = (await parser.pushData(createSequentialReport(
                10,
                "output 1",
                100,
                0
            ) as ArrayBuffer)[0]) as SignedListReport;
            const report2 = (await parser.pushData(createSequentialReport(
                11,
                "output 2",
                200,
                0
            ) as ArrayBuffer)[0]) as SignedListReport;
            const report3 = (await parser.pushData(createSequentialReport(
                12,
                "output 3",
                300,
                0
            ) as ArrayBuffer)[0]) as SignedListReport;

            const prom1 = ReportService.pushReport(report1);
            const prom2 = ReportService.pushReport(report2);
            const prom3 = ReportService.pushReport(report3);

            await Promise.all([prom1, prom2, prom3]);

            const origState = await ReportService.state();

            // Make sure we got the 3 reports stored in the DB correctly
            expect(origState.reports.length).toBe(3);
            expect(origState.cleanReportsToUpload).toBe(true);

            const key1 = origState.reports[0].key;
            const key2 = origState.reports[1].key;
            const key3 = origState.reports[2].key;

            expect(
                await FileSystemService.checkFile("reports/" + key1 + ".json")
            ).toBe(true);
            expect(
                await FileSystemService.checkFile("reports/" + key1 + ".bin")
            ).toBe(true);

            expect(
                await FileSystemService.checkFile("reports/" + key2 + ".json")
            ).toBe(true);
            expect(
                await FileSystemService.checkFile("reports/" + key2 + ".bin")
            ).toBe(true);

            expect(
                await FileSystemService.checkFile("reports/" + key3 + ".json")
            ).toBe(true);
            expect(
                await FileSystemService.checkFile("reports/" + key3 + ".bin")
            ).toBe(true);

            await ReportService.deleteAllReports();
            const state = await ReportService.state();

            // Make sure we deleted all 3 reports in the db
            expect(state.reports.length).toBe(0);
            expect(state.cleanReportsToUpload).toBe(false);

            // Make sure we also deleted all of the files
            expect(
                await FileSystemService.checkFile("reports/" + key1 + ".json")
            ).toBe(false);
            expect(
                await FileSystemService.checkFile("reports/" + key1 + ".bin")
            ).toBe(false);

            expect(
                await FileSystemService.checkFile("reports/" + key2 + ".json")
            ).toBe(false);
            expect(
                await FileSystemService.checkFile("reports/" + key2 + ".bin")
            ).toBe(false);

            expect(
                await FileSystemService.checkFile("reports/" + key3 + ".json")
            ).toBe(false);
            expect(
                await FileSystemService.checkFile("reports/" + key3 + ".bin")
            ).toBe(false);

            done();
        } catch (err) {
            done.fail(err);
        }
    });

    it("should report if there is a global error", async function(done) {
        try {
            let state = await ReportService.state();

            expect(state.hasErrors).toBe(false);
            expect(state.globalError).toBe(null);

            (ReportService as any)._errorMessage = "Forced error";

            state = await ReportService.state();
            expect(state.hasErrors).toBe(true);
            expect(state.globalError).toBe("Forced error");

            done();
        } catch (err) {
            done.fail(err);
        }
    });

    xit("should allow uploading flexible dictionary reports", async function(done) {
        try {
            const event1 = new IOTileEvent(
                0x5020,
                0,
                { test: 1 },
                { accel: [] },
                1
            );
            const event2 = new IOTileEvent(
                0x5020,
                0,
                { test: 2 },
                { accel: [] },
                2
            );
            const report = new FlexibleDictionaryReport(
                10,
                [],
                [event2, event1]
            );

            // await ReportService.uploadFlexibleDictionaryReport(report);

            done();
        } catch (err) {
            done.fail(err);
        }
    });
});

// Separate test suite for checking initialization of the RobustReportService
describe("module: main, service: RobustReportService", function() {
    let MockFilePlugin: IOTileAppModule.MockCordovaFile;
    let FileSystemService: IOTileAppModule.FileSystemService;
    let $q: ng.IQService;
    let $injector;
    let $log: any;
    const jig = new TestHelpers.StandardJig();

    async function buildReportEntry(
        device: number,
        uploaded: boolean,
        error: string,
        ack: number
    ) {
        let rep: IOTileAppModule.SerializedReportData;

        rep = {
            device,
            deviceSlug: deviceIDToSlug(device),
            timestamp: new Date(0),
            numReadings: 100,
            lowestReadingId: 1,
            highestReadingId: 100,
            streamer: 0,
            key:
                deviceIDToSlug(device) +
                "-" +
                "0000" +
                "-" +
                new Date(0).toISOString(),
            length: 100,
            uploaded,
            error
        };

        if (ack != null) {
            let oldAcks = {};
            if (await FileSystemService.checkFile("reports/report_acks.json")) {
                oldAcks = await FileSystemService.readJSONFile(
                    "reports/report_acks.json"
                );
            }

            const slug = deviceIDToSlug(device);
            if (!(slug in oldAcks)) {
                oldAcks[slug] = {};
            }

            oldAcks[slug][0] = {
                streamerID: 0,
                ackValue: ack
            };

            await FileSystemService.writeJSONFile(
                "reports/report_acks.json",
                oldAcks
            );
        }

        const report = createSequentialReport(10, "output 1", 100, 0);

        await FileSystemService.writeFile(
            "reports/" + rep.key + ".bin",
            new Blob([report], { type: "application/octet-stream" })
        );
        await FileSystemService.writeJSONFile(
            "reports/" + rep.key + ".json",
            rep
        );
    }

    async function injectReportList() {
        const reportObject = { reports: [] };

        await FileSystemService.createDirectory("reports");

        await buildReportEntry(1, false, null, null);
        await buildReportEntry(2, true, null, 100);
        await buildReportEntry(3, false, "Error uploading", null);
        await buildReportEntry(4, true, "Error acking", 100);
    }

    async function injectCleanNotUploadedList() {
        await FileSystemService.createDirectory("reports");
        await buildReportEntry(1, false, null, null);
    }

    async function injectUploadedList() {
        await FileSystemService.createDirectory("reports");
        await buildReportEntry(1, true, null, null);
    }

    async function injectNotUploadedErrorList() {
        await FileSystemService.createDirectory("reports");
        buildReportEntry(1, false, "error with report", null);
    }

    beforeEach(inject(function(
        _$injector_,
        _Config_,
        _$q_,
        _FileSystemService_,
        _MockCordovaFile_,
        _$rootScope_,
        _$log_
    ) {
        $q = _$q_;
        $log = _$log_;
        $injector = _$injector_;

        MockFilePlugin = _MockCordovaFile_;
        FileSystemService = _FileSystemService_;
        MockFilePlugin.clear("/");
    }));

    it("should read acks from file on initialization", async function(done) {
        try {
            await injectReportList();

            const ReportService: IOTileAppModule.RobustReportService = $injector.get(
                "RobustReportService"
            );
            const state = await ReportService.state();

            expect(state.reports[0].acknowledged).toEqual(false);
            expect(state.reports[1].acknowledged).toEqual(true);
            expect(state.reports[2].acknowledged).toEqual(false);
            expect(state.reports[3].acknowledged).toEqual(true);

            done();
        } catch (err) {
            done.fail(err);
        }
    });

    it("should report if there are reports with errors", async function(done) {
        try {
            await injectReportList();

            const ReportService: IOTileAppModule.RobustReportService = $injector.get(
                "RobustReportService"
            );

            const state = await ReportService.state();

            expect(state.hasErrors).toBe(true);
            expect(state.globalError).toBe(null);

            done();
        } catch (err) {
            done.fail(err);
        }
    });

    it("should allow clearing errors", async function(done) {
        try {
            await injectReportList();

            const ReportService: IOTileAppModule.RobustReportService = $injector.get(
                "RobustReportService"
            );
            (ReportService as any)._errorMessage = "Forced error";

            await ReportService.clearErrors();

            const state = await ReportService.state();

            expect(state.hasErrors).toBe(false);
            expect(state.globalError).toBe(null);

            done();
        } catch (err) {
            for (const log of $log.info.logs) {
                // tslint:disable-next-line: no-console
                console.log(log);
            }

            for (const log of $log.log.logs) {
                // tslint:disable-next-line: no-console
                console.log(log);
            }
            done.fail(err);
        }
    });

    it("should correctly report hasData uploading is needed", async function(done) {
        try {
            await injectCleanNotUploadedList();

            const ReportService: IOTileAppModule.RobustReportService = $injector.get(
                "RobustReportService"
            );

            const state = await ReportService.state();
            expect(state.reportsToUpload).toBe(true);
            expect(state.cleanReportsToUpload).toBe(true);
            done();
        } catch (err) {
            done.fail(err);
        }
    });

    it("should report hasData even if report is errored", async function(done) {
        try {
            await injectNotUploadedErrorList();

            const ReportService: IOTileAppModule.RobustReportService = $injector.get(
                "RobustReportService"
            );

            const state = await ReportService.state();
            expect(state.reportsToUpload).toBe(true);
            expect(state.cleanReportsToUpload).toBe(false);
            done();
        } catch (err) {
            done.fail(err);
        }
    });

    it("should not report hasData if all reports uploaded", async function(done) {
        try {
            await injectUploadedList();

            const ReportService: IOTileAppModule.RobustReportService = $injector.get(
                "RobustReportService"
            );

            const state = await ReportService.state();
            expect(state.reportsToUpload).toBe(false);
            expect(state.cleanReportsToUpload).toBe(false);
            done();
        } catch (err) {
            done.fail(err);
        }
    });
});
