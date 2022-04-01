import * as IOTileAppModule from "ng-iotile-app";
import * as TestHelpers from "../helpers/standard-jig";

describe("module: iotile.app, service: FirmwareService", function() {
    const jig = new TestHelpers.StandardJig();
    jig.mockModule("main");
    jig.mockCacheService({
        devices: 2,
        sensorgraphs: ["accelerometer-v0-1-0", "water-meter-v1-1-0"],
        proj_gid: "0000-0001"
    });

    jig.add_virtual_device(1, "accelerometer", {
        osVersion: 1024,
        appVersion: 1033,
        hwVersion: "btc1_v3"
    });
    jig.add_virtual_device(2, "nfc300", {
        robust: true,
        osVersion: 1024,
        appVersion: 1027,
        hwVersion: "btc1_v2"
    });
    jig.mockBleService();

    beforeEach(function() {});

    jig.device_it(
        "should know if a device has an available upgrade",
        "defaultCtrl",
        "d--0000-0000-0000-0001",
        "00000000-0000-4000-0000-000100000000",
        async (controller, scope) => {
            expect(controller.error).toBeNull();
        }
    );

    // tslint:disable-next-line
    /** Public API:
     *     checkandapplyscripts
     *     applycriticalscript
     *     runscript
     */
    // jig.device_it('should know if a device has an available upgrade', async function(rpcs, streams, hw_version){
    //     //bundled case: yes and no
    //     //interactive and non-interactive
    //     expect(rpcs).toBeDefined();

    // })

    // jig.device_it('should try to apply a critical script to a device', async function(rpcs, streams, hw_version){
    //     //critical: user says yes, user says no [no yes no]
    //     expect(rpcs).toBeDefined();

    // })

    // jig.device_it('should run the script on the target device', async function(rpcs, streams, hw_version){
    //     //send file, firmware version changes
    //     expect(rpcs).toBeDefined();
    // })
});
