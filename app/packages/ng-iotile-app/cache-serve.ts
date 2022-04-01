import {
    ApiFilter,
    catCloud,
    Device,
    IOTileCloud,
    Membership,
    Org,
    OrgMetaData,
    Project,
    ProjectOverlay,
    ProjectTemplate,
    SensorGraph,
    SerializedOverlay,
    Stream,
    Variable,
    VarType
} from "@iotile/iotile-cloud";
import {
    ArgumentError,
    CorruptDeviceError,
    DataCorruptedError,
    DataStaleError,
    FileSystemError,
    guid,
    ProgressNotifier,
    UnknownFileSystemError
} from "@iotile/iotile-common";
import angular = require("angular");
import { FileSystemService } from "./filesystem-serv";
import { Mutex } from "./mutex";
import { UserService } from "./user-serv";

const DEVICE_FILTER = new ApiFilter();
DEVICE_FILTER.addFilter("page_size", "1000");

const STREAM_FILTER = new ApiFilter();
STREAM_FILTER.addFilter("page_size", "2000");

const PROJECT_FILTER = new ApiFilter();
PROJECT_FILTER.addFilter("page_size", "500");

export interface CloudData {
    projects: Project[];
    project_templates: ProjectTemplate[];
    orgs: Org[];
    devices: Device[];
    sensorgraphs: SensorGraph[];
    variables: Variable[];
    vartypes: VarType[];
    streams: Stream[];
}

export interface CloudCache {
    deviceMap: { [key: string]: Device }; // device slug to Device
    orgMap: { [key: string]: Org }; // org slug to Org
    projectMap: { [key: string]: Project }; // project id to Project
    sgMap: { [key: string]: SensorGraph }; // sg slug to SensorGraph
    varMap: { [key: string]: Variable }; // var slug to Variable
    vartypeMap: { [key: string]: VarType }; // vartype slug to VarType
    projTemplateMap: { [key: string]: ProjectTemplate };
    streamMap: { [key: string]: Stream }; // stream slug to stream
}

export class CacheService {
    private cloud: IOTileCloud;
    private $log: ng.ILogService;
    private fsLock: Mutex;

    private orgList: OrgMetaData[];
    private varTypeMap: { [key: string]: VarType };
    private projTemplateMap: { [key: string]: ProjectTemplate };

    private fs: FileSystemService;
    private net;
    private error: string;
    private serial: string;
    private user: UserService;
    private hasDevices: boolean;

    private activeProject: Project;

    constructor($log, IOTileCloud, User, FileSystemService, NetService) {
        this.$log = $log;
        this.cloud = IOTileCloud;
        this.fs = FileSystemService;
        this.net = NetService;

        // A unique serial number saved in all files so we can detect if anything is stale
        // from a previous sync.
        this.serial = guid();

        this.orgList = [];
        this.varTypeMap = {};
        this.projTemplateMap = {};
        this.hasDevices = false;
        this.error = null;
        this.activeProject = null;
        this.user = User;

        this.fsLock = new Mutex();

        // Kick off the cache loading process (this synchronously acquires the fsLock before being swapped out)
        // so any other function calls synchronized on fsLock will properly wait until loadFromDisk finishes.
        this.loadFromDisk();

        // Hook into user service so that we clear our data on login/logout
        this.user.addLoginHook((event: string) => this.clearAllData());
        this.user.addLogoutHook((event: string) => this.clearAllData());
    }

    /**
     * Return a list of organization names and the associated project names that they contain.
     */
    public async projectList(): Promise<OrgMetaData[]> {
        const releaseFS = await this.fsLock.acquire();

        try {
            return this.orgList;
        } finally {
            releaseFS();
        }
    }

    public async setActiveProject(id: string) {
        const releaseFS = await this.fsLock.acquire();

        try {
            await this.setActiveProjectUnsafe(id);
        } finally {
            releaseFS();
        }
    }

    public async getVariableType(slug: string): Promise<VarType> {
        const releaseFS = await this.fsLock.acquire();

        try {
            if (slug in this.varTypeMap) {
                const vartype = this.varTypeMap[slug];

                if (vartype) {
                    return vartype;
                }
            }

            throw new ArgumentError("Could not find variable type: " + slug);
        } finally {
            releaseFS();
        }
    }

