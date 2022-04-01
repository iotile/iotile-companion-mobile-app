import { RPCArgs, StatefulRPCArgs } from "@iotile/iotile-cloud";
import { WidgetBase } from "@iotile/iotile-common";
import angular = require("angular");
import { RPCStateWidget } from "./rpc-state.component";

export class RPCTripUploadStatusWidget extends RPCStateWidget {
    public rpc: StatefulRPCArgs;

    constructor($injector, $scope) {
        super("RPCTripUploadStatus", $injector, $scope);

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
            `[RPCTripUploadStatus] Queried trip status, transitioning to ${next}`
        );
        this.channel.setState(next);
        this.cleanup();
    }
}

// Register our component so we can invoke it from a directive
angular.module("main").component("rpcTripUploadStatus", {
    bindings: {
        widget: "<",
        channel: "<",
        value: "<"
    },
    controller: RPCTripUploadStatusWidget,
    template: `<div class="card" ng-if="$ctrl.widget.args.currentState && !$ctrl.widget.args.auto">
                <div class="item item-text-wrap"> 
                    <div>
                        <button class="button button-block"
                         ng-click="$ctrl.connectRPC()">
                         Uploading...
                        </button>
                    </div>
                </div>
            </div>`
});
