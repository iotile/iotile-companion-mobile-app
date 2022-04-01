import { RPCArgs } from "@iotile/iotile-cloud";
import { WidgetBase } from "@iotile/iotile-common";
import angular = require("angular");

export class RPCDefaultWidget extends WidgetBase {
    constructor($injector, $scope) {
        super("RPCDefault", $injector, $scope);
    }

    public async initialize() {
        this.channel = (this.$scope.$parent as any).channel;
        this.widget = (this.$scope.$parent as any).widget;
    }

    public async connectRPC() {
        if (this.widget.args instanceof RPCArgs) {
            const rpc = this.widget.args;

            await this.channel.callRPC(
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
angular.module("main").component("rpcDefault", {
    bindings: {
        widget: "<",
        channel: "<",
        value: "<"
    },
    controller: RPCDefaultWidget,
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