    public async getProjectTemplate(slug: string): Promise<ProjectTemplate> {
        const releaseFS = await this.fsLock.acquire();

        try {
            if (slug in this.projTemplateMap) {
                const projTemplate = this.projTemplateMap[slug];

                if (projTemplate) {
                    return projTemplate;
                }
            }

            throw new ArgumentError("Could not find project template: " + slug);
        } finally {
            releaseFS();
        }
    }

    public async getActiveProject(): Promise<Project> {
        const releaseFS = await this.fsLock.acquire();

        try {
            return this.activeProject;
        } finally {
            releaseFS();
        }
    }

    public async noDevices(): Promise<boolean> {
        return !this.hasDevices;
    }

    /*
     * Download and update data for just one project.  The project will save saved
     * to disk as well as:
     * 1. The orgList metadata since that will need to contain a link for the project
     * 2. Our state
     * 3. Our vartype map
     */
    public async syncProject(projectID: string, progress?: ProgressNotifier) {
        if (!progress) {
            progress = new ProgressNotifier();
        }
        progress.setTotal(3);

        progress.startOne("Fetching Org Data", 1);
        const orgList = await this.cloud.fetchOrgMetaData(PROJECT_FILTER); // Get the complete org list
        progress.finishOne();
        progress.startOne("Fetching Project Data", 1);
        const cache = await this.fetchDataForProject(projectID, progress);
        progress.finishOne();
        const project = cache.projectMap[projectID];

        const releaseFS = await this.fsLock.acquire();
        try {
            progress.startOne("Updating Project Information", 1);
            await this.saveProjectUnsafe(project, this.serial);
            await this.saveCheckedJSONUnsafe(
                "meta/project_list.json",
                orgList,
                "1.0.0",
                this.serial
            );
            await this.saveVariableTypesUnsafe(cache.vartypeMap, this.serial);
            await this.saveProjectTemplatesUnsafe(
                cache.projTemplateMap,
                this.serial
            );

            this.orgList = orgList;
            this.varTypeMap = cache.vartypeMap;
            this.projTemplateMap = cache.projTemplateMap;

            if (this.activeProject !== null) {
                if (this.activeProject.id === project.id) {
                    this.activeProject = project;
                }
            }

            // If there is a device in this project, we know we have devices
            // so update our hasDevices flag.  We can't ever set it false here
            // because we don't know if another project has devices or not.
            if (Object.keys(cache.deviceMap).length > 0) {
                this.hasDevices = true;
            }

            await this.saveStateUnsafe();
            progress.finishOne();
        } catch (err) {
            this.$log.warn(
                "[CacheService] Error synchronizing one project.  ID:" +
                    projectID,
                err
            );
            throw err;
        } finally {
            releaseFS();
        }
    }

