import { RPCArgs, StatefulRPCArgs } from "@iotile/iotile-cloud";
import { WidgetBase } from "@iotile/iotile-common";
import angular = require("angular");
import { RPCStateWidget } from "./rpc-state.component";

export class RPCTripStatusWidget extends RPCStateWidget {
    public rpc: StatefulRPCArgs;

    constructor($injector, $scope) {
        super("RPCTripStatus", $injector, $scope);

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
        const idx = Math.round(Math.random());
        const next = this.rpc.transitionStates[idx];

        this.logInfo(
            `[RPCTripStatus] Queried trip status, transitioning to ${next}`
        );
        this.channel.setState(next);
        this.cleanup();
    }
}

// Register our component so we can invoke it from a directive
angular.module("main").component("rpcTripStatus", {
    bindings: {
        widget: "<",
        channel: "<",
        value: "<"
    },
    controller: RPCTripStatusWidget,
    template: ``
});
