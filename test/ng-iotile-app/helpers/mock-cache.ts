import {
    Project,
    ProjectOverlay,
    ProjectTemplate,
    VarType
} from "@iotile/iotile-cloud";
import { ArgumentError, DataCorruptedError } from "@iotile/iotile-common";

export class MockCacheService {
    public activeProject: Project;
    public projects: { [key: string]: Project };
    public vartypeMap: { [key: string]: VarType };
    public projTemplateMap: { [key: string]: ProjectTemplate };

    constructor() {
        this.activeProject = null;
        this.projects = {};
        this.vartypeMap = {};
        this.projTemplateMap = {};
    }

    public mockLoadVartypes(vartypes: VarType[]) {
        this.vartypeMap = {};
        for (const vartype of vartypes) {
            this.vartypeMap[vartype.slug] = vartype;
        }
    }

    public mockLoadProjectTemplates(project_templates: ProjectTemplate[]) {
        this.projTemplateMap = {};
        for (const template of project_templates) {
            this.projTemplateMap[template.slug] = template;
        }
    }

    public mockLoadProjects(projects: Project[]) {
        this.projects = {};

        for (const proj of projects) {
            this.projects[proj.id] = proj;
        }
    }

    public getVariableType(slug: string): Promise<VarType> {
        if (slug in this.vartypeMap) {
            return Promise.resolve(this.vartypeMap[slug]);
        }

        return Promise.reject(
            new ArgumentError("Could not find variable type: " + slug)
        );
    }

    public getProjectTemplate(slug: string): Promise<ProjectTemplate> {
        if (slug in this.projTemplateMap) {
            return Promise.resolve(this.projTemplateMap[slug]);
        }

        return Promise.reject(
            new ArgumentError("Could not find project template: " + slug)
        );
    }

    public getActiveProject(): Promise<Project> {
        return Promise.resolve(this.activeProject);
    }

    public setActiveProject(id: string): Promise<void> {
        if (!(id in this.projects)) {
            return Promise.reject(
                new ArgumentError("Could not find project id: " + id)
            );
        }

        this.activeProject = this.projects[id];
        return Promise.resolve();
    }

    public async updateActiveProject(
        overlay: ProjectOverlay,
        writeThrough: boolean
    ) {
        if (this.activeProject === null) {
            throw new DataCorruptedError(
                "There is no active project in updateActiveProject"
            );
        }

        if (writeThrough) {
            this.activeProject.applyOverlay(overlay);
        } else {
            this.activeProject.overlay.merge(overlay);
        }

        // In both cases prune unneeded overlay contents before saving. In the writeThrough case, these could be
        // conflicted updates from past overlays or already applied updates
        // In the local case, we could have gone back to a previous setting that is no longer a modification of the cloud
        this.activeProject.overlay.prune(this.activeProject);
    }
}