    public async syncCache(progress?: ProgressNotifier) {
        if (!angular.isDefined(progress)) {
            progress = new ProgressNotifier();
        }

        const startTime = performance.now();
        const cache = await this.fetchData(progress);
        const orgList = this.buildOrgList(cache.projectMap, cache.orgMap);

        const releaseFS = await this.fsLock.acquire();
        try {
            const guidString = guid();

            const t0 = performance.now();
            await this.clearSavedDataUnsafe();
            const t1 = performance.now();

            await this.saveCheckedJSONUnsafe(
                "meta/project_list.json",
                orgList,
                "1.0.0",
                guidString
            );
            const t2 = performance.now();

            // Don't save any overlay information since we know there can't be any.  We cleared
            // any potential overlays in the above call to clearSavedDataUnsafe.  This shaves
            // about ~0.5 to 1s off the sync time for a large 35 project data set.
            await this.saveProjectsUnsafe(cache.projectMap, guidString);
            const t3 = performance.now();

            await this.saveVariableTypesUnsafe(cache.vartypeMap, guidString);
            const t4 = performance.now();

            await this.saveProjectTemplatesUnsafe(
                cache.projTemplateMap,
                guidString
            );
            const t5 = performance.now();

            this.orgList = orgList;
            this.varTypeMap = cache.vartypeMap;
            this.projTemplateMap = cache.projTemplateMap;
            this.serial = guidString;
            this.hasDevices = Object.keys(cache.deviceMap).length > 0;

            // See if our old active project is still in the list of projects we now have
            if (this.activeProject !== null) {
                if (!this.findProjectUnsafe(this.activeProject.id)) {
                    this.activeProject = null;
                }
            }

            await this.saveStateUnsafe();
            const t6 = performance.now();

            this.$log.debug(
                "[CacheService] Time to clear old data: " +
                    (t1 - t0) / 1000.0 +
                    "s"
            );
            this.$log.debug(
                "[CacheService] Time to save project list: " +
                    (t2 - t1) / 1000.0 +
                    "s"
            );
            this.$log.debug(
                "[CacheService] Time to save project data: " +
                    (t3 - t2) / 1000.0 +
                    "s"
            );
            this.$log.debug(
                "[CacheService] Time to save variable type map: " +
                    (t4 - t3) / 1000.0 +
                    "s"
            );
            this.$log.debug(
                "[CacheService] Time to save project template map: " +
                    (t5 - t4) / 1000.0 +
                    "s"
            );
            this.$log.debug(
                "[CacheService] Time to save state: " + (t6 - t5) / 1000.0 + "s"
            );
        } catch (err) {
            progress.fatalError("Error saving data to phone's memory");
            this.$log.warn("[CacheService] Error updating cache.", err);
            throw err;
        } finally {
            const endTime = performance.now();
            this.$log.info(
                "[CacheService] Total time to update cache: " +
                    (endTime - startTime) / 1000.0 +
                    "s"
            );

            releaseFS();
        }
    }

    public async updateActiveProject(
        overlay: ProjectOverlay,
        writeThrough: boolean
    ) {
        const releaseFS = await this.fsLock.acquire();

        try {
            if (this.activeProject === null) {
                throw new DataCorruptedError(
                    "There is no active project in updateActiveProject"
                );
            }

            if (writeThrough) {
                this.activeProject.applyOverlay(overlay);
            } else {
                this.activeProject.overlay.merge(overlay);
                this.$log.debug(
                    "[CacheService] Updated overlay object (diff and merged)",
                    overlay,
                    this.activeProject.overlay
                );
            }

            // In both cases prune unneeded overlay contents before saving. In the writeThrough case, these could be
            // conflicted updates from past overlays or already applied updates
            // In the local case, we could have gone back to a previous setting that is no longer a modification of the cloud
            this.activeProject.overlay.prune(this.activeProject);
            await this.saveProjectUnsafe(this.activeProject, this.serial);
        } finally {
            releaseFS();
        }
    }

    public async clearAllData() {
        const releaseFS = await this.fsLock.acquire();

        try {
            this.clearSavedDataUnsafe();
            this.activeProject = null;
            this.orgList = [];
            this.hasDevices = false;
            this.varTypeMap = {};
            this.projTemplateMap = {};
        } finally {
            releaseFS();
        }
    }

    private findProjectUnsafe(id: string): boolean {
        for (const org of this.orgList) {
            for (const proj of org.projects) {
                if (proj.id === id) {
                    return true;
                }
            }
        }

        return false;
    }

    private async setActiveProjectUnsafe(id: string) {
        // Make sure the active project is in our list of known projects
        if (!this.findProjectUnsafe(id)) {
            throw new ArgumentError("Could not find project by id: " + id);
        }

        this.activeProject = await this.loadProjectUnsafe(id, this.serial);

        await this.saveStateUnsafe();
    }

