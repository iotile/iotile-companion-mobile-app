import {
    ArgumentError,
    ModalBase,
    ProgressManager,
    ProgressNotifier,
    UnknownError
} from "@iotile/iotile-common";

export class ProgressModal extends ModalBase {
    public get showTryAgainButton() {
        return this.tryAgainButton && this.manager.hasErrors;
    }
    public description: string;
    public title: string;
    public manager: ProgressManager;
    public tryAgainButton: boolean;
    public showButtons: boolean;

    private deferredResolve: () => void;
    // tslint:disable-next-line: variable-name
    private deferredReject: (any) => void;
    private deferredErr;

    private operation: (notifier: ProgressNotifier) => Promise<any>;

    constructor($injector, title: string, longDescription: string) {
        super(
            "ProgressModal",
            "main/templates/modals/progress.html",
            $injector,
            {
                animation: "slide-in-up",
                backdropClickToClose: false,
                hardwareBackButtonClose: false
            }
        );
        this.description = longDescription;
        this.title = title;
        this.tryAgainButton = false;
        this.showButtons = false;
        this.operation = null;
        this.deferredResolve = null;
        this.deferredReject = null;
        this.deferredErr = null;

        this.manager = new ProgressManager(1, this.$scope);
    }

    public manageOperation(
        impl: (notifier: ProgressNotifier) => Promise<any>,
        disableTryAgain?: boolean
    ) {
        this.operation = impl;

        if (disableTryAgain) {
            this.tryAgainButton = false;
        } else {
            this.tryAgainButton = true;
        }
    }

    public async run(): Promise<void> {
        if (!this.operation) {
            throw new ArgumentError(
                "You may only call run on a ProgressModal if it is managing the operation for you."
            );
        }

        await this.show();

        try {
            await this.operation(this.manager.getNotifier());
        } catch (err) {
            // Try to give the most useful error message possible
            let msg = err.userMessage;
            if (msg == null) {
                msg = err.message;
            }
            if (msg == null) {
                msg = err;
            }

            this.manager.fatalError(msg);

            this.deferredErr = err;
        } finally {
            if (this.shouldAutohide()) {
                this.remove();
            } else {
                const that = this;

                const promise = new Promise<void>((resolve, reject) => {
                    that.deferredResolve = resolve;
                    that.deferredReject = reject;
                });

                // Do the scope.apply here because we need deferredResolve to be valid
                // when we $scope.$apply because the template checks that for showing
                // the close button
                this.showButtons = true;
                this.$scope.$apply();

                // tslint:disable-next-line: no-unsafe-finally
                return promise;
            }
        }
    }

    public shouldAutohide() {
        return this.manager.messages.length === 0;
    }

    protected async initialize() {
        this.manager.clear();
        this.deferredErr = null;
        this.showButtons = false;
    }

    private async onTryAgain() {
        try {
            await this.initialize();
            await this.operation(this.manager.getNotifier());
        } catch (err) {
            // Try to give the most useful error message possible
            let msg = err.userMessage;
            if (msg == null) {
                msg = err.message;
            }
            if (msg == null) {
                msg = err;
            }
            this.manager.fatalError(msg);

            this.deferredErr = err;
        } finally {
            if (this.shouldAutohide()) {
                this.deferredResolve();
                this.remove();
            } else {
                this.showButtons = true;
                this.$scope.$apply();
            }
        }
    }

    private onClose() {
        if (this.deferredErr) {
            this.deferredReject(this.deferredErr);
        } else if (this.manager.hasErrors) {
            this.deferredReject(new UnknownError("Error in operation")); // FIXME: Make this error message better
        } else {
            this.deferredResolve();
        }

        this.remove();
    }
}
