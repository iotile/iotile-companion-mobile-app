import { ModalBase } from "@iotile/iotile-common";
import angular = require("angular");
import { LogMessage, UserService } from "ng-iotile-app";

export class LogModal extends ModalBase {
    public log: LogMessage;

    protected User: UserService;

    constructor($injector, log: LogMessage) {
        super("LogModal", "main/templates/modals/log-info.html", $injector, {
            animation: "slide-in-up",
            backdropClickToClose: false,
            hardwareBackButtonClose: false
        });
        this.log = log;
    }
}
