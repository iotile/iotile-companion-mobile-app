import * as TestHelpers from "../../ng-iotile-app/helpers/standard-jig";

// Make sure main module is defined
import "../../../app/main/main";
import { DefaultController } from "../../../app/main/pages/controllers/defaultCtrl";

describe("Default Device Page", function() {
    const jig = new TestHelpers.StandardJig();
    jig.mockModule("main");

    jig.device_it(
        "should initialize correctly",
        "defaultCtrl",
        "d--0000-0000-0000-0003",
        "5311e938-1150-4d40-bc66-e2319d112655",
        async (controller, scope) => {
            expect(controller.error).toBeNull();
        }
    );
});
