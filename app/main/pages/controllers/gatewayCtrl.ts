import {
    ArgumentError,
    ModalBase,
    UnknownKeyError
} from "@iotile/iotile-common";
import { IndividualReport } from "@iotile/iotile-device";
import angular = require("angular");
import { DeviceBaseController, StreamStyle, UserService } from "ng-iotile-app";

class ServiceMessage {
    public static readonly INFO = 0;
    public static readonly WARNING = 1;
    public static readonly ERROR = 2;
    private created: Date;
    constructor(
        public id: number,
        public level: number,
        public message: string,
        public count: number,
        age: number
    ) {
        let now = new Date().getTime();

        now -= age * 1000;

        this.created = new Date();
        this.created.setTime(now);
    }

    /*
     * Get the age of this message in seconds, autoatically updating it
     * everytime this function is called.
     */
    public get age(): number {
        const now = new Date().getTime();

        return Math.floor((now - this.created.getTime()) / 1000);
    }
    /*
     * Turn the age of this message in seconds into a nice string like '5 seconds ago'
     */
    public get niceAge(): string {
        if (this.age < 2) {
            return "just now";
        } else if (this.age < 2 * 60) {
            return this.age + " seconds ago";
        } else if (this.age < 2 * 60 * 60) {
            const minuteAge = Math.floor(this.age / 60);
            return minuteAge + " minutes ago";
        } else if (this.age < 2 * 24 * 60 * 60) {
            const hourAge = Math.floor(this.age / 60 / 60);
            return hourAge + " hours ago";
        } else {
            const dayAge = Math.floor(this.age / 24 / 60 / 60);
            return dayAge + " days ago";
        }
    }

    public get badgeClass() {
        let style: string;

        switch (this.level) {
            case ServiceMessage.INFO:
                style = "badge-balanced";
                break;

            case ServiceMessage.WARNING:
                style = "badge-energized";
                break;

            case ServiceMessage.ERROR:
                style = "badge-assertive";
                break;

            default:
                style = "badge-energized";
                break;
        }

        return "badge " + style;
    }

    public get badgeContents() {
        switch (this.level) {
            case ServiceMessage.INFO:
                return "I";

            case ServiceMessage.WARNING:
                return "W";

            case ServiceMessage.ERROR:
                return "E";

            default:
                return "U";
        }
    }
}

// tslint:disable: max-classes-per-file
class GatewayService {
    public messages: ServiceMessage[];
    public headline: ServiceMessage;

    constructor(public name: string, public state: number, public id: number) {
        this.messages = [];
        this.headline = null;
    }

    public get userStatus(): string {
        switch (this.state) {
            case 0:
                return "Not Started";

            case 1:
                return "OK";

            case 2:
                return "Degraded";

            case 3:
                return "Stopped";

            case 4:
                return "Unknown";
        }
    }

    public get icon(): string {
        switch (this.state) {
            case 0:
                return "BAD";

            case 1:
                return "GOOD";

            case 2:
                return "BAD";

            case 3:
                return "BAD";

            case 4:
                return "UNKNOWN";
        }
    }
}

class GatewayInterface {
    public get connectionStatus(): string {
        if (this.wireless) {
            if (this.wirelessNetwork !== null) {
                return "Connected to: " + this.wirelessNetwork;
            }

            return "Not Connected";
        } else {
            if (this.ip !== "0.0.0.0") {
                return "Connected";
            } else {
                return "Not Connected";
            }
        }
    }

    public get ipStatus(): string {
        if (this.connectionStatus === "Not connected") {
            return "";
        }

        if (this.ip === "0.0.0.0") {
            return "No Address Assigned";
        } else if (this.staticIP) {
            return "Static Address: " + this.ip;
        } else {
            return "Dynamic Address: " + this.ip;
        }
    }
    public ip: string;
    public staticIP: boolean;
    public gateway: string;
    public netmask: string;
    public dns: string;
    public wirelessNetwork: string;

    constructor(
        public readonly index: number,
        public readonly name: string,
        public readonly wireless: boolean
    ) {
        this.ip = "0.0.0.0";
        this.staticIP = false;
        this.gateway = "0.0.0.0";
        this.netmask = "0.0.0.0";
        this.dns = "0.0.0.0";

        this.wirelessNetwork = null;
    }