    private async fetchDataForProject(
        projectID: string,
        progress: ProgressNotifier
    ): Promise<CloudCache> {
        const t0 = performance.now();

        // FIXME: We don't need to fetch vartype here but that would require refactoring buildCache logic
        // to make vartype optional
        const orgPromise = this.cloud.fetchOrgs();
        const projPromise = this.cloud.fetchProject(projectID);
        const devPromise = this.cloud.fetchProjectDevices(
            projectID,
            DEVICE_FILTER
        );
        const streamPromise = this.cloud.fetchProjectStreams(
            projectID,
            STREAM_FILTER
        );
        const varPromise = this.cloud.fetchProjectVariables(projectID);
        const vartypePromise = this.cloud.fetchAllVarTypes();
        const projTemplatePromise = this.cloud.fetchAllProjectTemplates();
        const sgPromise = this.cloud.fetchSensorGraphs();

        try {
            await Promise.all([
                sgPromise,
                orgPromise,
                projPromise,
                devPromise,
                streamPromise,
                varPromise,
                vartypePromise
            ]);
        } catch (err) {
            this.$log.error(
                "[CacheService] Error fetching cloud data for project: " +
                    projectID,
                err
            );

            // Make sure we don't get uncaught error in promise for the rest of the promises
            orgPromise.catch(err => {});
            projPromise.catch(err => {});
            projTemplatePromise.catch(err => {});
            vartypePromise.catch(err => {});
            varPromise.catch(err => {});
            sgPromise.catch(err => {});
            devPromise.catch(err => {});
            streamPromise.catch(err => {});
            throw err;
        }

        const t1 = performance.now();
        this.$log.info(
            "[CacheService] Fetch single project data time: " +
                (t1 - t0) / 1000 +
                " s"
        );

        const cloudData: CloudData = {
            orgs: await orgPromise,
            projects: [await projPromise],
            project_templates: await projTemplatePromise,
            devices: await devPromise,
            variables: await varPromise,
            vartypes: await vartypePromise,
            sensorgraphs: await sgPromise,
            streams: await streamPromise
        };

        const cache = this.buildCache(cloudData);

        // Reassemble the project from its normalized DB representation in the cloud
        let rejectedDevices: Device[] = [];
        for (const project of cloudData.projects) {
            rejectedDevices = rejectedDevices.concat(
                this.assembleProject(project, cloudData, cache)
            );
        }

        if (rejectedDevices.length > 0) {
            progress.addWarning(
                `The following devices were not configured properly and will not be visible in the app: ${rejectedDevices.map(
                    dev => dev.slug
                )}`
            );
        }

        return cache;
    }

