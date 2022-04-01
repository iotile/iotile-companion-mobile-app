import {
    Device,
    IOTileCloud,
    Project,
    ProjectTemplate
} from "@iotile/iotile-cloud";
import { ControllerBase, UISeverity } from "@iotile/iotile-common";
import { IOTileAdapter, IOTileAdvertisement } from "@iotile/iotile-device";
import angular = require("angular");
import {
    CacheService,
    Popover,
    PopoverService,
    ProgressModal,
    ReportUIService,
    RobustReportService,
    UIService,
    UploaderService,
    UserService
} from "ng-iotile-app";
import { NoteModal } from "./modals/note-modal";

interface DevicePageChoice {
    label: string;
    template: string;
    controller: string;
    directory?: string;
}

interface SelectedDevice {
    slug: string;
    pageChoices: DevicePageChoice[];
}

export class ActiveProjectController extends ControllerBase {
    public project: Project;
    public scanning: boolean;
    public bleEnabled: boolean;
    public cloud: IOTileCloud;
    public showAll: boolean;
    public nearbyDevices: Device[];
    public template: ProjectTemplate;

    public onRefresh: () => void;

    private deviceMap: { [key: string]: Device };
    private advertMap: { [key: string]: IOTileAdvertisement };

    private cache: CacheService;
    private state;
    private history;
    private ui: UIService;
    private reportService: RobustReportService;
    private reportUIService: ReportUIService;
    private adapter: IOTileAdapter;
    private uploader: UploaderService;
    private userService: UserService;

    private popoverService: PopoverService;
    private selectedDevice: SelectedDevice;
    private devicePagePopover: Popover;

    constructor(
        $scope,
        $rootScope,
        $state,
        $ionicHistory,
        ReportUIService,
        UIService,
        IOTileAdapter,
        CacheService,
        $injector,
        UploaderService,
        RobustReportService,
        IOTileCloud,
        PopoverService,
        User
    ) {
        super("ActiveProjectController", $injector, $scope);

        this.cache = CacheService;
        this.state = $state;
        this.history = $ionicHistory;
        this.adapter = IOTileAdapter;
        this.reportService = RobustReportService;
        this.reportUIService = ReportUIService;
        this.ui = UIService;
        this.uploader = UploaderService;
        this.cloud = IOTileCloud;
        this.popoverService = PopoverService;
        this.userService = User;

        this.project = null;
        this.template = null;
        this.nearbyDevices = [];
        this.scanning = false;
        this.bleEnabled = false;

        this.selectedDevice = null;
        this.devicePagePopover = null;

        this.deviceMap = {};
        this.advertMap = {};

        // NB Ionic seems to have issues calling a class method directly in onRefresh
        // Also, Ionic does not support an async function since it assumes it will
        // return a q promise that has a .finally method
        const that = this;
        this.onRefresh = () => {
            that.refresh()
                .catch(err => {
                    that.log_error("Uncaught error in scroll refresh", err);
                })
                .then(() => that.$scope.$broadcast("scroll.refreshComplete"));
        };
    }

    public getDefaultDevicePage(slug: string): DevicePageChoice {
        if (!(slug in this.deviceMap)) {
            this.log_error(
                "Managed to call getDefaultDevicePage for a device not in our deviceMap"
            );
            return null;
        }

        const cloudDevice = this.deviceMap[slug];

        const sg = this.project.getSensorGraph(cloudDevice.sensorGraphSlug);

        const template = sg.uiExtra.mobile.template;
        const controller = sg.uiExtra.mobile.controller;
        const directory = sg.uiExtra.mobile.directory;

        return {
            template,
            controller,
            directory,
            label: "Skin Default"
        };
    }

    public userConnected(slug: string) {
        return this.advertMap[slug].flags.otherConnected;
    }

    public deviceSeen(slug: string) {
        return slug in this.deviceMap;
    }

    public async scan(scanTime?: number) {
        if (this.scanning) {
            return;
        }

        if (!(await this.adapter.enabled())) {
            this.scanning = false;
            this.bleEnabled = false;
            this.$scope.$apply();
            return;
        }

        this.scanning = true;
        // clear device list while scanning
        this.buildDeviceMap([]);
        this.$scope.$apply();

        this.showLoading("Scanning...");

        try {
            // Default to scanning for 4 seconds but allow overriding this for quick testing
            if (scanTime == null) {
                scanTime = 4.0;
            }

            const adverts = await this.adapter.scan(scanTime);
            this.log_info(
                "Found " + adverts.length + " devices in range",
                adverts
            );
            this.buildDeviceMap(adverts);
        } catch (err) {
            // TODO: confirm that this is the right error to check for
            if (err === "Location permission not granted") {
                await this.alert(
                    "Location permission not granted",
                    "Location services are required for connecting to IOTile devices.",
                    UISeverity.Error
                );
            }
            this.log_error("Error scanning for devices", JSON.stringify(err));
        } finally {
            this.hideLoading();
            this.scanning = false;
            this.$scope.$apply();
        }
    }

