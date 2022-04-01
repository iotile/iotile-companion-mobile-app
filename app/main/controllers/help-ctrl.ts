import { ControllerBase, UISeverity } from "@iotile/iotile-common";
import angular = require("angular");
import { CacheService, UIService, UserService } from "ng-iotile-app";

/**
 * @ngdoc controller
 * @name main.controller:HelpController
 */
class HelpController extends ControllerBase {
    public isStaff: boolean;
    public name: string;
    public version: string;

    private $state;
    private _uIService: UIService;
    private _robustReportService;
    private _cache: CacheService;

    constructor(
        Config,
        User: UserService,
        UIService,
        $state,
        $injector,
        $scope,
        RobustReportService,
        CacheService: CacheService
    ) {
        super("HelpController", $injector, $scope);
        this._uIService = UIService;
        this._robustReportService = RobustReportService;
        this._cache = CacheService;

        this.isStaff = User.isStaff();
        this.log_info("isStaff = " + this.isStaff);
        this.$state = $state;

        this.name = Config.ENV.NAME;
        this.version = "v" + Config.BUILD.VERSION || "0.0";
    }

    public onViewLogs(): void {
        this.$state.go("main.view-logs");
    }

    public async onFAQ() {
        try {
            this.openExternal("https://help.archsys.io");
        } catch (err) {
            this.setError("Error opening external link.");
        }
    }

    public async onClearData() {
        await this.showLoading("Clearing Local Data");

        try {
            const t0 = Date.now();

            await this._cache.clearAllData();

            const t1 = Date.now();
            this.log_info(
                "Time to erase cache: " + (t1 - t0) / 1000 + " seconds"
            );

            await this._robustReportService.deleteAllReports();

            await this.hideLoading();
            await this._uIService.alert(
                "Success!",
                "All local data cleared",
                UISeverity.Success
            );
        } catch (err) {
            await this.hideLoading();
            await this._uIService.alert("Error!", err, UISeverity.Error);
        } finally {
            await this.hideLoading();
        }
    }
}

angular.module("main").controller("HelpController", HelpController as any);
