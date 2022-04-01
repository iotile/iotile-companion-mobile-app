import { RPCArgs, StatefulRPCArgs } from "@iotile/iotile-cloud";
import { WidgetBase } from "@iotile/iotile-common";
import angular = require("angular");
import { RPCStateWidget } from "./rpc-state.component";

export class RPCTripStopWidget extends RPCStateWidget {
    public rpc: StatefulRPCArgs;

    constructor($injector, $scope) {
        super("RPCTripStop", $injector, $scope);

        if (this.widget.args instanceof StatefulRPCArgs) {
            this.rpc = this.widget.args;
        } else {
            this.logError(
                "Widget incorrectly configured, missing state arguments"
            );
        }
    }

    protected changeState(resp: any[]) {
        // FIXME: change to response-based decision making
        const next = this.rpc.transitionStates[0];

        this.logInfo(
            `[RPCTripStop] Queried trip status, transitioning to ${next}`
        );
        this.channel.setState(next);
        this.cleanup();
    }
}

// Register our component so we can invoke it from a directive
angular.module("main").component("rpcTripStop", {
    bindings: {
        widget: "<",
        channel: "<",
        value: "<"
    },
    controller: RPCTripStopWidget,
    template: `<div ng-if="$ctrl.widget.args.currentState && !$ctrl.widget.args.auto">
                <button class="button button-block" ng-click="$ctrl.connectRPC()">
                    <i class="icon ion-stop"></i> Stop Trip
                </button>
            </div>`
});
