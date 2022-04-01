import { ControllerBase } from "@iotile/iotile-common";
import angular = require("angular");
import {
    CacheService,
    ProgressModal,
    UIService,
    UserService
} from "ng-iotile-app";

export class HomeController extends ControllerBase {
    public name: string;
    public version: string;

    private User: UserService;
    private history;
    private state;
    private cache: CacheService;

    constructor(
        $scope,
        $state,
        $ionicHistory,
        Config,
        User,
        UIService,
        FirmwareService,
        NetService,
        CacheService,
        $injector
    ) {
        super("HomeController", $injector, $scope);

        this.name = Config.ENV.NAME;
        this.version = Config.BUILD.VERSION || "0.0";

        this.User = User;
        this.cache = CacheService;
        this.state = $state;
        this.history = $ionicHistory;
    }

    protected async initialize() {
        this.log_info("Initializing");

        // When we first load up the app, we are taken to the home screen.
        // If we are not logged in, we should be redirected to the login screen.
        // There is a check in main.run.ts that will boot the user out to the login
        // screen when they change views but that will only fire on view *changes*
        await this.User.initialized;

        if (!this.User.isAuthenticated()) {
            this.state.go("login");
            return;
        }

        if (this.net.isOnline()) {
            try {
                // Per User.refresh().  If we should log the user out, refresh() returns false
                // otherwise true or an error thrown means we were not able to successfully talk
                // to te cloud to refresh the token but *does not* mean the token is invalid.
                const refreshSuccessful = await this.User.refresh();
                if (!refreshSuccessful) {
                    this.log_info(
                        "Redirecting to login page since user's token is expired."
                    );
                    this.state.go("login");
                    return;
                }
            } catch (err) {
                this.log_warn(
                    "Error refreshing token on home screen initialization",
                    err
                );
            }

            const orgs = await this.cache.projectList();
            if (!orgs.length) {
                const desc =
                    "The IOTile Companion App is designed to work without internet when necessary.  To do this we need to sync some data to your phone so we can connect to your devices.";
                const modal = new ProgressModal(
                    this.$injector,
                    "Fetching User Data",
                    desc
                );
                modal.manageOperation(notifier =>
                    this.cache.syncCache(notifier)
                );

                try {
                    // This also kicks off the process and synchronously waits until it is done since it's managing the operation
                    await modal.run();
                    this.log_info("Modal finished.");
                } catch (err) {
                    this.log_warn("Error fetching cloud data", err);
                }
            }
        }

        this.history.nextViewOptions({
            disableBack: true
        });

        const active = await this.cache.getActiveProject();
        if (active !== null) {
            this.state.go("main.activeProject");
        } else {
            this.state.go("main.projectList");
        }
    }
}

angular.module("main").controller("HomeCtrl", HomeController as any);
