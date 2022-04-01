import * as IOTileCloudModule from "@iotile/iotile-cloud";
import { ControllerBase } from "@iotile/iotile-common";
import angular = require("angular");
import { CacheService, WalkService } from "ng-iotile-app";
import { CreateProjectModal } from "./modals/create-project-modal";
import { SelectProjectModal } from "./modals/select-project-modal";

class SetupClaimController extends ControllerBase {
    public selectedProject: IOTileCloudModule.ProjectMetaData;
    public projects: { [key: string]: IOTileCloudModule.ProjectMetaData };
    public orgs: IOTileCloudModule.OrgMetaData[];

    public device: string; // The Device slug that we are trying to claim

    private cache: CacheService;
    private cloud: IOTileCloudModule.IOTileCloud;
    private $stateParams;
    private WalkService: WalkService;

    constructor(
        $scope,
        WalkService,
        $stateParams,
        CacheService,
        IOTileCloud,
        $injector
    ) {
        super("SetupClaimController", $injector, $scope);

        this.selectedProject = null;
        this.orgs = [];
        this.projects = {};

        this.cloud = IOTileCloud;
        this.cache = CacheService;
        this.WalkService = WalkService;
        this.$stateParams = $stateParams;

        this.device = $stateParams.deviceId;
    }

    public async showNewProjectModal() {
        const createModal = new CreateProjectModal(this.$injector);
        try {
            const createdProject = await createModal.run({ orgs: this.orgs });
            if (createdProject == null) {
                return;
            }

            await this.addProject(
                createdProject.projectOrgID,
                createdProject.projectName
            );
        } catch (err) {
            this.log_error("Error showing create project modal", err);
            this.setError("Error creating project.  Please try again.");
        }
    }

    public async showSelectProjectModal() {
        const selectModal = new SelectProjectModal(this.$injector);

        try {
            let selectedProjectID = null;
            if (this.selectedProject != null) {
                selectedProjectID = this.selectedProject.id;
            }

            selectedProjectID = await selectModal.run({
                orgs: this.orgs,
                selected: selectedProjectID
            });

            if (selectedProjectID != null) {
                if (!(selectedProjectID in this.projects)) {
                    this.log_error(
                        "Could not find project in our list of projects somehow"
                    );
                    return;
                } else {
                    this.selectedProject = this.projects[selectedProjectID];
                    this.$scope.$apply();
                }
            }
        } catch (err) {
            this.log_error("Error showing select project modal", err);
            this.setError("Error selecting project.  Please try again.");
        }
    }

    public async addProject(orgSlug: string, projectName: string) {
        this.showLoading("Creating Project");

        try {
            if (this.currentModal) {
                await this.hideModal();
            }

            const projectID = await this.cloud.createProject(
                orgSlug,
                projectName
            );
            await this.cache.syncProject(projectID);

            this.log_info("Created project with id: " + projectID);

            // Update our list to include this project and select the project
            this.updateOrgsAndProjects(await this.cache.projectList());
            this.selectedProject = this.projects[projectID];
            this.$scope.$apply();
        } catch (err) {
            let msg = "Error: Could not create project";

            if (err instanceof IOTileCloudModule.HttpError) {
                msg = "Error: " + err.shortUserErrorMsg();
            }

            this.log_warn("Error creating project", err);
            this.setError(msg);
        } finally {
            this.hideLoading();
        }
    }

    public async claimDevice() {
        this.log_info("Claiming device: " + this.device, this.selectedProject);

        const projectID = this.selectedProject.id;
        let deviceObject = null;
        let projectObject = null;

        await this.showLoading("Claiming Device");

        try {
            await this.cloud.claimDevice(this.device, projectID);

            // Update this project now that it contains our one device
            await this.cache.syncProject(projectID);
            await this.cache.setActiveProject(projectID);

            projectObject = await this.cache.getActiveProject();
            deviceObject = projectObject.getDevice(this.device);

            this.log_info("Project object in claiming", projectObject);
            this.log_info("Device object in claiming", deviceObject);

            if (!deviceObject) {
                this.setError(
                    "Error Claiming device, please try again.<br>Error Code: DC1"
                );
                return;
            }
        } catch (err) {
            let msg = "Error: Could not claim device";

            if (err instanceof IOTileCloudModule.HttpError) {
                msg = "Error: " + err.shortUserErrorMsg();
            } else if (err.message) {
                msg = "Error: " + err.message + " Please contact Arch.";
            }

            this.log_error("Error claiming device", err);
            this.setError(msg);
            return;
        } finally {
            await this.hideLoading();
        }

        // If we got here, everthing worked, start the setup walkthrough
        this.WalkService.begin(deviceObject, projectObject);
    }

    protected async initialize() {
        this.error = null;
        this.device = this.$stateParams.deviceId;
        this.selectedProject = null;
        this.projects = {};
        this.orgs = [];

        this.showLoading("Fetching Project List");

        try {
            const orgList = await this.cloud.fetchOrgMetaData();
            this.updateOrgsAndProjects(orgList);
            this.$scope.$apply();
        } catch (err) {
            let msg =
                "Error fetching data from cloud, please try again in a moment.";

            if (err instanceof IOTileCloudModule.HttpError) {
                msg += "  Details: " + err.longUserErrorMsg();
            }

            this.log_warn("Error initializing view", err);
            await this.leaveFromError(msg, "Error");
        } finally {
            this.hideLoading();
        }
    }

    private updateOrgsAndProjects(orgList: IOTileCloudModule.OrgMetaData[]) {
        this.orgs = orgList;

        this.projects = {};
        for (const org of this.orgs) {
            for (const proj of org.projects) {
                this.projects[proj.id] = proj;
            }
        }
    }
}

angular
    .module("main")
    .controller("SetupClaimCtrl", SetupClaimController as any);
