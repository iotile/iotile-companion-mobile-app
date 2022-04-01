import * as TestHelpers from "../../ng-iotile-app/helpers/standard-jig";
import { ShippingController } from "./../../../app/main/pages/controllers/shippingCtrl";
import {
    MockPOD1MDeviceConfig,
    TILE_STATE
} from "./../../ng-iotile-app/helpers/mock-pod1m";

// Make sure main module is defined
import { RawReading } from "@iotile/iotile-device";
import "../../../app/main/main";

describe("Shipping Device Page", async function() {
    const jig = new TestHelpers.StandardJig();

    jig.mockModule("main");

    const START_STREAM = "system buffered node 1536";
    const END_STREAM = "system buffered node 1537";
    const UPLOAD_STREAM = "system buffered node 1539";

    const GRAPH_INPUT_VALUES = {
        START_INPUT: "system input 1536",
        END_INPUT: "system input 1537",
        PAUSE_INPUT: "system input 1538",
        UPLOAD_INPUT: "system input 1539"
    };

    const defaultDeviceConfig: MockPOD1MDeviceConfig = {
        DOWNLOAD_STREAM: {
            [START_STREAM]: [],
            [END_STREAM]: [],
            [UPLOAD_STREAM]: []
        },
        ACCEL_STATUS: {
            tile_state: TILE_STATE.capturing,
            streaming: false,
            recording: false,
            settled: true
        },
        DEVICE_TIME: {
            isUTC: true,
            isSynchronized: true,
            currentTime: new Date()
        }
    };

    const notStartedDeviceConfig: MockPOD1MDeviceConfig = {
        ...defaultDeviceConfig
    };
    const pausedDeviceConfig: MockPOD1MDeviceConfig = {
        ...notStartedDeviceConfig,

        DOWNLOAD_STREAM: {
            [START_STREAM]: [new RawReading(1536, 300, 0, new Date(), 1)],
            [END_STREAM]: [],
            [UPLOAD_STREAM]: []
        }
    };
    const recordingDeviceConfig: MockPOD1MDeviceConfig = {
        ...pausedDeviceConfig,

        ACCEL_STATUS: {
            tile_state: TILE_STATE.capturing,
            streaming: false,
            recording: true,
            settled: true
        }
    };
    const uploadNeededDeviceConfig1: MockPOD1MDeviceConfig = {
        ...pausedDeviceConfig,

        DOWNLOAD_STREAM: {
            [START_STREAM]: [new RawReading(1536, 300, 0, new Date(), 1)],
            [END_STREAM]: [new RawReading(1537, 500, 0, new Date(), 1)],
            [UPLOAD_STREAM]: []
        }
    };
    const uploadNeededDeviceConfig2: MockPOD1MDeviceConfig = {
        ...pausedDeviceConfig,

        DOWNLOAD_STREAM: {
            [START_STREAM]: [new RawReading(1536, 300, 0, new Date(), 1)],
            [END_STREAM]: [new RawReading(1537, 500, 0, new Date(), 1)],
            [UPLOAD_STREAM]: [
                new RawReading(1539, 350, 0, new Date(), 1),
                new RawReading(1539, 450, 0, new Date(), 1)
            ]
        }
    };
    const finishedDeviceConfig: MockPOD1MDeviceConfig = {
        ...pausedDeviceConfig,

        DOWNLOAD_STREAM: {
            [START_STREAM]: [new RawReading(1536, 300, 0, new Date(), 1)],
            [END_STREAM]: [new RawReading(1537, 500, 0, new Date(), 1)],
            [UPLOAD_STREAM]: [new RawReading(1539, 600, 0, new Date(), 1)]
        }
    };

    jig.mockCacheService({
        devices: 1,
        sensorgraphs: ["shipping-v2-0-0"],
        proj_gid: "0000-0003"
    });

    describe("initialize", async function() {
        jig.device_configure_it(
            "should set not-started state",
            "shippingCtrl",
            "d--0000-0000-0000-0001",
            notStartedDeviceConfig,
            async (controller: ShippingController, scope) => {
                expect(controller.error).toBeNull();

                expect(controller.tripInfo.tripState).toBe(
                    controller.TRIP_STATE.NOT_STARTED
                );
            }
        );

        jig.device_configure_it(
            "should set paused state",
            "shippingCtrl",
            "d--0000-0000-0000-0001",
            pausedDeviceConfig,
            async (controller: ShippingController, scope) => {
                expect(controller.error).toBeNull();

                expect(controller.tripInfo.tripState).toBe(
                    controller.TRIP_STATE.PAUSED
                );
            }
        );

        jig.device_configure_it(
            "should set recording state",
            "shippingCtrl",
            "d--0000-0000-0000-0001",
            recordingDeviceConfig,
            async (controller: ShippingController, scope) => {
                expect(controller.error).toBeNull();

                expect(controller.tripInfo.tripState).toBe(
                    controller.TRIP_STATE.RECORDING
                );
            }
        );

        jig.device_configure_it(
            "should set upload needed state",
            "shippingCtrl",
            "d--0000-0000-0000-0001",
            uploadNeededDeviceConfig1,
            async (controller: ShippingController, scope) => {
                expect(controller.error).toBeNull();

                expect(controller.tripInfo.tripState).toBe(
                    controller.TRIP_STATE.UPLOAD_NEEDED
                );
            }
        );

        jig.device_configure_it(
            "should set upload needed state with mid-trip uploads",
            "shippingCtrl",
            "d--0000-0000-0000-0001",
            uploadNeededDeviceConfig2,
            async (controller: ShippingController, scope) => {
                expect(controller.error).toBeNull();

                expect(controller.tripInfo.tripState).toBe(
                    controller.TRIP_STATE.UPLOAD_NEEDED
                );
            }
        );

        jig.device_configure_it(
            "should set finished state",
            "shippingCtrl",
            "d--0000-0000-0000-0001",
            finishedDeviceConfig,
            async (controller: ShippingController, scope) => {
                expect(controller.error).toBeNull();

                expect(controller.tripInfo.tripState).toBe(
                    controller.TRIP_STATE.FINISHED
                );
            }
        );
    });

    describe("startTrip", async function() {
        jig.device_it(
            "should start a trip correctly",
            "shippingCtrl",
            "d--0000-0000-0000-0001",
            "00000000-0000-4000-0000-000300000000",
            async (controller, scope) => {
                expect(controller.error).toBeNull();

                spyOn(controller, "confirm").and.callFake(() => true);
                spyOn(controller, "synchronizeRealTimeClock");
                spyOn(controller.device, "graphInput");
                spyOn(controller, "setRecording");
                spyOn(controller, "showIsolatedModal");

                await controller.startTrip();

                // clock should be synced
                expect(controller.synchronizeRealTimeClock.calls.any()).toBe(
                    true
                );
                // start time should have been sent
                expect(controller.device.graphInput.calls.first().args[0]).toBe(
                    GRAPH_INPUT_VALUES.START_INPUT
                );
                // device should be set to record
                expect(controller.setRecording.calls.first().args[0]).toBe(
                    true
                );
                // note modal should be shown
                expect(
                    controller.showIsolatedModal.calls.first().args[0].className
                ).toBe("NoteModal");
            }
        );

        jig.device_configure_it(
            "should not start a trip if a trip has already started",
            "shippingCtrl",
            "d--0000-0000-0000-0001",
            recordingDeviceConfig,
            async (controller, scope) => {
                expect(controller.error).toBeNull();

                spyOn(controller, "confirm").and.callFake(() => true);
                spyOn(controller, "alert");
                spyOn(controller, "log_error");

                await controller.startTrip();

                // user should be alerted
                expect(controller.alert.calls.any()).toBe(true);
                // error should be logged
                expect(controller.log_error.calls.any()).toBe(true);
            }
        );
    });

    describe("endTrip", async function() {
        jig.device_configure_it(
            "should end a trip correctly",
            "shippingCtrl",
            "d--0000-0000-0000-0001",
            recordingDeviceConfig,
            async (controller, scope) => {
                expect(controller.error).toBeNull();

                spyOn(controller, "confirm").and.callFake(() => true);
                spyOn(controller.device, "graphInput");
                spyOn(controller, "syncTrip");

                await controller.endTrip();

                // should pause if recording
                expect(controller.device.graphInput.calls.first().args[0]).toBe(
                    GRAPH_INPUT_VALUES.PAUSE_INPUT
                );
                // should set end time
                expect(controller.device.graphInput.calls.argsFor(1)[0]).toBe(
                    GRAPH_INPUT_VALUES.END_INPUT
                );
                // should call syncTrip to update state
                expect(controller.syncTrip.calls.any()).toBe(true);
                // should set flag to upload data
                expect(controller.sessionInfo.latestUploaded).toBe(false);
            }
        );

        jig.device_configure_it(
            "should not end a trip if a trip has not started",
            "shippingCtrl",
            "d--0000-0000-0000-0001",
            notStartedDeviceConfig,
            async (controller, scope) => {
                expect(controller.error).toBeNull();

                spyOn(controller, "confirm").and.callFake(() => true);
                spyOn(controller, "alert");
                spyOn(controller, "log_error");

                await controller.endTrip();

                // user should be alerted
                expect(controller.alert.calls.any()).toBe(true);
                // error should be logged
                expect(controller.log_error.calls.any()).toBe(true);
            }
        );
    });

    describe("setRecording", async function() {
        jig.device_configure_it(
            "should pause trip correctly",
            "shippingCtrl",
            "d--0000-0000-0000-0001",
            recordingDeviceConfig,
            async (controller, scope) => {
                expect(controller.error).toBeNull();

                spyOn(controller, "confirm").and.callFake(() => true);
                spyOn(controller.device, "graphInput");
                spyOn(controller, "waitForRecordingToggle");

                await controller.setRecording(false);

                // should wait for the device to toggle
                expect(
                    controller.waitForRecordingToggle.calls.first().args[0]
                ).toBe(true);
                expect(controller.tripInfo.tripState).toBe(
                    controller.TRIP_STATE.PAUSED
                );
            }
        );

        jig.device_configure_it(
            "should resume trip correctly",
            "shippingCtrl",
            "d--0000-0000-0000-0001",
            pausedDeviceConfig,
            async (controller, scope) => {
                expect(controller.error).toBeNull();

                spyOn(controller.device, "graphInput");
                spyOn(controller, "waitForRecordingToggle");
                spyOn(controller, "waitForSettling");

                await controller.setRecording(true);

                // should wait for the device to toggle
                expect(
                    controller.waitForRecordingToggle.calls.first().args[0]
                ).toBe(false);
                // should wait for accellerometer to settle
                expect(controller.waitForSettling.calls.any()).toBe(true);
                expect(controller.tripInfo.tripState).toBe(
                    controller.TRIP_STATE.RECORDING
                );
                expect(controller.sessionInfo.latestUploaded).toBe(false);
            }
        );
    });

    describe("waitForRecordingToggle", async function() {
        jig.device_configure_it(
            "should wait for the device to toggle recording",
            "shippingCtrl",
            "d--0000-0000-0000-0001",
            pausedDeviceConfig,
            async (controller, scope) => {
                expect(controller.error).toBeNull();
                const changeFrom: boolean = false;
                const delayTime: number = 5;
                const timeOut: number = delayTime * 100;

                const isRecordingSpy = spyOn(
                    controller,
                    "isRecording"
                ).and.callFake(() => changeFrom);
                spyOn(controller, "log_info");

                // change recording state before timeout
                setTimeout(() => {
                    isRecordingSpy.and.callFake(() => !changeFrom);
                }, delayTime * 5);

                await controller.waitForRecordingToggle(
                    changeFrom,
                    delayTime,
                    timeOut
                );

                // should log new recording state
                expect(controller.log_info.calls.any()).toBe(true);
            }
        );

        jig.device_configure_it(
            "should log an error if timeout occurs",
            "shippingCtrl",
            "d--0000-0000-0000-0001",
            pausedDeviceConfig,
            async (controller, scope) => {
                expect(controller.error).toBeNull();
                const changeFrom: boolean = false;
                const delayTime: number = 5;
                const timeOut: number = delayTime * 10;

                const isRecordingSpy = spyOn(
                    controller,
                    "isRecording"
                ).and.callFake(() => changeFrom);
                spyOn(controller, "log_error");

                // recording state never changes so should timeout

                await controller.waitForRecordingToggle(
                    changeFrom,
                    delayTime,
                    timeOut
                );

                // should log timeout error
                expect(controller.log_error.calls.any()).toBe(true);
            }
        );
    });
});
