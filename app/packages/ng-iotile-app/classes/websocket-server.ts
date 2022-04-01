/**
 * A CoreTools compatible websockets based TileBus transport agent.
 *
 * This class spawns a websocket server suitable for allowing access to this device's
 * bluetooth adapter over a local websocket connection.
 */

import { InvalidOperationError, ObjectBase } from "@iotile/iotile-common";
import { IOTileAdapter, IOTileAdvertisement } from "@iotile/iotile-device";
import { Codec, createCodec, decode, encode } from "msgpack-lite";

export interface ServerAddress {
    address: string;
    port: number;
}

export enum WebSocketServerStatus {
    ServerStopped = 0,
    ServerStarting = 1,
    ServerStarted = 2,
    UserConnected = 3
}

interface ConnectionInformation {
    connID: number;
    advertisement: IOTileAdvertisement;
}

export class TileBusWebsocketAgent extends ObjectBase {
    public onChangeCallback: (WebSocketServerStatus) => void | Promise<void>;

    public address: ServerAddress;
    public interfaceAddresses: string[];
    private server: WebSocketServer;
    private status: WebSocketServerStatus;
    private adapter: IOTileAdapter;

    private deviceMap: { [key: number]: IOTileAdvertisement };
    private connMap: { [connID: number]: ConnectionInformation };
    private nextConnID: number;

    private codec: Codec;

    constructor($injector) {
        super("TileBusWebsocketServer", $injector);

        this.server = window.cordova.plugins.wsserver;
        this.status = WebSocketServerStatus.ServerStopped;
        this.address = null;
        this.adapter = this.$injector.get("IOTileAdapter");
        this.interfaceAddresses = [];
        this.codec = createCodec({ binarraybuffer: true });

        this.deviceMap = {};
        this.connMap = {};
        this.nextConnID = 1;

        this.onChangeCallback = () => {};
    }

    public async start(port?: number) {
        if (port == null) {
            port = 0;
        }

        if (this.status !== WebSocketServerStatus.ServerStopped) {
            this.log_error(
                "Attempted to start the server after it is already started"
            );
            throw new InvalidOperationError("Server is already started");
        }

        const options: WebSocketServerOptions = {
            onFailure: (address, port, reason) =>
                this.internalOnFailure(address, port, reason),
            onOpen: connection => this.internalOnOpen(connection),
            onMessage: (connection, msg) =>
                this.internalOnMessage(connection, msg),
            onClose: connection => this.internalOnClose(connection),

            tcpNoDelay: true,
            protocols: ["iotile-ws-text", "invalid-unused"] // There is a bug in ws4py that doesn't handle when there is only a single protocol correctly
        };

        this.interfaceAddresses = await this.internalGetInterfaces();
        this.address = await this.internalStart(port, options);
        this.notifyStatus();
    }

    public async stop(): Promise<void> {
        this.log_info("Stop called");
        if (this.status === WebSocketServerStatus.ServerStarting) {
            throw new InvalidOperationError(
                "Cannot stop server until it is fully started"
            );
        }

        if (this.status === WebSocketServerStatus.ServerStopped) {
            return;
        }

        await this.internalStop();
        this.notifyStatus();
    }

    private async handleCommand(conn: WebSocketConnection, cmd: any) {
        const cmdName: string = cmd.command || null;
        let response: {} = {
            success: false,
            reason: "Unknown command sent"
        };

        switch (cmdName) {
            case "scan":
                response = await this.handleScan(2.0);
                break;

            case "connect":
                response = await this.handleConnect(cmd.uuid);
                break;

            case "open_interface":
                response = await this.handleOpenInterface(cmd.interface);
                break;

            case "send_rpc":
                response = await this.handleRPC(cmd);
                break;
        }

        this.sendMessage(conn, response);
    }

    private async handleScan(duration: number): Promise<{}> {
        const devices = await this.adapter.scan(duration);

        const converted = [];
        this.deviceMap = {};
        for (const device of devices) {
            converted.push(this.convertAdvertisement(device));
            this.deviceMap[device.deviceID] = device;
        }

        return {
            success: true,
            devices: converted
        };
    }

    private async handleConnect(deviceID: number): Promise<{}> {
        const advert = this.deviceMap[deviceID];

        if (advert == null) {
            return {
                success: false,
                reason: "Could not find device by UUID, did you scan first?"
            };
        }

        try {
            await this.adapter.connect(advert, {
                scanIfNotFound: false,
                noStreamInterface: false
            });
        } catch (err) {
            this.log_error("Error during connect: %o", err);
            return {
                success: false,
                reason: "Error during connect: " + JSON.stringify(err)
            };
        }

        const connID = this.nextConnID++;

        const connData: ConnectionInformation = {
            connID,
            advertisement: advert
        };

        this.connMap[connID] = connData;

        return {
            success: true,
            connection_id: connID,
            connection_string: advert.connectionID
        };
    }

    private async handleOpenInterface(iface: string): Promise<{}> {
        this.log_info("Open interface called on %s", iface);

        return {
            success: true
        };
    }

