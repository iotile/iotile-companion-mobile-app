import * as IOTileCloudModule from "@iotile/iotile-cloud";
import * as TestHelpers from "../../ng-iotile-app/helpers/standard-jig";

// Make sure main module is defined
import "../../../app/main/main";
import { DefaultSettingsController } from "../../../app/main/pages/controllers/defaultSettingsCtrl";

describe("StreamSettings", function() {
    const jig = new TestHelpers.StandardJig();
    jig.mockModule("main");

    describe("Null Stream Units", function() {
        jig.mockCacheService("test-1");

        jig.async_it("StreamUnitsDelta should support nulls", async function() {
            const proj = await jig.MockCacheService.getActiveProject();
            const stream = proj.getStream(
                "s--0000-0054--0000-0000-0000-00b6--5003"
            );
            const variable = proj.getVariable("v--0000-0054--5003");

            expect(stream.inputUnit).toBeNull();
            expect(stream.outputUnit).toBeNull();

            const inputDelta = new IOTileCloudModule.StreamInputUnitsDelta(
                stream.inputUnit,
                variable.inputUnit,
                stream.slug,
                "test-guid"
            );

            expect(inputDelta.check(stream)).toEqual(
                IOTileCloudModule.DeltaStatus.Applies
            );
            expect(inputDelta.getPatch()).toEqual({
                input_unit: "in--soil-moisture-percent--percent"
            });
            expect(inputDelta.serialize()).toEqual({
                classname: "StreamInputUnitsDelta",
                guid: "test-guid",
                slug: "s--0000-0054--0000-0000-0000-00b6--5003",
                args: {
                    oldUnit: null,
                    newUnit: {
                        slug: "in--soil-moisture-percent--percent",
                        unit_full: "Percent",
                        unit_short: "%",
                        m: 100,
                        d: 4095,
                        o: 0
                    },
                    type: 0
                }
            });

            inputDelta.apply(stream);
            expect(stream.inputUnit).not.toBeNull();
            expect(stream.inputUnit.slug).toEqual(
                "in--soil-moisture-percent--percent"
            );

            const outputDelta = new IOTileCloudModule.StreamOutputUnitsDelta(
                stream.outputUnit,
                variable.outputUnit,
                stream.slug,
                "test-guid2"
            );

            expect(outputDelta.check(stream)).toEqual(
                IOTileCloudModule.DeltaStatus.Applies
            );
            expect(outputDelta.getPatch()).toEqual({
                output_unit: "out--soil-moisture-percent--percent"
            });
            expect(outputDelta.serialize()).toEqual({
                classname: "StreamOutputUnitsDelta",
                guid: "test-guid2",
                slug: "s--0000-0054--0000-0000-0000-00b6--5003",
                args: {
                    oldUnit: null,
                    newUnit: {
                        slug: "out--soil-moisture-percent--percent",
                        unit_full: "Percent",
                        unit_short: "%",
                        m: 1,
                        d: 1,
                        o: 0,
                        decimal_places: 1,
                        derived_units: {}
                    },
                    type: 1
                }
            });

            outputDelta.apply(stream);
            expect(stream.outputUnit).not.toBeNull();
            expect(stream.outputUnit.slug).toEqual(
                "out--soil-moisture-percent--percent"
            );
        });

        jig.controller_it(
            "should allow updating null input and output units",
            "defaultSettingsCtrl",
            async function(con: DefaultSettingsController, scope) {
                expect(con.stream.inputUnit).toBeNull();
                expect(con.stream.outputUnit).toBeNull();

                // Make sure slug is initialized from variable if stream is not present
                expect(con.inputUnitSlug).toBe(
                    "in--soil-moisture-percent--percent"
                );
                expect(con.outputUnitSlug).toBe(
                    "out--soil-moisture-percent--percent"
                );

                const vartype =
                    jig.MockCacheService.vartypeMap["soil-moisture-percent"];

                // Make sure we update both slugs when the user clicks save
                jig.NetService.online = false;
                await con.saveClick();

                const proj = await jig.MockCacheService.getActiveProject();
                const patch = proj.overlay.patchForStream(
                    proj.getStream(con.stream.slug, true)
                );

                expect(patch).toEqual({
                    input_unit: "in--soil-moisture-percent--percent",
                    output_unit: "out--soil-moisture-percent--percent"
                });

                const modifiedStream = proj.getStream(con.stream.slug, false);
                expect(modifiedStream.inputUnit).not.toBeNull();
                expect(modifiedStream.outputUnit).not.toBeNull();
                expect(modifiedStream.inputUnit.slug).toEqual(
                    "in--soil-moisture-percent--percent"
                );
                expect(modifiedStream.outputUnit.slug).toEqual(
                    "out--soil-moisture-percent--percent"
                );
            },
            { deviceId: "d--0000-0000-0000-00b6", varId: "v--0000-0054--5003" }
        );
    });
});
