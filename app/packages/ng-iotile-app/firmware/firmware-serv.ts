import { IOTileCloud } from "@iotile/iotile-cloud";
import {
    ArgumentError,
    delay,
    deviceIDToSlug,
    MessageSeverity,
    OperationMessage,
    ProgressNotifier,
    ServiceBase
} from "@iotile/iotile-common";
import {
    IOTileAdapter,
    IOTileDevice,
    UserRedirectionInfo
} from "@iotile/iotile-device";
import angular = require("angular");
import { FileLocation, FileSystemService } from "../filesystem-serv";
import { ProgressModal } from "../modals/progress-modal";
// import {UsageDataService} from "../usage-data-serv";
import { Mutex } from "../mutex";
import { UIService } from "../ui-serv";
import { FirmwareScript } from "./firmware-script";
import { DeviceMetadata, SerializedFirmwareFile } from "./firmware-types";

const INCLUDED_FIRMWARE_DIR = "www/bundled_firmware/";
const FIRMWARE_FILE_VERSION = "1.0.0";

export class FirmwareService extends ServiceBase {
    private fs: FileSystemService;
    private adapter: IOTileAdapter;
    private ui: UIService;
    private fsMutex: Mutex;
    private cloud: IOTileCloud;
    // private usageData: UsageDataService;

    private undirectedScripts: FirmwareScript[];

    constructor(
        $injector,
        FileSystemService,
        IOTileAdapter,
        UIService,
        IOTileCloud
    ) {
        super("FirmwareService", $injector);

        this.fsMutex = new Mutex();
        this.fs = FileSystemService;
        this.ui = UIService;
        this.cloud = IOTileCloud;
        this.adapter = IOTileAdapter;
        // this.usageData = UsageDataService;
        this.undirectedScripts = [];

        this.beginInitialization();
    }

    public async checkAndApplyScripts(
        device: IOTileDevice,
        adapter: IOTileAdapter
    ): Promise<UserRedirectionInfo> {
        // If we were not able to correctly initialize the firmware service, don't break the device connection process
        try {
            await this.initialized;
        } catch (err) {
            this.log_error(
                "Error initializing firmware service, skipping check on device connection",
                err
            );
            return null;
        }

        const meta = await this.collectDeviceMetadata(device);
        this.log_info("Collected metadata from device", meta);

        const applicable: FirmwareScript[] = [];

        for (const script of this.undirectedScripts) {
            if (await script.applies(meta, device)) {
                applicable.push(script);
            }
        }

        if (applicable.length === 0) {
            this.log_debug("No applicable firmware updates for device");
            return null;
        }

        /**
         * If we are connecting to the device in a non-interactive fashion, e.g., the Collect All button, we can't
         * update firmware or show any modals during the connection process, so instead, just append a warning message
         * asking the user to connect directly to the device and update its firmware.
         */
        if (!adapter.interactive) {
            adapter.connectionMessages.push(
                new OperationMessage(
                    MessageSeverity.Warn,
                    // tslint:disable-next-line: no-invalid-template-strings
                    "${label} needs a firmware update, please click on it to update."
                )
            );
            return null;
        }

        this.log_info(
            `Found ${applicable.length} script(s) to run on device`,
            applicable
        );

        // There's not a good way to run multiple scripts, so only run the first script on the device and then have the user return to
        // the project page.
        const script = applicable[0];
        if (script.critical) {
            const result = await this.applyCriticalScript(
                script,
                device,
                adapter
            );
            return {
                reason: result,
                userNotified: true,
                redirectState: "main.activeProject"
            };
        }

        // FIXME: Add support for noncritical scripts that are not bundled with the app itself

        return null;
    }

    /**
     * This function applies a critical script to a device.
     *
     * Critical means that the user is not able to connect to the device without
     * applying the update so show a confirmation box that does not let the user access
     * the device without applying the firmware update.
     *
     * @returns A message to be logged about whether the firmware update was successful
     */
    public async applyCriticalScript(
        script: FirmwareScript,
        device: IOTileDevice,
        adapter: IOTileAdapter
    ): Promise<string> {
        await this.ui.hideLoading();

        const result = await this.ui.confirm(
            "Required Update",
            `<p>There is a critical firmware update for your device.  It should take less than 5 minutes to update.</p><p><b>Update Description</b></p><p>${
                script.description
            }</p>`,
            "Go Back",
            "Update"
        );
        if (!result) {
            return "User chose not to apply firmware update";
        }

        try {
            await this.synchronousUpdate(script, device, adapter);
        } catch (err) {
            // Don't propagate the error since we are leaving from cancelation in all cases.
            this.log_warn("Error during firmware update", err);
            return "Error applying critical firmware update";
        } finally {
            // Force rescanning for devices because there is a bug in the android ble stack or cordova ble plugin that
            // will timeout the next connection to a device if we don't clear the stack with a scan.  Also in case,
            // we changed any advertisement flags on the updated device, make sure we resync the latest flags.
            adapter.lastScanResults = [];
        }

        /**
         * Log in UsageDataService that we just updated a device.  The cloud accepts a 10 character string
         * with the firmware version that was applied.  If we have an update_id field with the firmware
         * script, use that and post it to the cloud.
         */

        if (script.updateID != null) {
            this.cloud
                .postFirmwareUpgrade(device.slug, script.updateID)
                .catch(err =>
                    this.log_warn(
                        "Error posting upgrade status back to cloud server",
                        err
                    )
                );
        }

        return "Critical firmware update applied successfully";
    }

