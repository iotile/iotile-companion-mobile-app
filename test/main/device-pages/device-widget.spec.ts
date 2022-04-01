import { DisplayWidget } from "@iotile/iotile-cloud";
import { StreamDefaultWidget } from "../../../app/main/directives/widgets/stream-default.component";
import * as TestHelpers from "../../ng-iotile-app/helpers/standard-jig";

// Make sure main module is defined
import "../../../app/main/main";
import { DeviceWidgetController } from "../../../app/main/pages/controllers/deviceWidgetCtrl";

describe("Widget Device Page", function() {
    const jig = new TestHelpers.StandardJig();
    const stream_args = new DisplayWidget({
        id: 74,
        label: "Peak Axis",
        lid_hex: "1016",
        type: "val",
        args: null,
        var_type: "default",
        derived_unit_type: "",
        show_in_app: true,
        show_in_web: false
    });
    jig.mockModule("main");

    jig.mockCacheService({
        devices: 1,
        sensorgraphs: ["single-moisture-single-temp-v1-0-0"],
        proj_gid: "0000-0002"
    });

    // tslint:disable-next-line: no-empty
    beforeEach(inject(function(_$compile_, _$rootScope_) {}));

    jig.device_it(
        "should initialize correctly",
        "deviceWidgetCtrl",
        "d--0000-0000-0000-0001",
        "00000000-0000-4000-0000-000200000000",
        async (controller, scope) => {
            expect(controller.error).toBeNull();
            expect(controller.widgets.length).toBe(2);
            expect(controller.deviceChannel).toBeDefined();
        }
    );

    jig.widget_it(
        "should be able to create default stream widget components",
        "streamDefault",
        stream_args,
        async (widget: any, channel) => {
            expect(widget).toBeDefined();
            expect(channel).toBeDefined();

            spyOn((widget as any) as StreamDefaultWidget, "onStreamData");

            expect(widget.channel.getStreamID).toHaveBeenCalled();
            expect(widget.channel.bindCallback).toHaveBeenCalled();
            expect(widget.channel.getUnits).toHaveBeenCalled();
            expect(widget.onStreamData).toHaveBeenCalled();
        }
    );
});
