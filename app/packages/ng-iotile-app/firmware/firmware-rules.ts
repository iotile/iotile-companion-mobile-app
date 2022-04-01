import { ArgumentError } from "@iotile/iotile-common";
import { IOTileDevice } from "@iotile/iotile-device";
import { DeviceMetadata } from "./firmware-types";

// tslint:disable-next-line: variable-name
type RuleValueChecker = (string, any) => boolean;

export abstract class FirmwareRule {
    private args: {};
    constructor(args: {}) {
        this.args = args;
    }

    public abstract check(
        metadata: DeviceMetadata,
        device: IOTileDevice
    ): Promise<boolean> | boolean;

    protected get<T>(name: string, type: string, defaultValue?: any): T {
        const val = this.args[name];

        if (val === undefined) {
            if (defaultValue !== undefined) {
                return defaultValue;
            }

            throw new ArgumentError(`Required argument ${name} not found`);
        }

        const argType = typeof val;
        if (typeof val !== type) {
            throw new ArgumentError(
                `Argument ${name} had wrong type ${argType}, expected ${type}`
            );
        }

        return val;
    }
}

interface ControllerVersionArgs {
    version: string;
    hw: string;
}

// tslint:disable-next-line: max-classes-per-file
export class ControllerVersionRule extends FirmwareRule {
    private version: string;
    private hw: string;

    constructor(args: ControllerVersionArgs) {
        super(args);

        this.version = this.get("version", "string", null);
        this.hw = this.get("hw_tag", "string", null);
    }

    public check(metadata: DeviceMetadata, device: IOTileDevice): boolean {
        if (
            this.version != null &&
            metadata.controllerVersion !== this.version
        ) {
            return false;
        }

        if (this.hw != null && metadata.controllerHWTag !== this.hw) {
            return false;
        }

        return true;
    }
}
