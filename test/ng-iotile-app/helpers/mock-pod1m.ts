import { MockIOTileAdapter } from "./mock-adapter";
import { MockIOTileDevice, MockIOTileDeviceConfig } from "./mock-device";

export interface MockPOD1MDeviceConfig extends MockIOTileDeviceConfig {
    ACCEL_STATUS: MockAccelStatus;
}

export interface MockAccelStatus {
    tile_state: TILE_STATE;
    recording: boolean;
    settled: boolean;
    streaming: boolean;
}

export enum TILE_STATE {
    "initializing" = "initializing",
    "capturing" = "capturing",
    "streaming" = "streaming"
}

export class MockPOD1M {
    private device: MockIOTileDevice;
    private adapter: MockIOTileAdapter;

    constructor(device: MockIOTileDevice, adapter: MockIOTileAdapter) {
        this.device = device;
        this.adapter = adapter;
    }

    public async getAccelerometerStatus() {
        return (this.device.config as MockPOD1MDeviceConfig).ACCEL_STATUS;
    }

    public downloadData() {}

    public getShockInfo() {}
}
