import { RPCArgs, StatefulRPCArgs } from "@iotile/iotile-cloud";
import { WidgetBase } from "@iotile/iotile-common";
import angular = require("angular");
import { RPCStateWidget } from "./rpc-state.component";

export class RPCTripSetConfigWidget extends RPCStateWidget {
    public rpc: StatefulRPCArgs;

    constructor($injector, $scope) {
        super("RPCTripSetConfig", $injector, $scope);

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
            `[RPCTripGetConfig] Queried trip status, transitioning to ${next}`
        );
        this.channel.setState(next);
        this.cleanup();
    }
}

// Register our component so we can invoke it from a directive
angular.module("main").component("rpcTripSetConfig", {
    bindings: {
        widget: "<",
        channel: "<",
        value: "<"
    },
    controller: RPCTripSetConfigWidget,
    template: `<div class="card" ng-if="$ctrl.widget.args.currentState && !$ctrl.widget.args.auto">
                <div class="item item-text-wrap">
                    <div class="item item-divider">
                    Configuration Settings
                    </div>
                    <div class="list">
                        <label class="item item-input">
                        <input type="text" placeholder="Some">
                        </label>
                        <label class="item item-input">
                        <input type="text" placeholder="Config">
                        </label>
                        <label class="item item-input">
                        <textarea placeholder="Info"></textarea>
                        </label>
                    </div>
                    <div>
                        <button class="button button-block button-assertive"
                         ng-click="$ctrl.connectRPC()">
                         Configure Device
                        </button>
                    </div>
                </div>
            </div>`
});
