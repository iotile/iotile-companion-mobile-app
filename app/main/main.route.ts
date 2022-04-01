import { BasicNotificationService, Platform } from "@iotile/iotile-device";
import { SentryLogger } from "ng-iotile-app";
import {
    Category,
    CategoryConfiguration,
    CategoryLogFormat,
    CategoryServiceFactory,
    LoggerType,
    LogLevel
} from "typescript-logging";

function getPlatform(): Platform {
    const device = window.device;
    let platform: Platform;

    if (device) {
        const lowerPlatform = device.platform.toLowerCase();

        if (lowerPlatform === "ios") {
            platform = Platform.IOS;
        } else if (lowerPlatform === "android") {
            platform = Platform.Android;
        } else {
            platform = Platform.Web;
        }
    } else {
        platform = Platform.Web;
    }

    return platform;
}

export function Configuration(
    $stateProvider,
    $urlRouterProvider,
    $ionicConfigProvider,
    $provide
) {
    $provide.decorator("$log", logDecorator);

    $provide.constant("notificationService", new BasicNotificationService());
    $provide.constant("platform", getPlatform());

    /**
     * Redirect all angular logging to typescript-logging and make sure
     * all loggers use the sentry enhanced logging system.  These lines
     * will also ensure that all previously created loggers are reset to
     * the current logging configuration.  There should not be too many
     * of these logging messages since we directly log to typescript-logging
     * almost everywhere now.
     */
    const categoryConfig = new CategoryConfiguration(
        LogLevel.Info,
        LoggerType.Custom,
        new CategoryLogFormat(),
        (cat, runtime) => new SentryLogger(cat, runtime)
    );

    CategoryServiceFactory.setDefaultConfiguration(categoryConfig, true);

    logDecorator.$inject = ["$delegate"];
    function logDecorator($delegate) {
        const catAngular = new Category("angular");

        function captureLog(level: LogLevel, ...args: any[]) {
            let data;
            if (args.length > 1) {
                data = args.slice(1);
            }

            catAngular.log(
                level,
                {
                    msg: args[0],
                    data
                },
                null
            );
        }

        $delegate.log = (...args) => captureLog(LogLevel.Trace, ...args);
        $delegate.debug = (...args) => captureLog(LogLevel.Debug, ...args);
        $delegate.info = (...args) => captureLog(LogLevel.Info, ...args);
        $delegate.warn = (...args) => captureLog(LogLevel.Warn, ...args);
        $delegate.error = (...args) => captureLog(LogLevel.Error, ...args);

        // Allow angular mocks to work since it needs log stacks on each log function
        $delegate.log.logs = [];
        $delegate.debug.logs = [];
        $delegate.info.logs = [];
        $delegate.warn.logs = [];
        $delegate.error.logs = [];

        return $delegate;
    }

    $ionicConfigProvider.tabs.position("bottom");
    // Disable swipe to go back in iOS.  If the view is not cached, will be blank
    $ionicConfigProvider.views.swipeBackEnabled(false);

    // ROUTING with ui.router
    $urlRouterProvider.otherwise("/main/home");
    $stateProvider
        // this state is placed in the <ion-nav-view> in the index.html
        .state("login", {
            url: "/login",
            templateUrl: "main/templates/login.html",
            controller: "LoginCtrl as vm"
        })
        .state("register", {
            url: "/register",
            templateUrl: "main/templates/register.html",
            controller: "RegisterCtrl as vm"
        })
        .state("main", {
            url: "/main",
            abstract: true,
            templateUrl: "main/templates/menu.html",
            controller: "MenuCtrl as menu"
        })
        .state("main.home", {
            cache: false,
            url: "/home",
            views: {
                pageContent: {
                    templateUrl: "main/templates/home.html",
                    controller: "HomeCtrl as vm"
                }
            }
        })
        .state("main.create-org", {
            cache: true,
            url: "/active-project/createorg",
            views: {
                pageContent: {
                    templateUrl: "main/templates/setup-create-org.html",
                    controller: "SetupCreateOrgCtrl as vm"
                }
            }
        })
        .state("main.projectList", {
            cache: false,
            url: "/active-project",
            views: {
                pageContent: {
                    templateUrl: "main/templates/project-list.html",
                    controller: "ProjectListCtrl as vm"
                }
            }
        })
        .state("main.activeProject", {
            cache: false,
            url: "/active-project/device",
            views: {
                pageContent: {
                    templateUrl: "main/templates/active-project.html",
                    controller: "ActiveProjectCtrl as vm"
                }
            }
        })
        .state("main.ioTilePage", {
            cache: true,
            url:
                "/active-project/page/:deviceId/:template/:controller/:directory",
            views: {
                pageContent: {
                    templateUrl($stateParams) {
                        if ($stateParams.directory) {
                            return (
                                "main/pages/" +
                                $stateParams.directory +
                                "/" +
                                $stateParams.template +
                                ".html"
                            );
                        }
                        return (
                            "main/pages/templates/" +
                            $stateParams.template +
                            ".html"
                        );
                    },
                    controllerProvider($stateParams) {
                        if (
                            $stateParams.controller === "waterMeterDrifterCtrl"
                        ) {
                            return "waterMeterCtrl as vm";
                        }
                        return $stateParams.controller + " as vm";
                    }
                }
            }
        })
        .state("main.deviceSettings", {
            cache: true,
            params: {
                extraData: null
            },
            url:
                "/active-project/device/:deviceId/device-settings/:template/:controller",
            views: {
                pageContent: {
                    templateUrl($stateParams) {
                        if (
                            $stateParams.template &&
                            $stateParams.template !== ""
                        ) {
                            return (
                                "main/pages/templates/settings/" +
                                $stateParams.template +
                                ".html"
                            );
                        } else {
                            return "main/templates/device-settings.html";
                        }
                    },
                    controllerProvider($stateParams) {
                        if (
                            $stateParams.controller &&
                            $stateParams.controller !== ""
                        ) {
                            return $stateParams.controller + " as vm";
                        } else {
                            return "DeviceSettingsCtrl as vm";
                        }
                    }
                }
            }
        })
        .state("main.deviceGeolocate", {
            cache: true,
            url: "/active-project/device/:deviceId/geolocate",
            views: {
                pageContent: {
                    templateUrl: "main/templates/device-geolocate.html",
                    controller: "DeviceGeoLocateCtrl as vm"
                }
            }
        })
        .state("main.labelSettings", {
            cache: true,
            url: "/active-project/device/:deviceId/label",
            views: {
                pageContent: {
                    templateUrl: "main/templates/label-settings.html",
                    controller: "LabelSettingsCtrl as vm"
                }
            }
        })
        .state("main.ioSettings", {
            cache: true,
            url:
                "/active-project/device/:deviceId/io-settings/:varId/:template/:controller",
            views: {
                pageContent: {
                    templateUrl($stateParams) {
                        if ($stateParams.template !== "") {
                            return (
                                "main/pages/templates/" +
                                $stateParams.template +
                                ".html"
                            );
                        } else {
                            return "main/pages/templates/default-settings.html";
                        }
                    },
                    controllerProvider($stateParams) {
                        if ($stateParams.controller !== "") {
                            return $stateParams.controller + " as vm";
                        } else {
                            return "defaultSettingsCtrl as vm";
                        }
                    }
                }
            }
        })
        .state("main.reports", {
            cache: false,
            url: "/active-project/device/reports",
            views: {
                pageContent: {
                    templateUrl: "main/templates/reports.html",
                    controller: "ReportsCtrl as vm"
                }
            }
        })
        .state("main.bleDetail", {
            // cache: false,
            url: "/ble/:deviceId",
            views: {
                pageContent: {
                    templateUrl: "main/templates/setup-claim.html",
                    controller: "SetupClaimCtrl as vm"
                }
            }
        })
        .state("main.ble", {
            url: "/ble",
            views: {
                pageContent: {
                    templateUrl: "main/templates/setup-scan.html",
                    controller: "SetupScanCtrl as vm"
                }
            }
        })
        .state("main.about", {
            // cache: false,
            url: "/about",
            views: {
                pageContent: {
                    templateUrl: "main/templates/about.html",
                    controller: "AboutController as vm"
                }
            }
        })
        .state("main.remote", {
            // cache: false,
            url: "/remote",
            views: {
                pageContent: {
                    templateUrl: "main/templates/remote-access.html",
                    controller: "RemoteAccessController as vm"
                }
            }
        })
        .state("main.help", {
            // cache: false,
            url: "/help",
            views: {
                pageContent: {
                    templateUrl: "main/templates/help.html",
                    controller: "HelpController as vm"
                }
            }
        })
        .state("main.view-logs", {
            // cache: false,
            url: "/view-logs",
            views: {
                pageContent: {
                    templateUrl: "main/templates/staff-logs.html",
                    controller: "LogsController as vm"
                }
            }
        })
        .state("main.debug", {
            url: "/debug",
            views: {
                pageContent: {
                    templateUrl: "main/templates/debug.html",
                    controller: "DebugCtrl as vm"
                }
            }
        });
}
