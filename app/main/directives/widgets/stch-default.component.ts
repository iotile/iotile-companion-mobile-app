import { RPCArgs } from "@iotile/iotile-cloud";
import { WidgetBase } from "@iotile/iotile-common";
import angular = require("angular");

export class SwitchDefaultWidget extends WidgetBase {
    constructor($injector, $scope) {
        super("SwitchDefault", $injector, $scope);
    }

    public async initialize() {
        this.channel = (this.$scope.$parent as any).channel;
        this.widget = (this.$scope.$parent as any).widget;
    }

    public async connectRPC() {
        if (this.widget.args instanceof RPCArgs) {
            const rpc = this.widget.args;

            const resp = await this.channel.callRPC(
                rpc.addr,
                rpc.rpcId,
                rpc.callFmt,
                rpc.respFmt,
                rpc.args,
                rpc.timeout
            );
        } else {
            this.logError("Widget incorrectly configured, missing arguments");
        }
    }

    public async cleanup() {
        // Do any required cleanup here
    }
}

// Register our component so we can invoke it from a directive
angular.module("main").component("stchDefault", {
    bindings: {
        widget: "<",
        channel: "<",
        value: "<"
    },
    controller: SwitchDefaultWidget,
    template: `<div class="card">
                <div class="item item-text-wrap"> 
                    <div>
                        <button class="button button-block button-assertive"
                         ng-click="$ctrl.connectRPC()">
                         {{$ctrl.widget.label}}
                        </button>
                    </div>
                </div>
            </div>`
});