    private async fetchData(progress: ProgressNotifier): Promise<CloudCache> {
        const t0 = performance.now();

        progress.setTotal(9);
        const orgPromise = this.cloud.fetchOrgs();
        const projPromise = this.cloud.fetchProjects(PROJECT_FILTER);
        const projTemplatePromise = this.cloud.fetchAllProjectTemplates();
        const devPromise = this.cloud.fetchAllDevices(DEVICE_FILTER);
        const streamPromise = this.cloud.fetchAllStreams(STREAM_FILTER);
        const varPromise = this.cloud.fetchAllVariables();
        const vartypePromise = this.cloud.fetchAllVarTypes();
        const sgPromise = this.cloud.fetchSensorGraphs();

        try {
            progress.startOne("Downloading Organizations", 1);
            await orgPromise;
            progress.finishOne();

            progress.startOne("Downloading Project Templates", 1);
            await projTemplatePromise;
            progress.finishOne();

            progress.startOne("Downloading Projects", 1);
            await projPromise;
            progress.finishOne();

            progress.startOne("Downloading Variable Types", 1);
            await vartypePromise;
            progress.finishOne();

            progress.startOne("Downloading Variables", 1);
            await varPromise;
            progress.finishOne();

            progress.startOne("Downloading SensorGraphs", 1);
            await sgPromise;
            progress.finishOne();

            progress.startOne("Downloading Devices", 1);
            await devPromise;
            progress.finishOne();

            progress.startOne("Downloading Streams", 1);
            await streamPromise;
            progress.finishOne();
        } catch (err) {
            this.$log.warn("[CacheService] Error fetching cloud data", err);
            progress.fatalError("Error downloading cloud data"); // FIXME: Replace this with a descriptive message

            // Ignore all of the other errors downloading data since we're just going to focus on the first one
            // If we don't do this, we'll get uncaught exception in promise errors for all of the other background
            // GET operations.
            orgPromise.catch(err => {});
            projTemplatePromise.catch(err => {});
            projPromise.catch(err => {});
            vartypePromise.catch(err => {});
            varPromise.catch(err => {});
            sgPromise.catch(err => {});
            devPromise.catch(err => {});
            streamPromise.catch(err => {});
            throw err;
        }

        const t1 = performance.now();
        this.$log.info(
            "[CacheService] Fetch cloud data time: " + (t1 - t0) / 1000 + " s"
        );

        const cloudData: CloudData = {
            orgs: await orgPromise,
            projects: await projPromise,
            project_templates: await projTemplatePromise,
            devices: await devPromise,
            variables: await varPromise,
            vartypes: await vartypePromise,
            sensorgraphs: await sgPromise,
            streams: await streamPromise
        };

        progress.startOne("Downloading Membership Roles", 1);
        // get user membership information for orgs
        const roles: { [key: string]: Membership } = {};
        const memPromises: Array<Promise<Membership>> = [];
        for (const org of cloudData.orgs) {
            const membership = this.cloud.fetchOrgMembership(org);
            memPromises.push(membership);
        }

        try {
            const memberships = await Promise.all(memPromises);
            let i = 0;
            for (const org of cloudData.orgs) {
                roles[org.slug] = memberships[i];
                i++;
            }
        } catch (err) {
            for (const promise of memPromises) {
                promise.catch(err => {});
            }
        }

        this.user.setRoles(roles);
        progress.finishOne();

        const cache = this.buildCache(cloudData);

        const t2 = performance.now();
        this.$log.info(
            "[CacheService] Build cache time: " + (t2 - t1) / 1000 + " s"
        );

        // Reassemble all of the projects from the normalized DB representation retrieved from the cloud
        let rejectedDevices: Device[] = [];
        for (const project of cloudData.projects) {
            rejectedDevices = rejectedDevices.concat(
                this.assembleProject(project, cloudData, cache)
            );
        }

        if (rejectedDevices.length > 0) {
            progress.addWarning(
                `The following devices were not configured properly and will not be visible in the app: ${rejectedDevices.map(
                    dev => dev.slug
                )}`
            );
        }

        const t3 = performance.now();
        this.$log.info(
            "[CacheService] Assembled " +
                cloudData.projects.length +
                " projects in: " +
                (t3 - t2) / 1000 +
                " s"
        );

        return cache;
    }

    private async loadOverlayUnsafe(
        projectID: string
    ): Promise<ProjectOverlay> {
        const overlayName = "projects/" + projectID + "-overlay.json";
        let overlayData: SerializedOverlay = {};

        if (await this.fs.checkFile(overlayName)) {
            try {
                overlayData = (await this.loadCheckedJSONUnsafe(
                    overlayName,
                    "1.0.0",
                    this.serial
                )) as SerializedOverlay;
                this.$log.debug(
                    "[CacheService] Raw overlay data for project",
                    overlayData
                );
            } catch (err) {
                this.$log.warn(
                    "[CacheService] Could not load overlay, removing",
                    err
                );

                try {
                    await this.fs.removeFile(overlayName);
                } catch (err) {
                    this.$log.error(
                        "[CacheService] Could not remove overlay after failing to load it."
                    );
                }
            }
        }

        return ProjectOverlay.Deserialize(overlayData, catCloud);
    }

    private async saveOverlayUnsafe(
        projectID: string,
        overlay: ProjectOverlay,
        guid: string
    ) {
        const overlayName = "projects/" + projectID + "-overlay.json";
        await this.saveCheckedJSONUnsafe(
            overlayName,
            overlay.serialize(),
            "1.0.0",
            guid
        );
    }

    private async removeOverlayUnsafe(projectID: string) {
        const overlayName = "projects/" + projectID + "-overlay.json";

        if (await this.fs.checkFile(overlayName)) {
            await this.fs.removeFile(overlayName);
        }
    }

    private async saveProjectsUnsafe(
        projects: { [key: string]: Project },
        guid: string
    ) {
        const promises = [];

        /**
         * Let the project saving run in parallel to speed it up.
         * Perf Data on Moto X 2nd gen:
         * - On a large organization with 31 projects:
         *   + with parallelization: 0.57s
         *   + without parallization: 1.6s
         */
        for (const id in projects) {
            const project = projects[id];

            const prom = this.saveProjectUnsafeParallel(project, guid);
            promises.push(prom);
        }

        await Promise.all(promises);
    }