    public setIPInfo(
        ip: number,
        netmask: number,
        gateway: number,
        dns: number,
        staticIP: boolean
    ) {
        this.ip = this.ipToString(ip);
        this.netmask = this.ipToString(netmask);
        this.gateway = this.ipToString(gateway);
        this.dns = this.ipToString(dns);
        this.staticIP = staticIP;
    }

    protected ipToString(ip: number): string {
        const q1 = (((ip & 0xff000000) >>> 24) >>> 0).toString();
        const q2 = (((ip & 0x00ff0000) >>> 16) >>> 0).toString();
        const q3 = (((ip & 0x0000ff00) >>> 8) >>> 0).toString();
        const q4 = (((ip & 0x000000ff) >>> 0) >>> 0).toString();

        return q1 + "." + q2 + "." + q3 + "." + q4;
    }
}

interface InterfaceConfig {
    useStatic: boolean;
    staticIP: string;
    netmask: string;
    gateway: string;
    dns: string;
}

interface ServiceModalDescriptor {
    templateURL: string;
    serviceName: string;
    controllerName: string;
}

export class GatewayController extends DeviceBaseController {
    public static $inject = ["$scope", "$stateParams", "$injector", "User"];
    public inProgress: boolean;

    public rssi: number;

    public hasNetworks: boolean;
    public selectedNetwork: string;
    public selectedNetworkPassword: string;
    public manualSelection: boolean;
    public availableNetworks: string[];

    public customServiceModals: { [key: string]: ServiceModalDescriptor };
    public services: GatewayService[];
    public interfaces: GatewayInterface[];

    public modalInterface: GatewayInterface;
    public modalInterfaceConfig: InterfaceConfig;

    public modalService: GatewayService;
    public modalServiceMessages: boolean;

    constructor(
        $scope: ng.IScope,
        $stateParams,
        $injector,
        private User: UserService
    ) {
        super("GatewayController", $stateParams.deviceId, $injector, $scope);
    }

    public async showConfigureInterfaceModal(iface: GatewayInterface) {
        const templateURL = "main/pages/templates/modals/gateway-iface.html";

        this.selectedNetwork = null;
        this.selectedNetworkPassword = null;
        this.hasNetworks = false;

        this.modalInterface = iface;
        this.modalInterfaceConfig = {
            useStatic: false,
            staticIP: "",
            netmask: "",
            gateway: "",
            dns: ""
        };

        try {
            // Prepopulate IP information from the gateway if we have any
            if (iface.ip !== "0.0.0.0") {
                this.modalInterfaceConfig.staticIP = iface.ip;
            }

            if (iface.netmask !== "0.0.0.0") {
                this.modalInterfaceConfig.netmask = iface.netmask;
            }

            if (iface.gateway !== "0.0.0.0") {
                this.modalInterfaceConfig.gateway = iface.gateway;
            }

            if (iface.dns !== "0.0.0.0") {
                this.modalInterfaceConfig.dns = iface.dns;
            }

            if (iface.staticIP) {
                this.modalInterfaceConfig.useStatic = true;
            }

            await this.showModal(templateURL);

            // If we're a wireless interface, start scanning for wifi networks
            if (this.modalInterface.wireless) {
                this.availableNetworks = await this.getNetworks(
                    iface.index,
                    2.0
                );
                this.selectedNetwork = await this.getConnectedWIFI(iface.index);
                this.hasNetworks = true;
                this.$scope.$apply();
            }
        } catch (err) {
            this.log_error(JSON.stringify(err));
            await this.hideModal();
        }
    }

    public async showServiceModal(service: GatewayService) {
        const templateURL =
            "main/pages/templates/modals/gateway-service-messages.html";

        this.modalService = service;
        this.modalServiceMessages = false;

        try {
            this.log_info("Showing modal for service: " + service.name);

            if (service.name in this.customServiceModals) {
                const desc = this.customServiceModals[service.name];

                const modal = new ModalBase(
                    service.name,
                    desc.templateURL,
                    this.$injector,
                    {
                        animation: "slide-in-up",
                        backdropClickToClose: false,
                        hardwareBackButtonClose: false,
                        customController: desc.controllerName
                    }
                );

                await modal.show(this.adapter);
            } else {
                // Otherwise show our default modal which is just a list of log messages
                await this.showModal(templateURL);
                this.modalService.messages = await this.getMessages(service.id);
                this.modalServiceMessages = true;
                this.$scope.$apply();
            }
        } catch (err) {
            let msg = "Internal Error: could not show modal";

            if (err.userMessage) {
                msg = err.userMessage;
            }

            this.setError(msg);
            this.log_error("Error showing modal for service", service, err);
        }
    }

