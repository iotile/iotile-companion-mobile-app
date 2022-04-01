import {
    DisplayWidget,
    MockCloud,
    Project,
    ProjectTemplate,
    VarType
} from "@iotile/iotile-cloud";
import {
    ArgumentError,
    ControllerBase,
    deviceIDToSlug,
    WidgetBase,
    WidgetChannel
} from "@iotile/iotile-common";
import {
    BasicNotificationService,
    IOTileAdapter,
    MockBleService,
    Platform,
    setupMockBLE
} from "@iotile/iotile-device";
import * as IOTileAppModule from "ng-iotile-app";
import { MockIOTileAdapter } from "./mock-adapter";
import { MockCacheService } from "./mock-cache";
import {
    DeviceConfigHook,
    MockIOTileDevice,
    MockIOTileDeviceConfig
} from "./mock-device";
import { MockGeolocationService } from "./mock-geolocation-serv";
import { MockIonicModal } from "./mock-modal";
import { MockNetService } from "./mock-net";
import { MockPOD1M, MockPOD1MDeviceConfig, TILE_STATE } from "./mock-pod1m";
import { MockReportService } from "./mock-report-serv";
import { MockUIService } from "./mock-ui";
import { MockUserService } from "./mock-user";

export {
    MockNetService,
    MockCloud,
    MockReportService,
    MockCacheService,
    MockUIService,
    MockUserService,
    MockIonicModal
};

import { getProject } from "./projects/mock-projects";
import { ProjectGenerator } from "./projects/project-generator";

import angular = require("angular");
// tslint:disable-next-line
require("angular-mocks/ngMock");

interface ProjectSpec {
    devices: number;
    sensorgraphs: string[];
    proj_gid?: string;
}

export class StandardJig {
    public static DefaultDeviceConfig: MockIOTileDeviceConfig = {
        DOWNLOAD_STREAM: {},
        DEVICE_TIME: {
            isUTC: true,
            isSynchronized: true,
            currentTime: new Date()
        }
    };

    public static DefaultPOD1MConfig: MockPOD1MDeviceConfig = {
        ...StandardJig.DefaultDeviceConfig,

        ACCEL_STATUS: {
            tile_state: TILE_STATE.capturing,
            streaming: false,
            recording: false,
            settled: true
        }
    };

    public static DefaultConfig = {
        BUILD: {
            VERSION: "1.1.0"
        },

        ENV: {
            BACKGROUND_CACHE_SYNC: false,
            SERVER_URL: "https://iotile.cloud/api/v1"
        },

        FS: {
            MOCK_FS: true
        }
    };

    public FileSystemService: IOTileAppModule.FileSystemService;
    public MockFilePlugin: IOTileAppModule.MockCordovaFile;
    public cache: IOTileAppModule.CacheService;
    public NetService: MockNetService;
    public Geolocation: MockGeolocationService;
    public adapter: IOTileAdapter;
    public cloud: MockCloud;
    public $rootScope: ng.IRootScopeService;
    public $controller: ng.IControllerService;
    public $componentController: ng.IComponentControllerService;
    public MockReportService: MockReportService;
    public MockCacheService: MockCacheService;
    public MockBleService: MockBleService;
    public config: any;
    public $compile: ng.ICompileService;
    public $injector;

    public $stateParams: {};

    private manual: boolean;
    private getMockReports: boolean;
    private getMockCache: boolean;
    private getMockBleService: boolean;

    private services: any[];
    private modules: any[];

    private deviceConfigHook: DeviceConfigHook;

    constructor(manual: boolean = false, config: {} = null) {
        if (config == null) {
            config = StandardJig.DefaultConfig;
        }

        this.deviceConfigHook = {};

        this.getMockReports = false;
        this.getMockCache = false;
        this.getMockBleService = false;

        this.manual = manual;
        this.config = config;
        this.services = [];
        this.modules = [];
        this.$stateParams = {};

        // Add in our default mocks
        this.services.push(["NetService", MockNetService]);
        this.services.push(["UIService", MockUIService]);
        this.services.push(["Geolocation", MockGeolocationService]);

        beforeEach(() => this.prepareJig());
    }

    public mockModule(name: string, alsoDefine?: string[]) {
        this.modules.push([name, alsoDefine]);
    }

    public mockReportService() {
        this.getMockReports = true;
        this.services.push(["RobustReportService", MockReportService]);
    }

    public mockUserService() {
        this.services.push(["User", MockUserService]);
    }

    public mockBleService() {
        this.getMockBleService = true;
    }