    // NB. This function must only be called from saveProjectsUnsafe which is called from syncCache.
    // It does not attempt to update local overlays so it is only safe to use when you know the overlay
    // will not be present, like when you have just blown everything away and downloaded afresh from iotile.cloud
    private saveProjectUnsafeParallel(
        project: Project,
        guid: string
    ): Promise<void> {
        const serialized = project.serialize();
        const filePath = "projects/" + project.id + ".json";

        return this.saveCheckedJSONUnsafe(filePath, serialized, "1.0.0", guid);
    }

    private async saveProjectUnsafe(
        project: Project,
        guid: string,
        noOverlay?: boolean
    ): Promise<void> {
        const serialized = project.serialize();
        const filePath = "projects/" + project.id + ".json";

        if (!noOverlay) {
            if (!project.overlay.isEmpty()) {
                this.$log.info(
                    "[CacheService] Project had attached overlay data, saving overlay file."
                );
                await this.saveOverlayUnsafe(project.id, project.overlay, guid);
            } else {
                this.$log.info(
                    "[CacheService] Project had an empty overlay, removing any saved overlay data."
                );
                await this.removeOverlayUnsafe(project.id);
            }
        }

        return this.saveCheckedJSONUnsafe(filePath, serialized, "1.0.0", guid);
    }

    private async loadProjectUnsafe(
        id: string,
        expectedGUID: string
    ): Promise<Project> {
        const filePath = "projects/" + id + ".json";

        const data = await this.loadCheckedJSONUnsafe(
            filePath,
            "1.0.0",
            expectedGUID
        );
        const project = await Project.Unserialize(data);
        const overlay = await this.loadOverlayUnsafe(project.id);

        this.$log.debug("[CacheService] Loaded overlay", overlay);
        project.overlay.merge(overlay);
        return project;
    }

    private async clearSavedDataUnsafe() {
        this.$log.info("[CacheService] Clearing all saved data.");
        await this.fs.removeFilesInDirectory("projects");
        await this.fs.removeFilesInDirectory("meta");
    }

    /*
     * Build a list of projects grouped by organization with just a name and slug
     * for both the orgs and the projects.  This is useful for showing the project
     * list page.
     */
    private buildOrgList(
        projectMap: { [key: string]: Project },
        cloudOrgMap: { [key: string]: Org }
    ): OrgMetaData[] {
        const orgMap: { [key: string]: OrgMetaData } = {};

        for (const orgSlug in cloudOrgMap) {
            orgMap[orgSlug] = {
                name: cloudOrgMap[orgSlug].name,
                slug: orgSlug,
                projects: []
            };
        }

        for (const projectID in projectMap) {
            const project = projectMap[projectID];
            const orgSlug = project.orgSlug;

            if (!(orgSlug in orgMap)) {
                this.$log.warn(
                    "[CacheService] Found project that was not in any org, dropping",
                    project
                );
                continue;
            }

            orgMap[orgSlug].projects.push({
                name: project.name,
                id: project.id
            });
        }

        const orgList = [];
        for (const orgSlug in orgMap) {
            orgList.push(orgMap[orgSlug]);
        }

        return orgList;
    }

