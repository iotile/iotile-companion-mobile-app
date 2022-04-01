import { UIService, UserService } from "ng-iotile-app";

export async function Initialization(
    $ionicPlatform,
    $rootScope,
    $ionicLoading,
    UIService: UIService,
    $log,
    $state,
    NetService,
    User: UserService,
    IOTileAdapter
) {
    if (window.StatusBar) {
        // org.apache.cordova.statusbar required
        window.StatusBar.styleDefault();
    }

    try {
        $ionicLoading.show("Starting up...");
        await User.initialized;
    } catch (err) {
        $log.error("Fatal error initializing iotile app.", err);
    } finally {
        $ionicLoading.hide();
    }

    /*
     * Try to refresh our login token every time we open the app, so do it on open and resume events.
     * Install handlers AFTER we wait for the User service to initialize so they don't run immediately
     * and redirect to a login page before we load user data from disk.
     */

    $ionicPlatform.on("resume", async function() {
        $log.log("[main.run] Attempting to refresh token on resume");

        if (NetService.isOnline()) {
            try {
                const tokenAccepted = await User.refresh();
                if (!tokenAccepted) {
                    $state.go("login");
                }
            } catch (err) {
                $log.warn("[main.run] Error refreshing token on resume", err);
            }

            $log.log("[main.run] Refresh attempt finished.");
        }

        IOTileAdapter.resume();
    });

    $ionicPlatform.on("pause", function() {
        $log.log("[main.run] app paused; stopping streaming interface");

        IOTileAdapter.pause();
    });

    $rootScope.$on("$stateChangeStart", function(
        event,
        toState,
        toStateParams,
        fromState,
        fromStateParams
    ) {
        if (
            !User.isAuthenticated() &&
            toState.name !== "register" &&
            toState.name !== "login"
        ) {
            $log.info(
                "[main.run] User was not authenticated so we redirected to the login page"
            );
            event.preventDefault(); // This is important to prevent the previous transition from happening since we're now redirecting
            $state.go("login");
        }
    });
}
