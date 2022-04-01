import angular = require("angular");
// tslint:disable-next-line: no-submodule-imports
import "ionic-angular/js/ionic";

// Options to $ionicPopover.fromTemplateUrl
// see https://ionicframework.com/docs/v1/api/controller/ionicPopover/
export interface PopoverOptions {
    focusFirstInput?: boolean;
    backdropClickToClose?: boolean;
    hardwareBackButtonClose?: boolean;
}

/**
 * A simply Promise-based wrapper on top of ionicPopover.
 *
 * This class will be returned by the PopoverService and you can
 * call show() and hide() to show and hide the popover.  If you
 * call autoRemove() before calling show(), the popover will
 * automatically be removed from the DOM when hide() is called.
 *
 * You should not mix calling autoRemove() and calling remove()
 * manually.
 */
export class Popover {
    private ionicPopover: any;
    private scope: ng.IScope;
    private autoremove: boolean;

    constructor(ionicPopover, $scope: ng.IScope) {
        this.ionicPopover = ionicPopover;
        this.scope = $scope;
        this.autoremove = false;
    }

    public autoRemove() {
        if (this.autoremove) {
            return;
        }

        this.autoremove = true;

        this.scope.$on("popover.hidden", (event, popover) => {
            if (popover === this.ionicPopover) {
                this.remove();
            }
        });
    }

    public show($event: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.ionicPopover
                .show($event)
                .then(resolve)
                .catch(reject);
        });
    }

    public hide(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.ionicPopover
                .hide()
                .then(resolve)
                .catch(reject);
        });
    }

    public remove(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.ionicPopover
                .remove()
                .then(resolve)
                .catch(reject);
        });
    }

    public isShown(): boolean {
        return this.ionicPopover.isShown();
    }
}

// tslint:disable-next-line: max-classes-per-file
export class PopoverService {
    private $ionicPopover: any;

    constructor($ionicPopover) {
        this.$ionicPopover = $ionicPopover;
    }

    public fromTemplateURL(
        templateURL: string,
        scope: ng.IScope,
        options?: PopoverOptions
    ): Promise<Popover> {
        if (options == null) {
            options = {};
        }

        const internalOptions = {
            scope,
            focusFirstInput: options.focusFirstInput,
            backdropClickToClose: options.backdropClickToClose,
            hardwareBackButtonClose: options.hardwareBackButtonClose
        };

        return new Promise<Popover>((resolve, reject) => {
            this.$ionicPopover
                .fromTemplateUrl(templateURL, internalOptions)
                .then((popover: any) => {
                    resolve(new Popover(popover, scope));
                })
                .catch(err => reject(err));
        });
    }
}

angular.module("iotile.app").service("PopoverService", PopoverService);