    private buildCache(data: CloudData): CloudCache {
        const cache: CloudCache = {
            deviceMap: {},
            orgMap: {},
            projectMap: {},
            sgMap: {},
            varMap: {},
            vartypeMap: {},
            projTemplateMap: {},
            streamMap: {}
        };

        /* tslint:disable:prefer-for-of*/

        // Cache devices
        for (let i = 0; i < data.devices.length; ++i) {
            cache.deviceMap[data.devices[i].slug] = data.devices[i];
        }

        // Cache orgs
        for (let i = 0; i < data.orgs.length; ++i) {
            cache.orgMap[data.orgs[i].slug] = data.orgs[i];
        }

        // Cache projects
        for (let i = 0; i < data.projects.length; ++i) {
            cache.projectMap[data.projects[i].id] = data.projects[i];
        }

        // Cache SensorGraphs
        for (let i = 0; i < data.sensorgraphs.length; ++i) {
            cache.sgMap[data.sensorgraphs[i].slug] = data.sensorgraphs[i];
        }

        // Cache Variables
        for (let i = 0; i < data.variables.length; ++i) {
            cache.varMap[data.variables[i].slug] = data.variables[i];
        }

        // Cache Vartypes
        for (let i = 0; i < data.vartypes.length; ++i) {
            cache.vartypeMap[data.vartypes[i].slug] = data.vartypes[i];
        }

        // Cache ProjectTemplates
        for (let i = 0; i < data.project_templates.length; ++i) {
            cache.projTemplateMap[data.project_templates[i].slug] =
                data.project_templates[i];
        }

        // Cache streams
        for (let i = 0; i < data.streams.length; ++i) {
            cache.streamMap[data.streams[i].slug] = data.streams[i];
        }

        return cache;
    }

    private assembleProject(
        project: Project,
        data: CloudData,
        cache: CloudCache
    ): Device[] {
        const rejectedDevices: Device[] = [];
        project.addDevices(
            data.devices.filter(dev => {
                if (dev.project === project.id && !dev.sensorGraphSlug) {
                    this.$log.error(`Device missing sensorgraph: ${dev.slug}`);
                    rejectedDevices.push(dev);
                    return false;
                }
                return dev.project === project.id;
            })
        );
        project.addVariables(
            data.variables.filter(variable => variable.project === project.id)
        ); // NB Variables have project variable be the *id*
        project.addStreams(
            data.streams.filter(stream => stream.project === project.slug)
        ); // NB: Streams have project variable be the *slug*
        project.org = cache.orgMap[project.orgSlug];
        project.addProjectTemplates(data.project_templates);
        const sgSlugs = project.getSensorGraphSlugs();

        for (const slug of sgSlugs) {
            const sg = cache.sgMap[slug];
            if (!sg) {
                const rejectedDevice = project.removeDevice(
                    project.devices.find(dev => dev.sensorGraphSlug === slug)
                        .slug
                );
                this.$log.error(
                    `Cannot find SensorGraph "${slug}" for device: ${
                        rejectedDevice.slug
                    }`
                );
                rejectedDevices.push(rejectedDevice);
            } else {
                project.addSensorGraph(cache.sgMap[slug]);
            }
        }

        return rejectedDevices;
    }

    private async loadFromDisk() {
        const t0 = performance.now();

        const releaseFS = await this.fsLock.acquire();

        try {
            // Do no work until we make sure a user is logged in
            await this.user.initialized;

            this.$log.info("[CacheService] Starting to load cache from disk.");

            await this.prepareDirectoriesUnsafe();
            await this.loadStateUnsafe();

            this.varTypeMap = await this.loadVariableTypesUnsafe();
            this.projTemplateMap = await this.loadProjectTemplatesUnsafe();

            const orgList = await this.loadCheckedJSONUnsafe(
                "meta/project_list.json",
                "1.0.0",
                this.serial
            );
            this.orgList = orgList as OrgMetaData[];
        } catch (err) {
            // If ther is any issue loading data, blow it all away but depending on the error
            // it may or may not be an error that needs to be logged.
            if (
                err instanceof UnknownFileSystemError &&
                err.code === FileSystemError.NOT_FOUND_ERR
            ) {
                // No nothing
            } else {
                this.$log.error(
                    "[CacheService] Error loading cached data from file system",
                    err
                );
            }

            await this.clearSavedDataUnsafe();
        } finally {
            releaseFS();
        }
    }

    private async saveVariableTypesUnsafe(
        vartypes: { [key: string]: VarType },
        serial: string
    ) {
        const serialized = {};

        for (const key in vartypes) {
            serialized[key] = vartypes[key].toJson();
        }

        await this.saveCheckedJSONUnsafe(
            "meta/variable_types.json",
            serialized,
            "1.0.0",
            serial
        );
    }

