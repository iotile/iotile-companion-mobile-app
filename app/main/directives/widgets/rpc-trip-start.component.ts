import { RPCArgs, StatefulRPCArgs } from "@iotile/iotile-cloud";
import { WidgetBase } from "@iotile/iotile-common";
import angular = require("angular");
import { RPCStateWidget } from "./rpc-state.component";

export class RPCTripStartWidget extends RPCStateWidget {
    public rpc: StatefulRPCArgs;

    constructor($injector, $scope) {
        super("RPCTripStart", $injector, $scope);

        if (this.widget.args instanceof StatefulRPCArgs) {
            this.rpc = this.widget.args;
        } else {
            this.logError(
                "Widget incorrectly configured, missing state arguments"
            );
        }
    }

    protected changeState(resp: any[]) {
        const next = this.rpc.transitionStates[0];

        this.logInfo(
            `[RPCTripStart] Queried trip status, transitioning to ${next}`
        );
        this.channel.setState(next);
        this.cleanup();
    }
}

// Register our component so we can invoke it from a directive
angular.module("main").component("rpcTripStart", {
    bindings: {
        widget: "<",
        channel: "<",
        value: "<"
    },
    controller: RPCTripStartWidget,
    template: `<div ng-if="$ctrl.widget.args.currentState && !$ctrl.widget.args.auto">
                <button class="button button-block" ng-click="$ctrl.connectRPC()">
                    <i class="icon ion-play"></i> Start Trip
                </button>
            </div>`
});
