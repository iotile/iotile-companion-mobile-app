import { ControllerBase } from "@iotile/iotile-common";
import angular = require("angular");
import {
    TileBusWebsocketAgent,
    WebSocketServerStatus
} from "../../packages/ng-iotile-app/classes/websocket-server";

/**
 * @ngdoc controller
 * @name main.controller:RemoteAccessController
 */
class RemoteAccessController extends ControllerBase {
    public ipList: string[];
    public port: number;
    public status: WebSocketServerStatus;
    public server: TileBusWebsocketAgent;

    constructor($scope, $injector, Config) {
        super("RemoteAccessController", $injector, $scope);

        this.port = 0;
        this.ipList = [];
        this.status = WebSocketServerStatus.ServerStopped;
        this.server = new TileBusWebsocketAgent(this.$injector);
        this.server.onChangeCallback = status => this.onStatusChange(status);
    }

    public onStatusChange(newStatus: WebSocketServerStatus) {
        this.status = newStatus;
        this.$scope.$apply();
    }

    protected async initialize() {
        this.port = 0;
        this.ipList = [];
        this.status = WebSocketServerStatus.ServerStopped;

        await this.server.start();

        this.ipList = this.server.interfaceAddresses;
        this.port = this.server.address.port;
        this.$scope.$apply();
    }

    protected async cleanup() {
        await this.server.stop();
    }

    public get statusString(): string {
        switch (this.status) {
            case WebSocketServerStatus.ServerStopped:
                return "Server Stopped";

            case WebSocketServerStatus.ServerStarting:
                return "Server Starting";

            case WebSocketServerStatus.ServerStarted:
                return "Server Running";

            case WebSocketServerStatus.UserConnected:
                return "User Connected";
        }
    }
}

angular
    .module("main")
    .controller("RemoteAccessController", RemoteAccessController as any);
