export interface SerializedFirmwareRule {
    name: string;
    args: {};
}

export interface SerializedFirmwareInfo {
    name: string;
    description: string;
    path: string;
    critical: boolean;
    update_id: string;
    fsLocation: string;

    rules: SerializedFirmwareRule[];
}

export interface SerializedFirmwareFile {
    version: string;
    firmware: SerializedFirmwareInfo[];
}

export interface DeviceMetadata {
    controllerVersion: string;
    controllerHWTag: string;
}
