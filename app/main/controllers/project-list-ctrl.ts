import { IOTileCloud, OrgMetaData, Project } from "@iotile/iotile-cloud";
import { ControllerBase } from "@iotile/iotile-common";
import angular = require("angular");
import { CacheService, ProgressModal } from "ng-iotile-app";

export class ProjectListController extends ControllerBase {
    public name: string;
    public version: string;
    public orgs: OrgMetaData[];
    public activeProject: Project;
    public noDevices: boolean;

    public onRefresh: () => void;

    private cache: CacheService;
    private cloud: IOTileCloud;
    private history;
    private state;

    constructor(
        $scope,
        $state,
        $ionicHistory,
        Config,
        IOTileCloud,
        $timeout,
        UIService,
        $ionicModal,
        CacheService,
        $injector
    ) {
        super("ProjectListController", $injector, $scope);

        this.name = Config.ENV.NAME;
        this.version = Config.BUILD.VERSION || "0.0";
        this.activeProject = null;
        this.cloud = IOTileCloud;

        this.cache = CacheService;
        this.state = $state;
        this.history = $ionicHistory;

        this.noDevices = false;
    }

    public async fetchAll() {
        const desc =
            "Downloading user data for offline use.  This should take about 10 seconds.";
        const modal = new ProgressModal(
            this.$injector,
            "Fetching User Data",
            desc
        );
        modal.manageOperation(notifier => this.cache.syncCache(notifier));

        try {
            // This also kicks off the process and synchronously waits until it is done since it's managing the operation
            await modal.run();
            this.orgs = await this.cache.projectList();
        } catch (err) {
            this.log_warn("Error fetching cloud data", err);
        }
    }

    public async onSelectProject(id: string) {
        this.log_info("Selecting project: " + id);

        await this.showLoading("Loading Project...");

        try {
            this.history.nextViewOptions({
                disableBack: true
            });

            await this.cache.setActiveProject(id);
            this.state.go("main.activeProject");
        } catch (err) {
            this.log_error("Error setting active project", err);
            this.setError("Error selecting active project");
        } finally {
            await this.hideLoading();
            this.$scope.$apply();
        }
    }

    public async setupNewDevice() {
        if (this.net.isOnline()) {
            if (this.orgs.length > 0) {
                this.state.go("main.ble");
            } else {
                this.state.go("main.create-org");
            }
        } else {
            this.setError("You need internet access to setup a new device.");
        }
    }

    public async refresh() {
        if (this.net.isOnline()) {
            await this.fetchAll();
        } else {
            await this.initialize();
        }
    }

    /**
     * Initialization function called on $ionicView.enter by ControllerBase
     */
    protected async initialize() {
        await this.showLoading("Loading Stored Data...");

        try {
            this.orgs = await this.cache.projectList();
            this.activeProject = await this.cache.getActiveProject();
            this.noDevices = await this.cache.noDevices();
            this.$scope.$apply();
        } catch (err) {
            this.log_error("Error initializing page for project list.", err);
        } finally {
            await this.hideLoading();
        }
    }
}

angular
    .module("main")
    .controller("ProjectListCtrl", ProjectListController as any);
