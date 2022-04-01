import { convertToSecondsSince2000, DeviceTime } from "@iotile/iotile-device";

export interface MockIOTileDeviceConfig {
    DOWNLOAD_STREAM: any;
    DEVICE_TIME: DeviceTime;
}

/**
 * @description Allows a mock device that has already been injected to be configured.
 */
export interface DeviceConfigHook {
    setConfig?: (mockDeviceConfig: MockIOTileDeviceConfig) => void;
}

export class MockIOTileDevice {
    private _config: MockIOTileDeviceConfig;

    constructor(mockDeviceConfig: MockIOTileDeviceConfig) {
        this._config = mockDeviceConfig;
    }

    get config() {
        return this._config;
    }

    public async downloadStream(stream: string) {
        return this._config.DOWNLOAD_STREAM[stream];
    }

    public async graphInput(stream: string | number, value: number) {}

    public async currentTime(
        synchronizationSlopSeconds: number = 60
    ): Promise<DeviceTime> {
        return this._config.DEVICE_TIME;
    }

    public async synchronizeTime(forcedTime?: Date): Promise<number> {
        if (!forcedTime) {
            forcedTime = new Date();
        }

        this._config.DEVICE_TIME = {
            isUTC: true,
            isSynchronized: true,
            currentTime: forcedTime
        };

        return convertToSecondsSince2000(forcedTime);
    }
}
