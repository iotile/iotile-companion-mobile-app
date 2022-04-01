import * as IOTileCloudModule from "@iotile/iotile-cloud";
import { ControllerBase, UISeverity } from "@iotile/iotile-common";
import { CacheService } from "../cache-serve";
import { UIService } from "../ui-serv";
import { WalkService } from "../walkthrough-serv";

export abstract class BaseSettingsController extends ControllerBase {
    protected cache: CacheService;
    protected net;
    protected ui: UIService;
    protected cloud: IOTileCloudModule.IOTileCloud;
    protected walk: WalkService;
    protected params;

    protected project: IOTileCloudModule.Project;
    protected device: IOTileCloudModule.Device;
    protected origDevice: IOTileCloudModule.Device;
    protected sg: IOTileCloudModule.SensorGraph;

    protected deviceSlug: string;

    constructor(name: string, $injector, $scope) {
        super(name, $injector, $scope);

        this.cloud = $injector.get("IOTileCloud");
        this.cache = $injector.get("CacheService");
        this.walk = $injector.get("WalkService");
        this.net = $injector.get("NetService");
        this.ui = $injector.get("UIService");
        this.params = $injector.get("$stateParams");

        this.project = null;
        this.device = null;
        this.origDevice = null;
        this.sg = null;

        this.deviceSlug = null;
    }

    public cancelClick() {
        this.$ionicHistory.goBack();
    }

    public async saveClick() {
        await this.showLoading("Saving...");

        try {
            /*
             * Fetch the changes that may possibly have been made on the settings page and then classify them into
             * those that actually change something and find the affected models.  Once we have those models, try to
             * either update them in the cloud or locally.  Combine these settings with whatever was previously stored
             * in the local project overlay and use the resulting combination
             */
            const deltas = this.getChanges();
            const overlay = new IOTileCloudModule.ProjectOverlay(deltas);

            // If we are online, patch models on iotile.cloud and commit changes to our active project
            // saving the results into the serialized project object itself as if we resynced it from the
            // cloud.
            // If we are offline, update our offline overlay with the new deltas and save it to disk.
            if (this.net.isOnline()) {
                // Prune all deltas that don't do anything if we are going to do an online patch
                // Don't prune if we are updating locally only since we need to overwrite any previous
                // deltas that might no longer be necessary.  We will prune after merging in updateActiveProject(overlay, false);
                overlay.prune(this.project);
                await this.patchOnline(overlay);
                await this.cache.updateActiveProject(overlay, true);
            } else {
                await this.cache.updateActiveProject(overlay, false);
            }

            if (!this.walk.active()) {
                this.$ionicHistory.goBack();
                return;
            }
        } catch (err) {
            let msg = err.userMessage || err.message;
            if (!msg) {
                msg = "Unknown internal error saving data.";
            }

            this.log_warn("Error saving data: " + msg, err);
            this.setError(msg);

            if (this.walk.active()) {
                throw err; // Rethrow so that we don't leave the page when we're on the walkthrough.
            }
        } finally {
            this.hideLoading();
        }
    }

    public walkthroughActive(): boolean {
        return this.walk.active();
    }

    // Return a list of the the changes that have (possibly) been created by this settings page.
    // Those changes will be filtered to see which ones actually change something and then used to update
    // either the cloud or our local project overlay.
    protected abstract getChanges(): Array<
        IOTileCloudModule.StreamDelta | IOTileCloudModule.DeviceDelta
    >;

    protected async postInitialize() {}

    /*
     * Load in and verify settings information for project and device
     * Returns true if loading was successful and false otherwise.
     */
    protected async loadDeviceData(): Promise<boolean> {
        this.project = await this.cache.getActiveProject();
        if (!this.project) {
            await this.ui.alert(
                "Error!",
                "Project data was not properly downloaded.  Try resyncing cloud data or contact Arch.",
                UISeverity.Error
            );
            this.log_error("No active project in io settings");
            this.$ionicHistory.goBack();
            return false;
        }

        this.deviceSlug = this.params.deviceId;

        this.device = this.project.getDevice(this.deviceSlug);
        this.origDevice = this.project.getDevice(this.deviceSlug, true);
        if (!this.device) {
            await this.ui.alert(
                "Error!",
                "Device data was not properly downloaded.  Try resyncing cloud data or contact Arch.",
                UISeverity.Error
            );
            this.log_error(
                "No device in active project in io settings",
                this.deviceSlug,
                this.project
            );
            this.$ionicHistory.goBack();
            return false;
        }

        this.sg = this.project.getSensorGraph(this.device.sensorGraphSlug);
        if (!this.sg) {
            await this.ui.alert(
                "Error!",
                "Sensor graph data was not properly downloaded.  Try resyncing cloud data or contact Arch.",
                UISeverity.Error
            );
            this.log_error(
                "No sg in active project in io settings",
                this.device.sg,
                this.project
            );
            this.$ionicHistory.goBack();
            return false;
        }

        return true;
    }
    /*
     * We need to load in a lot of data to be able to modify an IO Setting:
     * The project, device, variable, stream, variable type and sensorgraph
     *
     * If any of them cannot be found, throw a fatal error and leave.
     */
    protected async initialize() {
        await this.loadDeviceData();

        // Hook to allow for subclasses to initialize themselves
        try {
            await this.postInitialize();
        } catch (err) {
            let msg = err.message;
            if (!msg) {
                msg = "An unknown initialization error occured.  Contact Arch.";
            }

            this.log_error("Error doing subclass specific initialization", err);
            await this.ui.alert("Error!", msg, UISeverity.Error);
            this.$ionicHistory.goBack();
            return;
        }

        this.$scope.$apply();
    }

    private async patchOnline(overlay: IOTileCloudModule.ProjectOverlay) {
        const deviceSlugs = overlay.affectedDeviceModels();
        const streamSlugs = overlay.affectedStreamModels();

        if (deviceSlugs.length > 0) {
            this.log_info(
                "Patching " + deviceSlugs.length + " modified devices in cloud"
            );
        } else {
            this.log_info(
                "No device model modifications, skipping device patch."
            );
        }

        for (const slug of deviceSlugs) {
            const cloudDev = await this.cloud.fetchDevice(slug);
            const patch = overlay.patchForDevice(cloudDev);

            this.log_info(
                "Patching cloud device model with slug: " + slug,
                cloudDev,
                patch
            );
            await this.cloud.patchModel(slug, patch);
        }

        if (streamSlugs.length > 0) {
            this.log_info(
                "Patching " + streamSlugs.length + " modified streams in cloud"
            );
        } else {
            this.log_info(
                "No stream model modifications, skipping stream patch."
            );
        }

        for (const slug of streamSlugs) {
            const cloudStream = await this.cloud.fetchStream(slug);
            const patch = overlay.patchForStream(cloudStream);

            this.log_info(
                "Patching cloud stream model with slug: " + slug,
                cloudStream,
                patch
            );
            await this.cloud.patchModel(slug, patch);
        }
    }
}