    public async onHold($event: any, slug: string) {
        // TODO: Allow alternative pages to be listed and pulled from the cloud sg record
        //       that could be shown to all users when we have alternative pages for them

        this.selectedDevice = {
            slug,
            pageChoices: [this.getDefaultDevicePage(slug)]
        };

        if (this.userService.isStaff()) {
            this.selectedDevice.pageChoices.push(
                {
                    label: "Generic View",
                    template: "default",
                    controller: "defaultCtrl"
                },
                {
                    label: "Debug View",
                    template: "device-debug",
                    controller: "deviceDebugCtrl"
                }
            );
        }

        /**
         * Don't show the popover if there is only a single choice for what
         * page the user could be taken too.  Right now this is the same check
         * as whether or not the user is staff but once we allow multiple different
         * views for the same device, we will need the two separate checks.
         */
        if (this.selectedDevice.pageChoices.length === 1) {
            this.selectedDevice = null;
            return;
        }

        const popover = await this.popoverService.fromTemplateURL(
            "main/templates/popovers/choose-device-page.html",
            this.$scope,
            {
                backdropClickToClose: true
            }
        );

        this.devicePagePopover = popover;
        popover.autoRemove();
        await popover.show($event);
    }

    public async onCollect() {
        const modal = new ProgressModal(
            this.$injector,
            "Gathering Data",
            "We are in the process of scanning for nearby devices and uploading their data to the cloud."
        );

        modal.manageOperation(
            notifier => this.uploader.scanAndUpload(notifier),
            true
        );
        await modal.run();
    }

    public async addNote() {
        const modal = new NoteModal(this.$injector, this.project.devices);
        this.showIsolatedModal(modal);
    }

    public async onConnect(slug: string, page?: DevicePageChoice) {
        if (this.userConnected(slug)) {
            await this.ui.alert(
                "Device Locked!",
                "Another connection is already open to this device."
            );
            return;
        }

        if (!(slug in this.advertMap)) {
            this.log_error(
                "Managed to call onConnect for a slug not in our advertMap, slug: " +
                    slug,
                this.advertMap
            );
            return;
        }

        const advert = this.advertMap[slug];

        if (!(await this.adapter.enabled())) {
            this.bleEnabled = false;
            this.log_info("Tried to connect to a device but BLE was disabled.");
            return;
        }

        /*
         * Now actually switch to the device page.
         * We allow multiple different pages for each device with a default choice that
         * is specified by the cloud skin (SensorGraph) for the device.  If the caller
         * did not set the page explicitly, then pull in the cloud default and use that.
         */
        if (page == null) {
            page = this.getDefaultDevicePage(slug);

            if (page == null) {
                return;
            }
        }

        this.log_debug(
            "Executing $state.go to main.ioTilePage",
            page.template,
            page.controller,
            page.directory
        );
        this.state.go("main.ioTilePage", {
            deviceId: slug,
            template: page.template,
            controller: page.controller,
            directory: page.directory
        });
    }

    public async syncProject() {
        const that = this;
        const modal = new ProgressModal(
            this.$injector,
            "Syncing Project",
            "Downloading latest Project data from the cloud"
        );
        modal.manageOperation(notifier =>
            that.cache.syncProject(that.project.id, notifier)
        );

        if (window.plugins) {
            window.plugins.insomnia.keepAwake();
        }

        try {
            await modal.run();
            this.log_info("Modal finished.");

            await this.initialize();
            await this.scan();
        } catch (err) {
            this.log_warn("Error fetching project data", err);
        } finally {
            if (window.plugins) {
                window.plugins.insomnia.allowSleepAgain();
            }
        }
    }

    protected async initialize() {
        /**
         * If there is no active project somehow, boot the user back to the project selection
         * screen.  This should not happen in actual devices but can happen during browser
         * testing.
         */
        try {
            this.project = await this.cache.getActiveProject();

            if (this.project === null) {
                this.history.nextViewOptions({
                    disableBack: true
                });

                this.state.go("main.projectList");
                return;
            }

            this.log_info("Managing Project", this.project);

            if (this.project.template) {
                this.template = await this.cache.getProjectTemplate(
                    this.project.template
                );

                if (this.project.template.includes("shipping-template")) {
                    this.showAll = false;
                } else {
                    this.showAll = true;
                }
            } else {
                this.showAll = true;
            }

            this.bleEnabled = await this.adapter.enabled();

            if (this.bleEnabled) {
                await this.scan();
                this.buildDeviceMap(this.adapter.lastScanResults);
            } else {
                this.buildDeviceMap([]);
            }
        } catch (err) {
            this.log_error("Error initializing ActiveProjectController", err);
            this.history.nextViewOptions({
                disableBack: true
            });

            this.state.go("main.projectList");
        }
    }

    private buildDeviceMap(adverts: IOTileAdvertisement[]) {
        this.deviceMap = {};
        this.advertMap = {};
        this.nearbyDevices = [];

        if (this.project === null) {
            this.log_error(
                "Null project inside of active project controller, this should not happen."
            );
            return;
        }

        for (const advert of adverts) {
            if (this.project.hasDevice(advert.slug)) {
                this.deviceMap[advert.slug] = this.project.getDevice(
                    advert.slug
                );
                this.nearbyDevices.push(this.deviceMap[advert.slug]);
            }

            this.advertMap[advert.slug] = advert;
        }
    }

    private async refresh() {
        await this.scan();
    }
}

angular
    .module("main")
    .controller("ActiveProjectCtrl", ActiveProjectController as any);
