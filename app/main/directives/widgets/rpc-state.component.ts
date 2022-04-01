import { RPCArgs, StatefulRPCArgs } from "@iotile/iotile-cloud";
import { WidgetBase } from "@iotile/iotile-common";
import angular = require("angular");

export class RPCStateWidget extends WidgetBase {
    public rpc: StatefulRPCArgs;

    constructor(name, $injector, $scope) {
        super(name, $injector, $scope);

        if (this.widget.args instanceof StatefulRPCArgs) {
            this.rpc = this.widget.args;
        } else {
            this.logError(
                "Widget incorrectly configured, missing state arguments"
            );
        }
    }

    public async initialize() {
        this.channel = (this.$scope.$parent as any).channel;
        this.widget = (this.$scope.$parent as any).widget;

        if (this.rpc.currentState && this.rpc.auto) {
            this.logInfo(
                `[RPCStateWidget] automatically triggering rpc call: ${
                    this.rpc.rpcId
                }`
            );
            this.connectRPC();
        }
    }

    public async connectRPC() {
        const resp = await this.channel.callRPC(
            this.rpc.addr,
            this.rpc.rpcId,
            this.rpc.callFmt,
            this.rpc.respFmt,
            this.rpc.args,
            this.rpc.timeout
        );
        this.changeState(resp);
    }

    public async cleanup() {
        this.rpc.currentState = false;
    }

    // overridden in subclasses
    protected changeState(resp: any[]) {}
}

// Register our component so we can invoke it from a directive
angular.module("main").component("rpcState", {
    bindings: {
        widget: "<",
        channel: "<",
        value: "<"
    },
    controller: RPCStateWidget,
    template: ``
});
