import { RPCArgs, StatefulSwitchArgs } from "@iotile/iotile-cloud";
import { WidgetBase } from "@iotile/iotile-common";
import angular = require("angular");

export class SwitchUploadTripWidget extends WidgetBase {
    public switch: StatefulSwitchArgs;

    constructor($injector, $scope) {
        super("SwitchUploadTrip", $injector, $scope);

        if (this.widget.args instanceof StatefulSwitchArgs) {
            this.switch = this.widget.args;
        } else {
            this.logError(
                "Widget incorrectly configured, missing state arguments"
            );
        }
    }

    public async initialize() {
        this.channel = (this.$scope.$parent as any).channel;
        this.widget = (this.$scope.$parent as any).widget;
    }

    public async connectRPC(rpc: RPCArgs) {
        // let resp = await this.channel.callRPC(rpc.addr, rpc.rpcId, rpc.callFmt, rpc.respFmt, rpc.args, rpc.timeout);
        const resp = [];
        resp.push(this.widget.args.rpcs.indexOf(rpc));
        this.changeState(resp);
    }

    public async cleanup() {
        this.switch.currentState = false;
    }

    protected changeState(resp: any[]) {
        // FIXME: change to response-based decision making
        const next = this.switch.transitionStates[resp[0]];

        this.channel.setState(next);
        this.cleanup();
    }
}

// Register our component so we can invoke it from a directive
angular.module("main").component("stchUploadTrip", {
    bindings: {
        widget: "<",
        channel: "<",
        value: "<"
    },
    controller: SwitchUploadTripWidget,
    template: `<div ng-if="$ctrl.switch.currentState">
                <div>
                    <button class="button button-block" icon-only style="vertical-align: middle;"
                         ng-click="$ctrl.connectRPC($ctrl.switch.rpcs[1])">
                            <i class="icon ion-upload"></i> Upload
                    </button>
                </div>
                <div>
                    <button class="button button-block" icon-only style="vertical-align: middle;"
                         ng-click="$ctrl.connectRPC($ctrl.switch.rpcs[0])">
                         <i class="icon ion-trash-a"></i> Discard Trip
                    </button>
                </div>
            </div>`
});
