import { UISeverity } from "@iotile/iotile-common";
import angular = require("angular");

export class UIService {
    constructor(
        private $log: ng.ILogService,
        private $ionicPopup,
        private $ionicLoading
    ) {}

    /*
     * Legacy interface function that is now deprecated.
     */
    public messageBox(title: string, msg: string, callback?: () => void) {
        const alertPopup = this.$ionicPopup.alert({
            title,
            template: msg
        });

        alertPopup.then(function() {
            if (callback) {
                callback();
            }
        });
    }

    /*
     * Show a confirm dialog box with a message and customized cancel and okay text.
     *
     * This async function will return a boolean with the result of the user's operation.
     */
    public async confirm(
        title: string,
        msg: string,
        cancelText?: string,
        okText?: string,
        severity: UISeverity = UISeverity.Info
    ): Promise<boolean> {
        const that = this;

        if (!cancelText) {
            cancelText = "Cancel";
        }

        if (!okText) {
            okText = "OK";
        }

        return new Promise<boolean>(function(resolve, reject) {
            that.$ionicPopup
                .confirm({
                    title,
                    template: msg,
                    cssClass: severity + "-popup",
                    buttons: [
                        {
                            text: cancelText,
                            type: "button-assertive",
                            onTap(e) {
                                return false;
                            }
                        },
                        {
                            text: okText,
                            type: "button-balanced",
                            onTap(e) {
                                return true;
                            }
                        }
                    ]
                })
                .then(resolve);
        });
    }

    /*
     * Show an alert dialog box with a message
     *
     * This async function will return when the user closes the dialog box.
     */
    public async alert(
        title: string,
        msg: string,
        severity: UISeverity = UISeverity.Info
    ) {
        const that = this;

        return new Promise<void>(function(resolve, reject) {
            that.$ionicPopup
                .alert({
                    title,
                    cssClass: severity + "-popup",
                    template: msg
                })
                .then(resolve);
        });
    }

    public showLoading(
        message: string,
        autoCloseOnTransition: boolean = false
    ): Promise<void> {
        return this.showLoadingEx({
            template: message,
            hideOnStateChange: autoCloseOnTransition
        });
    }

    public async showLoadingEx(details: {}) {
        const that = this;

        return new Promise<void>(function(resolve, reject) {
            that.$ionicLoading
                .show(details)
                .then(function() {
                    resolve();
                })
                .catch(err => resolve());
        });
    }

    public async hideLoading() {
        const that = this;

        return new Promise<void>(function(resolve, reject) {
            that.$ionicLoading
                .hide()
                .then(function() {
                    resolve();
                })
                .catch(err => resolve());
        });
    }
}

angular.module("iotile.app").service("UIService", UIService);