    public mockCacheService(loadData?: string | ProjectSpec) {
        this.getMockCache = true;
        this.services.push(["CacheService", MockCacheService]);

        if (loadData != null) {
            if (typeof loadData === "string") {
                const that = this;

                beforeEach(() => {
                    const data = getProject(loadData);
                    that.MockCacheService.mockLoadProjects(data.projects);
                    that.MockCacheService.activeProject = data.projects[0];
                    that.MockCacheService.mockLoadVartypes(data.vartypes);
                    that.MockCacheService.mockLoadProjectTemplates(
                        data.project_templates
                    );
                });
            } else {
                const that = this;

                beforeEach(() => {
                    let generator: ProjectGenerator;

                    generator = new ProjectGenerator(null, loadData.proj_gid);

                    for (let i = 0; i < loadData.devices; i++) {
                        generator.addDevice(i + 1, loadData.sensorgraphs[i]);
                    }
                    const vartypes: VarType[] = [];
                    for (const key in generator.variableTypes) {
                        vartypes.push(generator.variableTypes[key]);
                    }

                    const project_templates: ProjectTemplate[] = [];
                    for (const key in generator.projectTemplates) {
                        project_templates.push(generator.projectTemplates[key]);
                    }

                    const data = generator.getProject();

                    that.MockCacheService.mockLoadProjects([data]);
                    that.MockCacheService.activeProject = data;
                    that.MockCacheService.mockLoadVartypes(vartypes);
                    that.MockCacheService.mockLoadProjectTemplates(
                        project_templates
                    );
                });
            }
        }
    }

    public mockIonicUI() {
        const $ionicModal = this.$injector.get("$ionicModal");
        spyOn($ionicModal, "fromTemplateUrl").and.returnValue(
            Promise.resolve(new MockIonicModal())
        );
    }

    public mockControllerUI(controller: ControllerBase) {
        spyOn(controller as any, "showLoadingEx").and.returnValue(
            Promise.resolve()
        );
        spyOn(controller as any, "hideLoading").and.returnValue(
            Promise.resolve()
        );
    }

    public mockWidgetChannel(): WidgetChannel {
        const channel = jasmine.createSpyObj("channel", [
            "bindMethod",
            "bindCallback",
            "getStreamID",
            "getUnits",
            "callRPC"
        ]);

        return channel;
    }

    public prepareJig() {
        const that = this;
        const notification = new BasicNotificationService();

        setupMockBLE(that.config);

        angular.mock.module("iotile.app", function($provide) {
            $provide.constant("Config", that.config);

            for (const arg of that.services) {
                $provide.service(...arg);
            }

            $provide.constant("$stateParams", that.$stateParams);
        });

        angular.mock.module("iotile.cloud");

        angular.mock.module("iotile.device", function($provide) {
            $provide.constant("Config", that.config);
            $provide.constant("notificationService", notification);
            $provide.constant("platform", Platform.Android);
            $provide.constant("deviceConfigHook", that.deviceConfigHook);

            $provide.service("IOTileAdapter", [
                "Config",
                "notificationService",
                "platform",
                "deviceConfigHook",
                MockIOTileAdapter as any
            ]);
            $provide.value("POD1M", function(
                device: MockIOTileDevice,
                adapter: MockIOTileAdapter
            ) {
                return new MockPOD1M(device, adapter);
            });
        });

        for (const mod of this.modules) {
            const moduleName = mod[0];
            const defines = mod[1];

            if (defines != null) {
                angular.module(moduleName, defines);
            }

            angular.mock.module(moduleName, function($provide) {
                $provide.constant("Config", that.config);

                for (const arg of that.services) {
                    $provide.service(...arg);
                }
            });
        }

        inject(function(
            _$injector_,
            _$compile_,
            _FileSystemService_,
            _$rootScope_,
            _NetService_,
            _Geolocation_,
            _MockCordovaFile_,
            _IOTileAdapter_,
            _IOTileCloud_,
            _CacheService_,
            _$controller_,
            _$componentController_
        ) {
            that.FileSystemService = _FileSystemService_;
            that.$injector = _$injector_;
            that.$rootScope = _$rootScope_;
            that.cache = _CacheService_;
            that.MockFilePlugin = _MockCordovaFile_;
            that.NetService = _NetService_;
            that.Geolocation = _Geolocation_;
            that.$controller = _$controller_;
            that.$componentController = _$componentController_;
            that.adapter = _IOTileAdapter_;
            that.cloud = new MockCloud(_IOTileCloud_);
            that.$compile = _$compile_;
        });

        if (this.getMockReports) {
            this.MockReportService = this.$injector.get("RobustReportService");
        }

        if (this.getMockCache) {
            this.MockCacheService = this.$injector.get("CacheService");
        }

        if (this.getMockBleService) {
            this.MockBleService = this.adapter.mockBLEService;
        }

        this.MockFilePlugin.clear("/");

        if (!this.manual) {
            this.cloud.defaultSetup();
        }
    }

    /*
    Add a virtual BLE device to the MockBLEService
    NB: You need to add the device to a project separately - this is only the BLE connection
    returns: the device slug that corresponds to the BLE device
    */
    public add_virtual_device(index: number, type: string, args: any): string {
        if (!this.config.BLE) {
            setupMockBLE(this.config);
        }
        this.config.BLE.MOCK_BLE_DEVICES[index.toString()] = {
            type,
            args
        };
        return deviceIDToSlug(index);
    }

