import * as IOTileCloudModule from "@iotile/iotile-cloud";

export interface TestCloudInformation {
    projects: IOTileCloudModule.Project[];
    vartypes: IOTileCloudModule.VarType[];
    project_templates: IOTileCloudModule.ProjectTemplate[];
}
