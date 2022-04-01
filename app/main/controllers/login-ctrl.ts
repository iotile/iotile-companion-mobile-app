import { IOTileCloud, ServerInformation } from "@iotile/iotile-cloud";
import { ControllerBase } from "@iotile/iotile-common";
import angular = require("angular");
import { UserService } from "ng-iotile-app";
import { SelectServerModal } from "./modals/select-server-modal";

interface LoginDetails {
    email: string;
    password: string;
}

export class LoginController extends ControllerBase {
    public name: string;
    public version: string;
    public passreset: boolean;
    public user: LoginDetails;

    protected User: UserService;
    protected $state;
    private cloud: IOTileCloud;

    constructor($injector, $scope, User, $state, Config, IOTileCloud) {
        super("LoginController", $injector, $scope);

        this.name = Config.ENV.NAME;
        this.version = Config.BUILD.VERSION;
        this.passreset = false;
        this.user = { email: "", password: "" };
        this.User = User;
        this.cloud = IOTileCloud;
        this.$state = $state;
    }

    public onSignup() {
        this.$state.go("register");
    }

    public async onResetPassword() {
        try {
            await this.openExternal(
                "https://iotile.cloud/account/password/reset/"
            );
        } catch (err) {
            this.log_error("Error opening password reset link", err);
            this.setError("Error opening external link");
        }
    }

    public async selectServerModal(): Promise<ServerInformation> {
        const selectModal = new SelectServerModal(this.$injector);

        try {
            return await selectModal.run(this.cloud.serverList());
        } catch (err) {
            this.log_error("Error showing select server modal", err);
            this.setError("Error selecting server. Please try again.");
        }
    }

    public async onLogin(loginForm) {
        // Fix offset screen bug on iOS 12
        // https://github.com/apache/cordova-ios/issues/417
        // https://github.com/iotile/iotile-mobile-ionic/issues/1175
        window.scrollTo(0, 0);

        if (!loginForm.$valid) {
            return;
        }

        let server = this.cloud.defaultServer();

        const idx = this.user.email.lastIndexOf("@");
        if (
            idx > -1 &&
            (this.user.email.slice(idx + 1) === "arch-iot.com" ||
                this.user.email.slice(idx + 1) === "archsys.io")
        ) {
            server = await this.selectServerModal();
        }

        try {
            await this.User.login(this.user.email, this.user.password, server);
            this.error = null;
            this.user.email = "";
            this.user.password = "";

            this.$state.go("main.home");
        } catch (err) {
            let msg = "Error logging in, please try again.";
            this.passreset = false;
            if (err.status === 400) {
                this.passreset = true;
            }
            if (err.userMessage) {
                msg = err.userMessage;
            } else if (err.message) {
                msg = err.message;
            }

            this.setError(msg);
        }
    }

    protected async initialize() {
        await this.showLoading("Getting Ready");

        try {
            this.passreset = false;
            // Don't reinitialize email and password so they stay if we go to the registration page and come back
            // this.user.email = '';
            // this.user.password = '';

            if (await this.User.isAuthenticated()) {
                this.$state.go("main.home");
            }
        } finally {
            await this.hideLoading();
        }
    }
}

angular.module("main").controller("LoginCtrl", LoginController as any);
