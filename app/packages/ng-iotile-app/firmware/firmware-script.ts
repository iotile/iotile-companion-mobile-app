import { ArgumentError } from "@iotile/iotile-common";
import { IOTileDevice } from "@iotile/iotile-device";
import { FileLocation, FileSystemService } from "../filesystem-serv";
import * as Rules from "./firmware-rules";
import { DeviceMetadata, SerializedFirmwareInfo } from "./firmware-types";

type RuleConstructor = new (args: {}) => Rules.FirmwareRule;

export class FirmwareScript {
    public static async Deserialize(
        info: SerializedFirmwareInfo,
        fs: FileSystemService
    ): Promise<FirmwareScript> {
        const rules: Rules.FirmwareRule[] = [];

        for (const serializedRule of info.rules) {
            if (!(serializedRule.name in FirmwareScript.RuleDeserializers)) {
                throw new ArgumentError(
                    "Unknown firmware script rule type: " + serializedRule.name
                );
            }

            const rule = new FirmwareScript.RuleDeserializers[
                serializedRule.name
            ](serializedRule.args);
            rules.push(rule);
        }

        if (!(await fs.checkFile(info.path, info.fsLocation as FileLocation))) {
            throw new ArgumentError(
                "Firmware script binary file does not exist.  Path: " +
                    info.path
            );
        }

        return new FirmwareScript(
            info.name,
            info.update_id,
            info.description,
            info.path,
            info.fsLocation,
            info.critical,
            rules
        );
    }
    private static RuleDeserializers: { [key: string]: RuleConstructor } = {
        ControllerVersion: Rules.ControllerVersionRule
    };

    constructor(
        public name: string,
        public updateID: string,
        public description: string,
        public path: string,
        public fs: string,
        public critical: boolean,
        public rules: Rules.FirmwareRule[]
    ) {
        if (this.description == null) {
            this.description = name;
        }

        if (this.updateID === undefined) {
            this.updateID = null;
        }
    }

    public async applies(
        meta: DeviceMetadata,
        device: IOTileDevice
    ): Promise<boolean> {
        for (const rule of this.rules) {
            let res = rule.check(meta, device);

            if (res instanceof Promise) {
                res = await res;
            }

            if (res === false) {
                return false;
            }
        }

        return true;
    }
}
