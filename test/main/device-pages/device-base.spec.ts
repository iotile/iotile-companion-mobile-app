import { packArrayBuffer, unpackArrayBuffer } from "@iotile/iotile-common";
import { IndividualReport, RawReading } from "@iotile/iotile-device";
import * as TestHelpers from "../../ng-iotile-app/helpers/standard-jig";

// Make sure main module is defined
import "../../../app/main/main";

describe("Device Base", function() {
    const jig = new TestHelpers.StandardJig();
    jig.mockModule("main");
    jig.mockCacheService({
        devices: 1,
        sensorgraphs: ["accelerometer-v0-1-0"],
        proj_gid: "0000-0001"
    });

    jig.device_it(
        "should be able to display negative numbers",
        "defaultCtrl",
        "d--0000-0000-0000-0001",
        "00000000-0000-4000-0000-000100000000",
        async (controller, scope) => {
            expect(controller.error).toBeNull();
            // Set the raw_format_value of the stream we're checking to '<l'
            const firstBinding = Object.keys(controller.bindings)[0];
            const stream_number: number =
                controller.bindings[firstBinding].stream;
            const streamID = controller.buildStreamID(stream_number);
            controller.streams[streamID].rawValueFormat = "<l";

            // Make an IndividualReport
            const [signed] = unpackArrayBuffer("l", packArrayBuffer("l", -45));
            const unsigned = new Uint32Array([-45])[0];
            const rawReading = new RawReading(
                stream_number,
                unsigned,
                1,
                new Date()
            );
            const report = new IndividualReport(1, 1, rawReading);
            expect(report.reading.value).toBe(unsigned);

            await controller.processStream(report);
            expect(controller.lastValue(stream_number)).toBe(signed.toString());
        }
    );
});