    public async synchronousUpdate(
        script: FirmwareScript,
        device: IOTileDevice,
        adapter: IOTileAdapter
    ) {
        const modal: ProgressModal = new ProgressModal(
            this.$injector,
            "Updating Firmware",
            "This should take less than 5 minutes. Please don't close your phone. The phone will stay awake during the update so you can just leave it near the device if you want."
        );

        modal.manageOperation(
            notifier => this.runScript(notifier, script, device, adapter),
            true
        );

        if (window.plugins) {
            window.plugins.insomnia.keepAwake();
        }

        try {
            await modal.run();
        } finally {
            await this.adapter.disconnect();
            window.plugins.insomnia.allowSleepAgain();
        }
    }

    public async runScript(
        notifier: ProgressNotifier,
        script: FirmwareScript,
        device: IOTileDevice,
        adapter: IOTileAdapter
    ) {
        const data: ArrayBuffer = await this.fs.readFile(
            script.path,
            script.fs as FileLocation
        );

        // Include a quick 1/3 progress to encourage the user that this process won't be too slow
        notifier.setTotal(3);
        notifier.startOne("Preparing to update", 1);
        notifier.finishOne();

        let sub = notifier.startOne("Sending Firmware to Device", 1);

        this.log_info("Starting to send script to device");
        await this.adapter.sendScript(data, sub);

        notifier.finishOne();

        sub = notifier.startOne("Waiting for update to finish", 11);

        sub.startOne("Waiting 0 of 10 seconds", 1);
        this.log_info("Triggering script");
        await device.remoteBridge().triggerScript();
        sub.finishOne();

        for (let i = 0; i < 10; ++i) {
            sub.startOne(`Waiting ${i + 1} of 10 seconds`, 1);
            await delay(1000);
            sub.finishOne();
        }
    }

    protected async initialize() {
        await this.checkIncludedFirmware();

        /*
         * Hook into the IOTileAdapter so that we can check every device we connect to whether there are
         * any scripts that we should apply and if so show the user a confirmation and a modal.
         */
        this.adapter.registerConnectionHook((device, adapter) =>
            this.checkAndApplyScripts(device, adapter)
        );
    }

    private async collectDeviceMetadata(
        device: IOTileDevice
    ): Promise<DeviceMetadata> {
        const meta: DeviceMetadata = {
            controllerVersion: await device.controllerVersionRPC(),
            controllerHWTag: await device.controllerHWVersionRPC()
        };

        return meta;
    }

    /*
     * Check for any firmware files that are hardcoded and shipped with the app itself.
     * If there are any, load them.  Hardcoded firmware files are shipped with the app's
     * code inside the www folder since there does not appear to be a way to load the
     * data directory with files that are distributed as part of the app itself.
     *
     * See: https://github.com/apache/cordova-plugin-file#where-to-store-files
     */
    private async checkIncludedFirmware() {
        const incFirmwarePath =
            INCLUDED_FIRMWARE_DIR + "included_firmware.json";

        if (
            !(await this.fs.checkDirectory(INCLUDED_FIRMWARE_DIR, "app")) ||
            !(await this.fs.checkFile(incFirmwarePath, "app"))
        ) {
            this.log_debug("No bundled firmware included in app.");
            return;
        }

        const firmware: SerializedFirmwareFile = (await this.fs.readJSONFile(
            incFirmwarePath,
            "app"
        )) as any;
        if (firmware.version !== FIRMWARE_FILE_VERSION) {
            this.log_error(
                "Invalid firmware file version for included firmware",
                firmware.version,
                incFirmwarePath
            );
            return;
        }

        for (const serializedScript of firmware.firmware) {
            try {
                const script = await FirmwareScript.Deserialize(
                    serializedScript,
                    this.fs
                );

                // FIXME: Allow included scripts to be directed at particular devices by slug
                this.undirectedScripts.push(script);
            } catch (err) {
                this.log_error(
                    "Error deserializing included firmware, ignoring",
                    err
                );
            }
        }

        this.log_info(
            `Successfully loaded ${
                this.undirectedScripts.length
            } included firmware images`
        );
    }
}

angular.module("iotile.app").service("FirmwareService", FirmwareService);
