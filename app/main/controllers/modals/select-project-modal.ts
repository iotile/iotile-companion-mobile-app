import * as IOTileCloudModule from "@iotile/iotile-cloud";
import { DataGatheringModal } from "@iotile/iotile-common";

export interface SelectProjectArgs {
    orgs: IOTileCloudModule.OrgMetaData[];
    selected: string;
}

export class SelectProjectModal extends DataGatheringModal<
    SelectProjectArgs,
    string
> {
    public orgs: IOTileCloudModule.OrgMetaData[];
    public selectedProjectID: string;

    constructor($injector) {
        super(
            $injector,
            "SelectProjectModal",
            "main/templates/modals/select-project.html"
        );
    }

    public onSelectProject(projectID: string) {
        this.selectedProjectID = projectID;
    }

    public onCancel() {
        this.closeWithData(null);
    }

    public onSave() {
        this.closeWithData(this.selectedProjectID);
    }

    protected async initialize() {
        this.orgs = [];
        this.selectedProjectID = this.args.selected;
        this.orgs = this.args.orgs;
    }
}
