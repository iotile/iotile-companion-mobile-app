import { ControllerBase } from "@iotile/iotile-common";
import angular = require("angular");
import { LogMessage, SentryLogger } from "ng-iotile-app";
import { LogModal } from "./modals/log-modal";

export class LogListController extends ControllerBase {
    public logs: LogMessage[];
    public filterDebug: boolean;

    protected $ionicScrollDelegate;

    constructor($injector, $scope, $ionicScrollDelegate) {
        super("LogListController", $injector, $scope);

        this.$ionicScrollDelegate = $ionicScrollDelegate;
    }

    public reloadLogs() {
        this.logs = SentryLogger.stack.slice();

        if (this.filterDebug) {
            this.logs = this.logs.filter(log => log.level !== "debug");
        }

        this.$ionicScrollDelegate.resize();
    }

    public async showLog(log: LogMessage) {
        const modal = new LogModal(this.$injector, log);

        await this.showIsolatedModal(modal);
    }

    public clearLogs() {
        SentryLogger.stack = [];
        this.logs = [];
    }

    public parseDate(log: LogMessage) {
        return (
            log.timestamp.toDateString() +
            " " +
            log.timestamp.toLocaleTimeString()
        );
    }

    public logClass(log: LogMessage) {
        switch (log.level) {
            case "debug":
                return "icon ion-bug balanced";

            case "info":
                return "icon ion-information-circled balanced";

            case "warning":
                return "icon ion-android-warning energized";

            case "error":
                return "icon ion-ios-minus assertive";
        }
    }

    protected async initialize() {
        this.logs = SentryLogger.stack.slice();
        this.filterDebug = true;

        this.reloadLogs();
    }
}

angular
    .module("iotile.app")
    .controller("LogsController", LogListController as any);