    public async configureInterface(
        iface: GatewayInterface,
        config: InterfaceConfig
    ) {
        let ifaceByte = iface.index;
        let staticIP = 0;
        let netmask = 0;
        let gateway = 0;
        let dns = 0;

        if (config.useStatic) {
            ifaceByte |= 1 << 7;

            staticIP = this.ipToNumber(config.staticIP);
            netmask = this.ipToNumber(config.netmask);
            gateway = this.ipToNumber(config.gateway);
            dns = this.ipToNumber(config.dns);
        }

        this.adapter.errorHandlingRPC(8, 0x8009, "BBBBLLLL", "L", [
            ifaceByte,
            0,
            0,
            0,
            staticIP,
            netmask,
            gateway,
            dns
        ]);
    }

    public async connectInterface(iface: GatewayInterface) {
        if (this.inProgress) {
            this.log_error(
                "connectInterface called while still in progress, aborting second call"
            );
            return;
        }

        try {
            this.inProgress = true;

            await this.showLoading("Connecting...");

            if (iface.wireless) {
                await this.adapter.errorHandlingRPC(
                    8,
                    0x8003,
                    "H18s",
                    "L",
                    [this.selectedNetwork.length, this.selectedNetwork],
                    1.0
                );

                if (this.selectedNetworkPassword !== null) {
                    await this.adapter.errorHandlingRPC(
                        8,
                        0x8002,
                        "H18s",
                        "L",
                        [
                            this.selectedNetworkPassword.length,
                            this.selectedNetworkPassword
                        ],
                        1.0
                    );
                }
            }

            // Configure ip information
            await this.configureInterface(iface, this.modalInterfaceConfig);

            // Now actually do the connecting
            await this.adapter.errorHandlingRPC(
                8,
                0x8004,
                "B",
                "L",
                [iface.index],
                60.0
            );

            // Share our token so the gateway can connect to iotile.cloud
            await this.shareToken();

            // Now update to get the latest information about our connected ip address and network (if wireless)
            await this.updateInterfaceStatus(iface.index);

            if (iface.wireless) {
                const newNetwork = await this.getConnectedWIFI(iface.index);
                iface.wirelessNetwork = newNetwork;
            }
        } catch (err) {
            this.log_error("Error connecting: " + err);
            this.setError(JSON.stringify(err));
        } finally {
            await this.hideLoading();
            await this.hideModal();

            await this.alert(
                "Connection Started",
                "Service status should update automatically over the next minute."
            );

            this.inProgress = false;
            this.$scope.$apply();
        }
    }

    protected async preInitialize() {
        this.inProgress = false;
        this.hasNetworks = false;
        this.manualSelection = false;
        this.selectedNetwork = "";
        this.selectedNetworkPassword = "";
        this.availableNetworks = [];

        this.services = [];
        this.interfaces = [];

        this.rssi = 0;

        this.modalInterface = null;
        this.modalInterfaceConfig = null;

        this.customServiceModals = {};
        this.modalService = null;
        this.modalServiceMessages = false;

        // Search our cloud sensorgraph information to see if we should display any custom modals
        // for services that we contain.
        const sg = this.project.getSensorGraph(
            this.cloudDevice.sensorGraphSlug
        );
        const uiExtra = sg.getUiExtra("mobile");

        if (uiExtra && uiExtra.serviceModals) {
            for (const serviceName in uiExtra.serviceModals) {
                const desc = uiExtra.serviceModals[serviceName];

                if (desc.templateName && desc.controllerName) {
                    this.customServiceModals[serviceName] = {
                        controllerName: desc.controllerName,
                        templateURL:
                            "main/pages/templates/modals/" +
                            desc.templateName +
                            ".html",
                        serviceName
                    };

                    this.log_info(
                        "Using custom modal for service: " + serviceName,
                        this.customServiceModals[serviceName]
                    );
                }
            }
        }

        this.bindMethod((report: IndividualReport) => {
            this.handleServiceChange(report);
        }, 0x1005);
        this.bindMethod((report: IndividualReport) => {
            this.handleInterfaceChange(report);
        }, 0x1004);
    }

