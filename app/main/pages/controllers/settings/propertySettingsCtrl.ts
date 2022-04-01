import {
    IOTileCloud,
    Project,
    Property,
    PropertyTemplate
} from "@iotile/iotile-cloud";
import { ControllerBase } from "@iotile/iotile-common";
import angular = require("angular");
import { CacheService, RobustReportService, UIService } from "ng-iotile-app";

export class PropertySettingsController extends ControllerBase {
    public deviceSlug: string;
    public project: Project;
    public propertyTemplates: PropertyTemplate[];
    public properties: Property[];

    private cache: CacheService;
    private state;
    private User;
    private ui: UIService;
    private cloud: IOTileCloud;

    constructor(
        $scope,
        $stateParams,
        $state,
        $ionicHistory,
        User,
        UIService,
        CacheService,
        $injector,
        IOTileCloud,
        NetService
    ) {
        super("propertySettingsController", $injector, $scope);
        this.cache = CacheService;
        this.deviceSlug = $stateParams.deviceId;
        this.state = $state;
        this.User = User;
        this.ui = UIService;
        this.cloud = IOTileCloud;
        this.net = NetService;

        this.project = null;
        this.propertyTemplates = [];
        this.properties = [];
    }

    protected async initialize() {
        try {
            if (this.net && this.net.isOnline()) {
                this.project = await this.cache.getActiveProject();
                if (this.project == null) {
                    this.setError(
                        "Error: no active project, please restart the app."
                    );
                    return;
                }

                // TODO : this probably shouldn't pull all property templates here
                // when should we grab/ how to store them?
                // let templates = await this.cloud.fetchAllPropertyTemplates();
                // for (let template of templates){
                //     if (template.org == this.project.orgSlug) {
                //         this.propertyTemplates[template.name] = template;
                //     }
                // }

                const properties = await this.cloud.fetchProperties(
                    this.deviceSlug
                );
                this.properties = properties;
                this.$scope.$apply();
                // What's the right relationship (device props v. org templates) here?
                // TODO: right ordering

                // for (let property of properties){
                //     if (property.name in this.propertyTemplates){
                //         this.properties.push(property);
                //     }
                // }
            } else {
                this.log_warn(
                    "Could not access device property settings: offline"
                );
                this.setError(
                    "Network service unavailable - must be online to view Device Properties"
                );
            }
        } catch (err) {
            this.setError(
                "Network service unavailable - must be online to view Device Properties"
            );
            this.log_warn("Could not access device property settings ", err);
        }
    }
}

angular
    .module("main")
    .controller("propertySettingsCtrl", PropertySettingsController as any);
