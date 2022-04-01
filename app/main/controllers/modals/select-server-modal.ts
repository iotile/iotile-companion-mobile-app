import { ServerInformation } from "@iotile/iotile-cloud";
import { DataGatheringModal } from "@iotile/iotile-common";

export class SelectServerModal extends DataGatheringModal<
    ServerInformation[],
    ServerInformation
> {
    public choices: ServerInformation[];
    public selected: ServerInformation;

    constructor($injector) {
        super(
            $injector,
            "SelectServerModal",
            "main/templates/modals/select-server.html"
        );
    }

    public onSelectServer(server: ServerInformation) {
        this.selected = server;
    }

    public onSave() {
        this.closeWithData(this.selected);
    }

    protected async initialize() {
        this.choices = this.args;
        for (const server of this.choices) {
            if (server.default) {
                this.selected = server;
            }
        }
    }
}