    protected async postInitialize() {
        await this.updateServices();
        await this.updateInterfaces();

        // Set our rssi based on the device's advertisement that we connected to
        this.rssi = this.adapter.connectedDevice.advertisement.rssi;
        this.$scope.$apply();
    }

    protected async handleServiceChange(report: IndividualReport) {
        const value = report.reading.value;
        const newService: boolean = !!(value & (1 << 31));
        const newHeadline: boolean = !!(value & (1 << 30));
        const serviceID = (value >>> 16) & ~(0b11 << 14);
        const serviceState = value & 0xffff;

        this.log_info(
            "Service " +
                serviceID +
                " changed state, new headline = " +
                newHeadline
        );

        // TODO: If this is a new service that we haven't seen before we should update services
        if (serviceID < this.services.length) {
            this.services[serviceID].state = serviceState;

            if (newHeadline) {
                const headline = await this.getHeadline(serviceID);
                if (headline !== null) {
                    this.services[serviceID].headline = headline;
                }
            }

            this.$scope.$apply();
        } else {
            this.log_error(
                "Found information on new service, ignoring it: service id = " +
                    serviceID
            );
        }
    }

    protected async handleInterfaceChange(report: IndividualReport) {
        const interfaceID = report.reading.value;

        this.log_info(
            "Interface " + interfaceID + " changed state, updating it"
        );

        if (interfaceID < this.interfaces.length) {
            await this.updateInterfaceStatus(interfaceID);

            if (this.interfaces[interfaceID].wireless) {
                const ssid = await this.getConnectedWIFI(interfaceID);
                this.interfaces[interfaceID].wirelessNetwork = ssid;
            }

            this.$scope.$apply();
        } else {
            this.log_error(
                "Found information on new service, ignoring it: service id = " +
                    interfaceID
            );
        }
    }

    private async updateServices() {
        const [count] = await this.adapter.typedRPC(8, 0x800b, "", "L", []);

        this.services = [];

        for (let i = 0; i < count; ++i) {
            try {
                const name = await this.getServiceName(i);
                const state = await this.getServiceState(i);
                const headline = await this.getHeadline(i);

                const serv = new GatewayService(name, state, i);

                if (headline !== null) {
                    serv.headline = headline;
                }

                this.services.push(serv);
            } catch (err) {
                this.log_error(JSON.stringify(err));
                throw err;
            }
        }
    }

    private async updateInterfaces() {
        const [count] = await this.adapter.typedRPC(8, 0x8013, "", "L", []);

        this.interfaces = [];

        for (let i = 0; i < count; ++i) {
            const iface = await this.updateInterface(i);
            this.interfaces.push(iface);

            // Get the current interface information
            await this.updateInterfaceStatus(i);

            if (this.interfaces[i].wireless) {
                this.interfaces[
                    i
                ].wirelessNetwork = await this.getConnectedWIFI(i);
            }
        }
    }

    /*
     * Load curent information about a network interface
     */
    private async updateInterface(index: number) {
        const [err, nameLength, wifiNumber] = await this.adapter.typedRPC(
            8,
            0x8015,
            "B",
            "BBB",
            [index]
        );
        const wifi: boolean = !!wifiNumber;

        if (err !== 0) {
            throw new ArgumentError(
                "Invalid index for querying gateway interface: " +
                    index +
                    " err = " +
                    err
            );
        }

        // Now get the name of the interface
        let name = "";

        while (name.length < nameLength) {
            // tslint:disable-next-line: prefer-const
            let [err, chunkLength, chunk] = await this.adapter.typedRPC(
                8,
                0x8014,
                "BB",
                "BB18s",
                [index, name.length]
            );
            if (err !== 0) {
                throw new ArgumentError("Unknown interface index: " + index);
            }

            chunk = chunk.substring(0, chunkLength);
            name += chunk;
        }

        return new GatewayInterface(index, name, wifi);
    }

    private async getConnectedWIFI(index: number) {
        const [err, chunkLength, chunk] = await this.adapter.typedRPC(
            8,
            0x8012,
            "B",
            "BB18s",
            [index]
        );

        if (err !== 0) {
            return null;
        }

        return chunk.substring(0, chunkLength);
    }

