import * as IOTileCloudModule from "@iotile/iotile-cloud";
import { DataGatheringModal } from "@iotile/iotile-common";
import angular = require("angular");

export interface CreateProjectArgs {
    orgs: IOTileCloudModule.OrgMetaData[];
}

export interface CreateProjectResult {
    projectName: string;
    projectOrgID: string;
}

export class CreateProjectModal extends DataGatheringModal<
    CreateProjectArgs,
    CreateProjectResult
> {
    public orgs: IOTileCloudModule.OrgMetaData[];
    public selectedOrg: IOTileCloudModule.OrgMetaData;
    public projectName: string;

    constructor($injector) {
        super(
            $injector,
            "CreateProjectModal",
            "main/templates/modals/create-project.html"
        );
    }

    public canSave(): boolean {
        if (
            this.projectName == null ||
            this.projectName.length === 0 ||
            this.projectName.length > 30
        ) {
            return false;
        }

        if (this.selectedOrg == null) {
            return false;
        }

        return true;
    }

    public onCancel() {
        this.closeWithData(null);
    }

    public onSave() {
        if (!this.canSave()) {
            return;
        }

        this.closeWithData({
            projectName: this.projectName,
            projectOrgID: this.selectedOrg.slug
        });
    }

    protected async initialize() {
        this.selectedOrg = null;
        this.orgs = this.args.orgs;
        this.projectName = null;
    }
}
