import * as IOTileCloudModule from "@iotile/iotile-cloud";
import * as IOTileAppModule from "ng-iotile-app";
import * as TestHelpers from "../../ng-iotile-app/helpers/standard-jig";

// Make sure main module is defined
import "../../../app/main/main";
import { DefaultSettingsController } from "../../../app/main/pages/controllers/defaultSettingsCtrl";

describe("DefaultStreamSettings", function() {
    const jig = new TestHelpers.StandardJig();
    jig.mockModule("main");

    describe("Stream Label", function() {
        jig.mockCacheService("test-1");

        jig.controller_it(
            "should allow stream label of up to 50 characters",
            "defaultSettingsCtrl",
            async function(con: DefaultSettingsController, scope) {
                expect(con.stream.dataLabel).toBe("IO 1");
                // Set label to 50 chars
                con.dataLabel =
                    "Try this dataLabel that has exactly 50 characters!";

                jig.NetService.online = false;
                await con.saveClick();

                expect(con.stream.dataLabel).toBe("IO 1");
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
                expect(modifiedStream.dataLabel).not.toEqual("IO 1");
                expect(modifiedStream.dataLabel).toEqual(
                    "Try this dataLabel that has exactly 50 characters!"
                );
            },
            { deviceId: "d--0000-0000-0000-00b6", varId: "v--0000-0054--5003" }
        );

        jig.controller_it(
            "should NOT allow stream label of more than 50 characters",
            "defaultSettingsCtrl",
            async function(con: DefaultSettingsController, scope) {
                expect(con.stream.dataLabel).toBe("IO 1");
                // Set label to 52 chars
                con.dataLabel =
                    "Try this dataLabel that has more than 50 characters!";

                jig.NetService.online = false;
                await con.saveClick();

                expect(con.stream.dataLabel).toBe("IO 1");

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
                expect(modifiedStream.dataLabel).toEqual("IO 1");
                expect(modifiedStream.dataLabel).not.toEqual(
                    "Try this dataLabel that has more than 50 characters!"
                );
            },
            { deviceId: "d--0000-0000-0000-00b6", varId: "v--0000-0054--5003" }
        );
    });
});