    private async handleRPC(msg): Promise<{}> {
        const rpcAddress = msg.rpc_address;
        const rpcCommand = (msg.rpc_feature << 8) | msg.rpc_command;
        const rpcPayload = msg.rpc_payload;
        const rpcTimeout = msg.rpc_timeout;
        let status: number = 0xff;
        let responsePayload: ArrayBuffer = new ArrayBuffer(20);

        this.log_debug(
            "Sending RPC 0x%s to %d",
            rpcCommand.toString(16),
            rpcAddress
        );

        try {
            const start = new Date().getTime();
            responsePayload = await this.adapter.rpc(
                rpcAddress,
                rpcCommand,
                rpcPayload,
                rpcTimeout
            );
            const end = new Date().getTime();

            this.log_debug("RPC finished in %d ms", end - start);

            status = 1 << 6;
            if (responsePayload.byteLength > 0) {
                status |= 1 << 7;
            }
        } catch (err) {
            this.log_error("Error sending RPC: %s", err);
            return {
                success: false,
                reason: "Error sending RPC: " + err
            };
        }

        return {
            success: true,
            status,
            payload: responsePayload
        };
    }

    private convertAdvertisement(device: IOTileAdvertisement): object {
        return {
            connection_string: device.connectionID,
            user_connected: device.flags.otherConnected,
            uuid: device.deviceID,
            signal_strength: device.rssi,
            voltage: device.batteryVoltage
        };
    }

    private sendMessage(conn: WebSocketConnection, msg: {}) {
        this.log_debug("Sending response: %s", JSON.stringify(msg));

        const encoded = this.encodeBase64Msgpack(msg);
        this.server.send(conn, encoded);
    }

    private async decodeBase64Msgpack(msg: string): Promise<object> {
        const binaryMsg = await this.decodeBase64(msg);
        return decode(binaryMsg, { codec: this.codec });
    }

    private encodeBase64Msgpack(msg: {}): string {
        const encoded = encode(msg, { codec: this.codec });

        return this.encodeBase64(encoded);
    }

    // From: https://stackoverflow.com/questions/9267899/arraybuffer-to-base64-encoded-string
    private encodeBase64(bytes: Uint8Array) {
        let binary = "";
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }

        return window.btoa(binary);
    }

    private decodeBase64(msg: string): Promise<Uint8Array> {
        return new Promise<Uint8Array>((resolve, reject) => {
            const req = new XMLHttpRequest();
            req.open("GET", "data:application/octet;base64," + msg);
            req.responseType = "arraybuffer";

            req.onload = e => {
                resolve(new Uint8Array((e.target as any).response));
            };

            req.send();
        });
    }

    private notifyStatus() {
        if (this.onChangeCallback == null) {
            return;
        }

        try {
            this.onChangeCallback(this.status);
        } catch (err) {
            this.log_warn("Error in user supplied onChangeCallback: %s", err);
        }
    }

    /**
     * Methods below here are wrappers and callbacks for interacting with the underlying websocket
     * server spawned through Cordova.
     */

    private internalGetInterfaces(): Promise<string[]> {
        return new Promise<string[]>((resolve, reject) => {
            this.server.getInterfaces(interfaces => {
                let ifaceNames = [];

                for (const netIface in interfaces) {
                    if (
                        !interfaces.hasOwnProperty(netIface) ||
                        interfaces[netIface].ipv4Addresses.length === 0
                    ) {
                        continue;
                    }

                    ifaceNames = ifaceNames.concat(
                        interfaces[netIface].ipv4Addresses
                    );
                }

                resolve(ifaceNames);
            });
        });
    }

    private internalStart(
        port: number,
        options: WebSocketServerOptions
    ): Promise<ServerAddress> {
        return new Promise<ServerAddress>((resolve, reject) => {
            this.status = WebSocketServerStatus.ServerStarting;
            this.server.start(
                port,
                options,
                (address, port) => {
                    this.log_info("Started server at %s:%d", address, port);

                    this.status = WebSocketServerStatus.ServerStarted;
                    resolve({
                        address,
                        port
                    });
                },
                reason => {
                    this.status = WebSocketServerStatus.ServerStopped;

                    this.log_error("Error starting server, reason: %s", reason);
                    reject(reason);
                }
            );
        });
    }

    private internalStop(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.server.stop((address, port) => {
                this.log_info(
                    "Stopped server %s:%d successfully",
                    address,
                    port
                );
                this.address = null;
                this.status = WebSocketServerStatus.ServerStopped;
                resolve();
            }, reject);
        });
    }

    private internalOnFailure(address: string, port: number, reason: string) {
        this.log_error(
            "WebSocket server at %s:%d stopped due to error: %s",
            address,
            port,
            reason
        );
        this.status = WebSocketServerStatus.ServerStopped;
        this.notifyStatus();
    }

    private internalOnOpen(conn: WebSocketConnection) {
        this.log_info("New connection: %s", JSON.stringify(conn));

        this.status = WebSocketServerStatus.UserConnected;
        this.notifyStatus();
    }

    private async internalOnClose(conn: WebSocketConnection) {
        this.log_info("Connection closed: %s", JSON.stringify(conn));
        this.status = WebSocketServerStatus.ServerStarted;
        this.notifyStatus();

        for (const connID in this.connMap) {
            this.log_info("Closing BLE connection from client");
            await this.adapter.disconnect();
        }

        this.connMap = {};
    }

    private async internalOnMessage(conn: WebSocketConnection, msg: string) {
        const cmd = await this.decodeBase64Msgpack(msg);
        this.log_debug("Received command: %s", JSON.stringify(cmd));

        try {
            await this.handleCommand(conn, cmd);
        } catch (err) {
            this.log_error("Unhandled exception during command", err);
            this.sendMessage(conn, {
                success: false,
                reason:
                    "An unhandled exception occured during message processing"
            });
        }
    }
}