    private async updateInterfaceStatus(index: number) {
        const [
            ifaceByte,
            reserved,
            ip,
            netmask,
            gateway,
            dns
        ] = await this.adapter.typedRPC(8, 0x8008, "B", "B3sLLLL", [index]);
        const staticIP: boolean = !!(ifaceByte & (1 << 7));

        this.interfaces[index].setIPInfo(ip, netmask, gateway, dns, staticIP);
    }

    private async getServiceName(id: number) {
        let name = "";

        // tslint:disable-next-line: prefer-const
        let [totalLength, chunkLength, chunk] = await this.adapter.typedRPC(
            8,
            0x800c,
            "HB",
            "BB18s",
            [id, 0]
        );
        if (totalLength === 0) {
            throw new ArgumentError("Unknown service id: " + id);
        }

        chunk = chunk.substring(0, chunkLength);
        name += chunk;

        while (name.length < totalLength) {
            // tslint:disable-next-line: prefer-const
            let [totalLength, chunkLength, chunk] = await this.adapter.typedRPC(
                8,
                0x800c,
                "HB",
                "BB18s",
                [id, name.length]
            );
            chunk = chunk.substring(0, chunkLength);
            name += chunk;
        }

        return name;
    }

    private async getServiceState(id: number) {
        const [err, state] = await this.adapter.typedRPC(8, 0x800e, "L", "HH", [
            id
        ]);
        if (err !== 0) {
            throw new ArgumentError("Unknown service id: " + id);
        }

        return state;
    }

    private async countMessages(serviceID: number) {
        const [err, count] = await this.adapter.typedRPC(8, 0x800f, "L", "HH", [
            serviceID
        ]);
        if (err !== 0) {
            throw new ArgumentError("Unknown service id: " + serviceID);
        }

        return count;
    }

    private async getMessage(serviceID: number, messageIndex: number) {
        const [
            age,
            err,
            messageID,
            messageLevel,
            messageLength,
            messageCount
        ] = await this.adapter.typedRPC(8, 0x8010, "LH", "LHHHHH", [
            serviceID,
            messageIndex
        ]);

        if (err === 3 && messageIndex === 0xffff) {
            return null;
        } else if (err !== 0) {
            throw new ArgumentError(
                "Unknown service or message id, error code = " + err
            );
        }

        const messageContents = await this.getMessageContents(
            serviceID,
            messageID
        );

        return new ServiceMessage(
            messageID,
            messageLevel,
            messageContents,
            messageCount,
            age
        );
    }

    private async getHeadline(serviceID: number) {
        const maxAttempts = 10;

        /*
         * The headline could change at any time so we may need to read it multiple times if we read it partially
         * across a change.
         */
        for (let i = 0; i < maxAttempts; ++i) {
            try {
                const headline = await this.getMessage(serviceID, 0xffff); // The special index 0xFFFF indicates that we should fetch the headline
                return headline;
            } catch (err) {
                if (err instanceof ArgumentError) {
                    continue;
                }

                throw err;
            }
        }
    }

    private async getMessages(serviceID: number) {
        const count = await this.countMessages(serviceID);
        const messages = [];

        for (let i = 0; i < count; ++i) {
            try {
                const message = await this.getMessage(serviceID, i);
                messages.push(message);
            } catch (err) {
                // If we have trouble getting a message, that's okay because we expect
                // that some messages might be lost if they are overwritten while we are
                // attempting to grab them, so ignore Argument
                if (!(err instanceof ArgumentError)) {
                    throw err;
                }
            }
        }

        return messages;
    }

    private async getMessageContents(serviceID: number, messageID: number) {
        let message = "";

        let [err, chunkLength, chunk] = await this.adapter.typedRPC(
            8,
            0x8011,
            "LHH",
            "BB18s",
            [serviceID, messageID, 0]
        );
        if (err !== 0) {
            throw new ArgumentError(
                "Unknown service or message id, error code = " + err
            );
        }

        chunk = chunk.substring(0, chunkLength);
        message += chunk;

        while (chunkLength > 0) {
            [err, chunkLength, chunk] = await this.adapter.typedRPC(
                8,
                0x8011,
                "LHH",
                "BB18s",
                [serviceID, messageID, message.length]
            );

            if (err !== 0) {
                throw new ArgumentError(
                    "Unknown service or message id, error code = " + err
                );
            }

            chunk = chunk.substring(0, chunkLength);
            message += chunk;
        }

        return message;
    }