    public async directive_it(
        label: string,
        elementString: string,
        callable: (element, scope) => Promise<void>
    ) {
        const that = this;
        this.async_it(label, async function() {
            const parent = that.$rootScope.$new();
            const element = that.$compile(elementString)(parent);
            parent.$digest();

            const scope = element.isolateScope();
            await callable(element, scope);
        });
    }

    public async async_it(label: string, callable: () => Promise<any>) {
        const that = this;
        it(label, async function(done) {
            let fail = null;

            try {
                await callable();
            } catch (err) {
                fail = err;
            } finally {
                await that.cleanup();

                if (fail) {
                    done.fail(fail);
                } else {
                    done();
                }
            }
        });
    }

    public async modal_it(
        label: string,
        modalType: any,
        args: any[],
        testCallable: (modal) => Promise<any>
    ) {
        const that = this;

        this.async_it(label, async function() {
            that.mockIonicUI();

            const modalInstance = new modalType(that.$injector, ...args);
            that.mockControllerUI(modalInstance);
            await that.cache.syncCache();

            await testCallable(modalInstance);
        });
    }

    public async createController(
        controllerName: string,
        initialize: boolean,
        $stateParams?: any
    ): Promise<[ControllerBase, ng.IScope]> {
        const scope = this.$rootScope.$new();

        angular.copy($stateParams, this.$stateParams);
        const controller = this.$controller(controllerName, {
            $scope: scope
        });

        if (!(controller instanceof ControllerBase)) {
            throw new ArgumentError(
                "Standard test jig requires that your controller inherit from ControllerBase"
            );
        }

        // We need to mock any blocking UI function so that the test can run to completion
        this.mockControllerUI(controller);

        if (initialize) {
            scope.$broadcast("$ionicView.beforeEnter");
            await controller.initialized;
        }

        return [controller, scope];
    }

    public async createWidget(
        widgetName: string,
        args: DisplayWidget,
        initialize: boolean
    ): Promise<[WidgetBase, WidgetChannel]> {
        const scope = this.$rootScope.$new();
        const channel = this.mockWidgetChannel();
        let widget: WidgetBase;

        widget = this.$componentController(
            widgetName,
            {
                $scope: scope
            },
            { widget: args, channel }
        );

        if (!(widget instanceof WidgetBase)) {
            throw new ArgumentError(
                "Standard test jig requires that your widget inherit from WidgetBase"
            );
        }

        if (initialize) {
            widget.$onInit();
            await widget.initialized;
        }

        return [widget, channel];
    }

    public async prepareStandardCache(projectID: string) {
        await this.cache.syncCache();
        await this.cache.setActiveProject(projectID);
    }

    public async controller_it(
        label: string,
        controllerName: string,
        callable: (controller, scope) => Promise<any>,
        $stateParams = {}
    ) {
        const that = this;
        this.async_it(label, async () => {
            await that.testController(controllerName, callable, $stateParams);
        });
    }

    public async widget_it(
        label: string,
        widgetName: string,
        args: DisplayWidget,
        testFunction: (
            widget: WidgetBase,
            channel: WidgetChannel
        ) => Promise<void>
    ) {
        const that = this;

        this.async_it(label, async () => {
            await that.testWidget(widgetName, args, testFunction);
        });
    }

    public async device_it(
        label: string,
        controllerName: string,
        slug: string,
        activeProject: string,
        callable: (controller, scope) => Promise<any>
    ) {
        const that = this;
        this.async_it(label, async () => {
            await that.adapter.scan(0);
            await that.testController(controllerName, callable, {
                deviceId: slug
            });
        });
    }

    public async device_configure_it(
        label: string,
        controllerName: string,
        slug: string,
        mockDeviceConfig: MockIOTileDeviceConfig,
        callable: (controller, scope) => Promise<any>
    ) {
        const that = this;
        this.async_it(label, async () => {
            that.deviceConfigHook.setConfig(mockDeviceConfig);
            await that.adapter.scan(0);
            await that.testController(controllerName, callable, {
                deviceId: slug,
                mockDeviceConfig
            });
        });
    }

    private async testController(
        controllerName: string,
        testCallable: (controller, scope) => Promise<any>,
        $stateParams
    ) {
        const [controller, scope] = await this.createController(
            controllerName,
            true,
            $stateParams
        );

        // Now run the actual test
        await testCallable(controller, scope);
    }

    private async testWidget(
        widgetName: string,
        args: any,
        testFunction: (
            widget: WidgetBase,
            channel: WidgetChannel
        ) => Promise<void>
    ) {
        const [widget, channel] = await this.createWidget(
            widgetName,
            args,
            true
        );

        // Now run the actual test
        await testFunction(widget, channel);
    }

    private async cleanup() {
        await this.cache.getActiveProject(); // Make sure we have finished loading everything from disk and making folders
    }
}
