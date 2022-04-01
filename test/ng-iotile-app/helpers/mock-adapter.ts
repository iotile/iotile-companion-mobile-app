import {
    AbstractNotificationService,
    IOTileAdapter,
    IOTileDevice,
    Platform
} from "@iotile/iotile-device";
import {
    DeviceConfigHook,
    MockIOTileDevice,
    MockIOTileDeviceConfig
} from "./mock-device";
import { StandardJig } from "./standard-jig";

export class MockIOTileAdapter extends IOTileAdapter {
    private mockDeviceConfig: MockIOTileDeviceConfig;

    constructor(
        Config: any,
        notificationService: AbstractNotificationService,
        platform: Platform,
        deviceConfigHook: DeviceConfigHook
    ) {
        super(Config, notificationService, platform);
        this.mockDeviceConfig = StandardJig.DefaultDeviceConfig;

        deviceConfigHook.setConfig = mockDeviceConfig => {
            this.mockDeviceConfig = mockDeviceConfig;
        };
    }

    public async connectTo(slug: string, options: any): Promise<IOTileDevice> {
        this.connectedDevice = new MockIOTileDevice(
            this.mockDeviceConfig
        ) as any;
        return this.connectedDevice as IOTileDevice;
    }

    // tslint:disable-next-line: no-empty
    public async disconnect() {}

    // tslint:disable-next-line: no-empty
    public async subscribe() {}
}
