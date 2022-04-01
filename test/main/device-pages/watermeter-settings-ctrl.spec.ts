import * as IOTileCloudModule from "@iotile/iotile-cloud";
import * as IOTileAppModule from "ng-iotile-app";
import * as TestHelpers from "../../ng-iotile-app/helpers/standard-jig";

// Make sure main module is defined
import "../../../app/main/main";
import { WaterMeterSettings } from "../../../app/main/pages/controllers/waterMeterSettingsCtrl";

describe("WaterMeterStreamSettings", function() {
    const jig = new TestHelpers.StandardJig();
    jig.mockModule("main");

    describe("Stream Label", function() {
        jig.mockCacheService({
            devices: 1,
            sensorgraphs: ["water-meter-v1-1-0"],
            proj_gid: "0000-0001"
        });

        // tslint:disable-next-line: no-empty
        beforeEach(() => {});

        jig.controller_it(
            "should allow stream label of up to 50 characters",
            "waterMeterSettingsCtrl",
            async function(con: WaterMeterSettings, scope) {
                expect(con.stream.dataLabel).toBe("");
                // Set label to 50 chars
                con.dataLabel =
                    "Try this dataLabel that has exactly 50 characters!";

                jig.NetService.online = false;
                await con.saveClick();

                expect(con.stream.dataLabel).toBe("");
                expect(con.labelPrefix).toBe("IO 1");

                const proj = await jig.MockCacheService.getActiveProject();
                const patch = proj.overlay.patchForStream(
                    proj.getStream(con.stream.slug, true)
                );

                expect(patch).toEqual(
                    jasmine.objectContaining({
                        data_label:
                            "Try this dataLabel that has exactly 50 characters!"
                    })
                );

                const modifiedStream = proj.getStream(con.stream.slug, false);
                expect(modifiedStream.dataLabel).not.toEqual("");
                expect(modifiedStream.dataLabel).toEqual(
                    "Try this dataLabel that has exactly 50 characters!"
                );
            },
            { deviceId: "d--0000-0000-0000-0001", varId: `v--0000-0001--5001` }
        );

        jig.controller_it(
            "should NOT allow stream label of more than 50 characters",
            "waterMeterSettingsCtrl",
            async function(con: WaterMeterSettings, scope) {
                expect(con.stream.dataLabel).toBe("");
                // Set label to 52 chars
                con.dataLabel =
                    "Try this dataLabel that has more than 50 characters!";

                jig.NetService.online = false;
                await con.saveClick();

                expect(con.stream.dataLabel).toBe("");

                const proj = await jig.MockCacheService.getActiveProject();
                const patch = proj.overlay.patchForStream(
                    proj.getStream(con.stream.slug, true)
                );

                expect(patch).not.toEqual(
                    jasmine.objectContaining({
                        data_label:
                            "Try this dataLabel that has more than 50 characters!"
                    })
                );

                const modifiedStream = proj.getStream(con.stream.slug, false);
                expect(modifiedStream.dataLabel).toEqual("");
                expect(modifiedStream.dataLabel).not.toEqual(
                    "Try this dataLabel that has more than 50 characters!"
                );
            },
            { deviceId: "d--0000-0000-0000-0001", varId: `v--0000-0001--5001` }
        );
    });
});