    private async loadVariableTypesUnsafe(): Promise<{
        [key: string]: VarType;
    }> {
        const data = await this.loadCheckedJSONUnsafe(
            "meta/variable_types.json",
            "1.0.0",
            this.serial
        );
        const vartypeMap: { [key: string]: VarType } = {};

        for (const key in data) {
            const vartype = data[key];
            vartypeMap[key] = new VarType(vartype);
        }

        return vartypeMap;
    }

    private async saveProjectTemplatesUnsafe(
        projTemplates: { [key: string]: ProjectTemplate },
        serial: string
    ) {
        const serialized = {};

        for (const key in projTemplates) {
            serialized[key] = projTemplates[key].toJson();
        }

        await this.saveCheckedJSONUnsafe(
            "meta/project_templates.json",
            serialized,
            "1.0.0",
            serial
        );
    }

    private async loadProjectTemplatesUnsafe(): Promise<{
        [key: string]: ProjectTemplate;
    }> {
        const data = await this.loadCheckedJSONUnsafe(
            "meta/project_templates.json",
            "1.0.0",
            this.serial
        );
        const projTempMap: { [key: string]: ProjectTemplate } = {};

        for (const key in data) {
            const projTemp = data[key];
            projTempMap[key] = new ProjectTemplate(projTemp);
        }

        return projTempMap;
    }

    private async saveStateUnsafe() {
        let id = null;

        if (this.activeProject !== null) {
            id = this.activeProject.id;
        }

        const state = {
            serial: this.serial,
            activeProjectID: id,
            hasDevices: this.hasDevices
        };

        await this.saveCheckedJSONUnsafe(
            "meta/cache_state.json",
            state,
            "1.2.0",
            this.serial
        );
    }

    private async loadStateUnsafe() {
        const state: any = await this.loadCheckedJSONUnsafe(
            "meta/cache_state.json",
            "1.2.0"
        );

        if (
            !("serial" in state) ||
            !("activeProjectID" in state) ||
            !("hasDevices" in state)
        ) {
            throw new DataCorruptedError(
                "Invalid state information saved in cache_state.json"
            );
        }

        this.serial = state.serial;

        // If we have a saved active project, load that in to memory
        this.activeProject = null;
        this.hasDevices = state.hasDevices;

        if (state.activeProjectID !== null) {
            this.activeProject = await this.loadProjectUnsafe(
                state.activeProjectID,
                this.serial
            );
        }
    }

    private async prepareDirectoriesUnsafe() {
        try {
            if (!(await this.fs.checkDirectory("projects"))) {
                await this.fs.createDirectory("projects");
            }

            if (!(await this.fs.checkDirectory("meta"))) {
                await this.fs.createDirectory("meta");
            }
        } catch (err) {
            this.error =
                "Could not check or create directories: " + err.message;
            this.$log.error(
                "[CacheService] Could not check or create projects directory",
                err
            );

            throw err;
        }
    }

    private async loadCheckedJSONUnsafe(
        path: string,
        expectedVersion: string,
        expectedSerial?: string
    ): Promise<{}> {
        const obj: any = await this.fs.readJSONFile(path);

        if (!("version" in obj)) {
            throw new DataCorruptedError(
                "File " + path + " did not have a version key."
            );
        }

        if (!("serial" in obj)) {
            throw new DataCorruptedError(
                "File " + path + " did not have a serial key."
            );
        }

        if (!("data" in obj)) {
            throw new DataCorruptedError(
                "File " + path + " did not have a data key."
            );
        }

        const version = obj.version;
        const serial = obj.serial;

        if (
            version !== expectedVersion ||
            (expectedSerial && serial !== expectedSerial)
        ) {
            throw new DataStaleError(
                "File " +
                    path +
                    " was stale, version: " +
                    version +
                    " serial: " +
                    serial
            );
        }

        return obj.data;
    }

    private async saveCheckedJSONUnsafe(
        path: string,
        data: {},
        version: string,
        serial: string
    ) {
        const savedObj = {
            data,
            version,
            serial
        };

        await this.fs.writeJSONFile(path, savedObj);
    }
}

angular.module("iotile.app").service("CacheService", CacheService);