    private async getNetworks(
        iface: number,
        scanTime: number
    ): Promise<string[]> {
        const networks = [];

        await this.connected.wait();

        try {
            await this.showLoading("Scanning for Networks...");

            const [count] = await this.adapter.typedRPC(
                8,
                0x8000,
                "LB",
                "L",
                [scanTime, iface],
                scanTime + 15.0
            );

            for (let i = 0; i < count; ++i) {
                // tslint:disable-next-line: prefer-const
                let [length, name] = await this.adapter.typedRPC(
                    8,
                    0x8001,
                    "L",
                    "H18s",
                    [i],
                    1.0
                );
                name = name.substring(0, length);
                networks.push(name);
            }
        } finally {
            await this.hideLoading();
        }

        return networks;
    }

    private async pollNetworkStatus(index: number) {
        await this.connected;

        const [
            iface,
            res1,
            res2,
            res3,
            ip,
            gateway,
            netmask,
            dns
        ] = await this.adapter.typedRPC(
            8,
            0x8008,
            "B",
            "BBBBLLLL",
            [index],
            90.0
        );

        return ip !== 0;
    }

    private ipToNumber(ip: string) {
        if (this.validateIPAddress(ip) !== true) {
            throw new ArgumentError("invalid ip address in ipToNumber: " + ip);
        }

        const parts = ip.split(".");

        let q1 = parseInt(parts[0], 10);
        let q2 = parseInt(parts[1], 10);
        let q3 = parseInt(parts[2], 10);
        let q4 = parseInt(parts[3], 10);
        q1 = Math.floor(q1);
        q2 = Math.floor(q2);
        q3 = Math.floor(q3);
        q4 = Math.floor(q4);

        return (q1 << 24) | (q2 << 16) | (q3 << 8) | q4;
    }

    private validateIPAddress(ip: string) {
        const parts = ip.split(".");
        if (parts.length !== 4) {
            return false;
        }

        let q1 = parseInt(parts[0], 10);
        let q2 = parseInt(parts[1], 10);
        let q3 = parseInt(parts[2], 10);
        let q4 = parseInt(parts[3], 10);

        if (isNaN(q1) || isNaN(q2) || isNaN(q3) || isNaN(q4)) {
            return false;
        }

        q1 = Math.floor(q1);
        q2 = Math.floor(q2);
        q3 = Math.floor(q3);
        q4 = Math.floor(q4);

        if (q1 < 0 || q1 > 255) {
            return false;
        }

        if (q2 < 0 || q2 > 255) {
            return false;
        }

        if (q3 < 0 || q4 > 255) {
            return false;
        }

        if (q4 < 0 || q4 > 255) {
            return false;
        }

        return true;
    }

    /*
     * Check if the information currently entered in the modal interface
     * config is valid and we can allow them to click the connect button
     */
    private checkConnectInterface(iface: GatewayInterface) {
        // If it's a wireless network you need to select a network
        if (iface.wireless && !this.selectedNetwork) {
            return false;
        }

        // If we're using DHCP we always good
        if (this.modalInterfaceConfig.useStatic === false) {
            return true;
        }

        // Otherwise make sure there's a valid ip in each box
        if (
            this.validateIPAddress(this.modalInterfaceConfig.staticIP) === false
        ) {
            return false;
        }

        if (
            this.validateIPAddress(this.modalInterfaceConfig.netmask) === false
        ) {
            return false;
        }

        if (
            this.validateIPAddress(this.modalInterfaceConfig.gateway) === false
        ) {
            return false;
        }

        if (this.validateIPAddress(this.modalInterfaceConfig.dns) === false) {
            return false;
        }

        return true;
    }

    private async shareToken() {
        const token: string = this.User.getToken();

        if (token === "") {
            throw new UnknownKeyError(
                "No JWT token that could be shared with gateway."
            );
        }

        // Clear whatever partial token might be stored on the device
        await this.adapter.errorHandlingRPC(8, 0x8005, "BB18s", "L", [
            0,
            0,
            ""
        ]);

        for (let i = 0; i < token.length; i += 18) {
            const chunk = token.substring(i, i + 18);
            await this.adapter.errorHandlingRPC(8, 0x8005, "BB18s", "L", [
                chunk.length,
                i,
                chunk
            ]);
        }

        await this.adapter.errorHandlingRPC(8, 0x8006, "", "L", []);
    }
}

angular.module("main").controller("gatewayCtrl", GatewayController as any);
