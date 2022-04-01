import {
    DataPoint,
    Device,
    Project,
    SensorGraph,
    Stream
} from "@iotile/iotile-cloud";
import {
    ArgumentError,
    BlockingEvent,
    ControllerBase,
    CorruptDeviceError,
    UISeverity
} from "@iotile/iotile-common";
import {
    AdapterEvent,
    ConnectionCancelledError,
    ConnectionFailedError,
    IndividualReport,
    IOTileAdapter,
    IOTileDevice,
    IOTileReport,
    SignedListReport,
    UserRedirectionInfo
} from "@iotile/iotile-device";
import angular = require("angular");
import { CacheService } from "../cache-serve";
import { RobustReportService } from "../report-serv";

export enum StreamStyle {
    None,
    CloudDefault,
    CustomFunction
}

export type StreamPostprocessor = (
    report: IndividualReport,
    styledValue: string
) => void;
export type StreamHandler = (report: IOTileReport) => void;
export type StreamStyler = (report: IndividualReport) => string;
export type AsyncStreamStyler = (report: IndividualReport) => Promise<string>;

export interface StreamBinding {
    stream: number;
    property: string;
    default: string;
    keepLastValue: boolean;
    style: StreamStyle;
    styleFunction?: StreamStyler | AsyncStreamStyler;
    postProcessor?: StreamPostprocessor;
    watchedBy?: StreamBinding[];
}

export class DeviceBaseController extends ControllerBase {
    protected adapter: IOTileAdapter;
    protected cache: CacheService;
    protected $state;
    protected reportService: RobustReportService;

    protected switchingToSettings: boolean;
    protected slug: string;
    protected device: IOTileDevice;
    protected connected: BlockingEvent;

    // Cloud Data
    protected project: Project;
    protected cloudDevice: Device;
    protected sg: SensorGraph;
    protected streams: { [key: string]: Stream };
    protected allStreamIDs: string[];

    protected streamIDBase: string;

    /*
     * Map of all of the properties of this view that are bound to realtime stream values
     * that are styled with styling functions.
     */
    protected bindings: { [key: number]: StreamBinding };
    private variableIDBase: string;
    private bindingDelegate: StreamHandler;
    private bindingValues: {
        [key: number]: { displayValue: string; rawValue: number };
    };
    private removeSubscriptionHandler;
    private removeDisconnectHandler;
    private removeConnectionStartedHandler;
    private removeConnectionFinishedHandler;
    private removeInterruptionHandler;
    private removeReportHandler;

    constructor(name: string, slug: string, $injector, $scope: ng.IScope) {
        super(name, $injector, $scope);

        this.adapter = $injector.get("IOTileAdapter");
        this.$state = $injector.get("$state");
        this.cache = $injector.get("CacheService");
        this.reportService = $injector.get("RobustReportService");

        this.bindings = {};
        this.bindingDelegate = null;
        this.bindingValues = {};
        this.removeDisconnectHandler = null;
        this.removeSubscriptionHandler = null;
        this.removeReportHandler = null;
        this.removeInterruptionHandler = null;

        this.switchingToSettings = false;
        this.slug = slug;
        this.device = null;
        this.connected = new BlockingEvent();

        this.project = null;
        this.cloudDevice = null;
        this.sg = null;
        this.streams = {};
        this.allStreamIDs = [];
        this.streamIDBase = null;
        this.variableIDBase = null;
    }

    public buildStreamID(lid: string | number) {
        if (typeof lid === "number") {
            lid = lid.toString(16);
        }

        if (lid.length !== 4) {
            this.log_error(
                "Invalid variable local id in buildStreamID: " + lid
            );
        }

        return [this.streamIDBase, lid.toLowerCase()].join("--");
    }

    public buildVariableID(lid: string | number) {
        if (typeof lid === "number") {
            lid = lid.toString(16);
        }

        if (lid.length !== 4) {
            this.log_error(
                "Invalid variable local id in buildVariableID: " + lid
            );
        }

        return [this.variableIDBase, lid.toLowerCase()].join("--");
    }

    public getUnits(id: string | number, short: boolean = true): string {
        let streamID: string;

        if (typeof id === "number" || id.length === 4) {
            streamID = this.buildStreamID(id);
        } else {
            streamID = id;
        }

        const stream = this.streams[streamID];
        if (stream == null) {
            return "...";
        }

        // If a stream has no units, they default to the units of the variable
        const outputUnits = this.project.getOutputUnits(stream);
        if (outputUnits == null) {
            return "...";
        }

        // include a space between reading and units, unless unit is percentage
        if (short) {
            if (outputUnits.shortName.includes("%")) {
                return outputUnits.shortName;
            } else if (outputUnits.shortName === "") {
                return "";
            } else {
                return " " + outputUnits.shortName;
            }
        }

        if (outputUnits.fullName.includes("%")) {
            return outputUnits.fullName;
        } else {
            return " " + outputUnits.fullName;
        }
    }

    public async showLocallyModifiedInfo() {
        await this.alert(
            "Local Settings",
            "<p>This page shows data using settings that are only on your phone.</p><p>You can sync these settings with IOTile.cloud by clicking save on the device settings page while online.<p>",
            UISeverity.Warn
        );
    }

    /*
     * Allow specifying the stream that we are binding either as a direct hex number or as a stream id s--{proj}--{device}--{variable}.  The stream id
     * is parsed into an int automatically.
     */
    public bindProperty(
        property: string,
        stream: number | string,
        style: StreamStyle,
        defaultValue: string,
        styleFunction?: StreamStyler | AsyncStreamStyler,
        keepLastValue?: boolean,
        postProcessor?: StreamPostprocessor
    ) {
        if (keepLastValue !== false) {
            keepLastValue = true;
        }

        if (typeof stream === "string") {
            stream = parseInt(stream.substr(stream.length - 4), 16);
        }

        const binding: StreamBinding = {
            stream,
            property,
            style,
            styleFunction,
            keepLastValue,
            default: defaultValue,
            postProcessor
        };

        if (style === StreamStyle.CustomFunction && !styleFunction) {
            throw new ArgumentError(
                "bindProperty called with custom styling and no styling function, property: " +
                    property
            );
        }

        if (stream in this.bindings) {
            throw new ArgumentError(
                "bindProperty called twice on the same property: " + property
            );
        }

        this.bindings[stream] = binding;
    }

    // NB: Currently, stream wrappers MUST be postProcessed; see this.processStream()
    public bindWrapper(
        property: string,
        stream: number | string,
        style: StreamStyle,
        defaultValue: string,
        styleFunction?: StreamStyler | AsyncStreamStyler,
        keepLastValue?: boolean,
        postProcessor?: StreamPostprocessor
    ) {
        if (keepLastValue !== false) {
            keepLastValue = true;
        }

        if (typeof stream === "string") {
            stream = parseInt(stream.substr(stream.length - 4), 16);
        }

        const binding: StreamBinding = {
            stream,
            property,
            style,
            styleFunction,
            keepLastValue,
            default: defaultValue,
            postProcessor
        };

        if (style === StreamStyle.CustomFunction && !styleFunction) {
            throw new ArgumentError(
                "bindProperty called with custom styling and no styling function, property: " +
                    property
            );
        }

        if (!(stream in this.bindings)) {
            throw new ArgumentError(
                "bindWrapper called on unregistered stream: " + stream
            );
        }

        // associate the wrapper with the stream to watch
        if (!this.bindings[stream].watchedBy) {
            this.bindings[stream].watchedBy = [];
        }
        this.bindings[stream].watchedBy.push(binding);
    }

    public forceLastValue(
        stream: number | string,
        styled: string,
        raw: number
    ) {
        if (typeof stream === "string") {
            stream = parseInt(stream.substr(stream.length - 4), 16);
        }

        if (!(stream in this.bindingValues)) {
            return;
        }

        this.bindingValues[stream].rawValue = raw;
        this.bindingValues[stream].displayValue = styled;
    }

    public lastValue(
        stream: number | string,
        raw: boolean = false
    ): string | number {
        if (typeof stream === "string") {
            stream = parseInt(stream.substr(stream.length - 4), 16);
        }

        if (!(stream in this.bindingValues)) {
            return null;
        }

        if (raw) {
            return this.bindingValues[stream].rawValue;
        } else {
            return this.bindingValues[stream].displayValue;
        }
    }

    public bindMethod(method: StreamHandler, stream: number) {
        this.bindProperty(
            null,
            stream,
            StreamStyle.CustomFunction,
            null,
            function(report) {
                method(report);
                return "";
            },
            false,
            null
        );
    }

    public bindCallback(
        method: StreamPostprocessor,
        stream: number,
        wrapper: boolean = false
    ) {
        if (wrapper) {
            this.bindWrapper(
                null,
                stream,
                StreamStyle.CloudDefault,
                "Waiting...",
                null,
                false,
                function(report, styledValue) {
                    method(report, styledValue);
                }
            );
        } else {
            this.bindProperty(
                null,
                stream,
                StreamStyle.CloudDefault,
                "Waiting...",
                null,
                false,
                function(report, styledValue) {
                    method(report, styledValue);
                }
            );
        }
    }

    public delegateBindings(method: StreamHandler) {
        this.bindingDelegate = method;
    }

    public async processStream(report: IndividualReport) {
        const stream = report.reading.stream;
        const value = report.reading.value;
        let styledValue: string;

        if (this.bindingDelegate) {
            this.bindingDelegate(report);
        }

        if (!(stream in this.bindings)) {
            return;
        }

        const binding = this.bindings[stream];

        if (binding.style === StreamStyle.None) {
            styledValue = value.toString();
        } else if (binding.style === StreamStyle.CustomFunction) {
            const result = binding.styleFunction(report);
            if (result instanceof Promise) {
                styledValue = await result;
            } else {
                styledValue = result;
            }
        } else if (binding.style === StreamStyle.CloudDefault) {
            let dataPoint = new DataPoint({
                timestamp: report.reading.timestamp,
                int_value: report.reading.value
            });

            const streamID = this.buildStreamID(stream);
            if (this.project && streamID in this.streams) {
                // check if the stream allows negative numbers and we need to recalculate
                if (this.streams[streamID].rawValueFormat === "<l") {
                    report.decodeUsingFormat("<l");
                    dataPoint = new DataPoint({
                        timestamp: report.reading.timestamp,
                        int_value: report.reading.value
                    });
                }

                if (dataPoint.rawValue || dataPoint.value) {
                    const styledDatapoint = this.project.processDataPoint(
                        this.streams[streamID],
                        dataPoint
                    );
                    styledValue = styledDatapoint.displayValue;
                } else {
                    styledValue = binding.default;
                }
            } else if (!(streamID in this.streams)) {
                this.log_info(
                    "Ignoring realtime reading from variable: " +
                        report.reading.variable +
                        " stream: " +
                        streamID
                );
            } else {
                this.log_info(
                    "Ignoring realtime reading because we don't have a project for it"
                );
            }
        } else {
            this.log_error(
                "Unknown stream formatting that is not yet supported: " +
                    binding.style
            );
            return;
        }

        if (binding.postProcessor) {
            binding.postProcessor(report, styledValue);
        }

        if (binding.keepLastValue) {
            this.bindingValues[stream] = {
                displayValue: styledValue,
                rawValue: report.reading.value
            };
        }

        if (binding.property) {
            this[binding.property] = styledValue;
        }

        // if this stream is being watched, inform the watcher
        if (binding.watchedBy) {
            for (const wrapper of binding.watchedBy) {
                wrapper.postProcessor(report, styledValue);
            }
        }

        if (binding.keepLastValue || binding.property) {
            this.$scope.$apply();
        }
    }

    protected async cleanup() {
        if (window.plugins) {
            window.plugins.insomnia.allowSleepAgain();
        }
        try {
            if (this.removeDisconnectHandler) {
                this.removeDisconnectHandler();
                this.removeDisconnectHandler = null;
            }

            if (this.removeSubscriptionHandler) {
                this.removeSubscriptionHandler();
                this.removeSubscriptionHandler = null;
            }

            if (this.removeConnectionFinishedHandler) {
                this.removeConnectionFinishedHandler();
                this.removeConnectionFinishedHandler = null;
            }

            if (this.removeConnectionStartedHandler) {
                this.removeConnectionStartedHandler();
                this.removeConnectionStartedHandler = null;
            }

            if (this.removeReportHandler) {
                this.removeReportHandler();
                this.removeReportHandler = null;
            }

            if (this.removeInterruptionHandler) {
                this.removeInterruptionHandler();
                this.removeInterruptionHandler = null;
            }

            if (!this.switchingToSettings) {
                try {
                    await this.adapter.disconnect();
                } catch (err) {
                    this.log_warn("Error disconnecting", err);
                }
            }
        } catch (err) {
            this.log_error("Error in cleanup handler");
        }
    }

    protected async initialize() {
        // Initialize our own state on each load
        this.switchingToSettings = false;
        this.error = null;
        this.bindings = {};

        if (window.plugins) {
            window.plugins.insomnia.keepAwake();
        }

        /*
         * If we are already connected to this device, don't do
         * anything.  If we are connected to a different device,
         * disconnect first and then connect to this device.
         */
        if (this.adapter.connectedDevice !== null) {
            const dev = this.adapter.connectedDevice;
            if (dev.slug !== this.slug) {
                await this.adapter.disconnect();
            }
        }

        const that = this;

        // Show a loading modal while we are connecting to a device
        this.removeConnectionStartedHandler = this.adapter.subscribe(
            AdapterEvent.ConnectionStarted,
            function(event) {
                that.showLoading("Connecting...", true);
            }
        );
        this.removeConnectionFinishedHandler = this.adapter.subscribe(
            AdapterEvent.ConnectionFinished,
            function(event) {
                that.hideLoading();
            }
        );

        // Internal device connection lifecycle events that we want to make sure to catch and handle
        this.removeReportHandler = this.adapter.subscribe(
            AdapterEvent.RawRobustReport,
            function(event, report) {
                that.checkIgnoreReport(report);
            }
        );
        this.removeSubscriptionHandler = this.adapter.subscribe(
            AdapterEvent.RawRealtimeReading,
            function(event, report) {
                that.processStream(report);
            }
        );
        this.removeDisconnectHandler = this.adapter.subscribe(
            AdapterEvent.Disconnected,
            function(event, reason) {
                that.unexpectedDisconnect();
            }
        );
        this.removeInterruptionHandler = this.adapter.subscribe(
            AdapterEvent.StreamingInterrupted,
            function(event, reason) {
                that.streamingInterrupted();
            }
        );

        this.initializeBindings();

        try {
            await this.showLoading("Preparing to Connect...", true);
            await this.loadCloudData();
            await this.preInitialize();
            this.initializeBindings(); // Initialize bindings again in case the subclass added some bindings in preInitialize
            await this.hideLoading();

            /*
             * Before connecting to the device, make sure we tell the robust report service whether or not it should drop all user
             * data from this device because it is in realtime only (drifter) mode.
             */
            if (this.cloudDevice.drifterMode) {
                this.reportService.ignoreReportsFromDevice(
                    this.cloudDevice.slug,
                    0
                );
            } else {
                this.reportService.unignoreReportsFromDevice(
                    this.cloudDevice.slug
                );
            }

            // Only connect if we are not already connected to the device, which can happen
            // when we come back from the settings page
            if (this.adapter.connectedDevice == null) {
                await this.connect(this.slug);
            }

            this.connected.set();
            await this.showLoading("Preparing Device Screen...", true);
            await this.postInitialize();
        } catch (err) {
            /*
             * On errors: show a popup with the error and then go back to the project page
             * If the error is a ConnectionCancelledError, try to go where the error tells us
             * to go.  If we can't connect to the device due to a ble timeout issue, show
             * a nonthreatening message to encourage the user to try again.  These errors are
             * expected and transitory.
             */

            if (err instanceof ConnectionCancelledError) {
                this.log_info(
                    "Peripheral connection attempt cancelled, reason: " +
                        err.message
                );
                this.leaveFromCancellation(err.info);
            } else if (err instanceof ConnectionFailedError) {
                this.log_warn("Connection failed", err.rawError);
                this.leaveFromError(err.message, "Connection Error");
            } else if (err instanceof CorruptDeviceError) {
                this.log_error("Error with device configuration", err);
                this.leaveFromError(err.message, "Configuration Error");
            } else {
                if (typeof err !== "string") {
                    err = JSON.stringify(err);
                }

                this.log_error("Error initializing device", err);
                this.leaveFromError("Error intializing device.");
            }
        } finally {
            this.hideLoading();
        }
    }

    // tslint:disable-next-line: no-empty
    protected async preInitialize() {}

    // tslint:disable-next-line: no-empty
    protected async postInitialize() {}

    protected async loadCloudData() {
        this.project = await this.cache.getActiveProject();
        this.cloudDevice = this.project.getDevice(this.slug);

        this.sg = this.project.getSensorGraph(this.cloudDevice.sensorGraphSlug);
        if (this.sg == null) {
            throw new CorruptDeviceError(
                "This device has an improperly configured sensor graph in iotile.cloud.  Contact Arch."
            );
        }

        this.log_debug("Stream Lids", this.sg.getStreamLids());
        // Get all of the streams listed in this device's sensor graph.  Do not just get all streams that
        // are associated with this device because there could be old streams that have invalid unit information
        // for example, but will never be shown because they are not associated with the current sensor graph.
        this.streams = this.project.streamsForDevice(
            this.cloudDevice.slug,
            true
        );
        this.allStreamIDs = Object.keys(this.streams);

        /*
         * Make sure every stream has correct input and output units
         * NB: It is not required that streams have units defined.
         * If they don't though, their variable must have units defined.
         * project.getInputUnits and getOutputUnits do this hierarchical
         * check.
         */
        for (const streamID in this.streams) {
            const stream = this.streams[streamID];
            const inputUnit = this.project.getInputUnits(stream);
            const outputUnit = this.project.getOutputUnits(stream);
            if (inputUnit == null || outputUnit == null) {
                throw new CorruptDeviceError(
                    "Stream " +
                        stream.slug +
                        " has improperly configured units in iotile.cloud.  Contact Arch."
                );
            }
        }

        this.streamIDBase = ["s", this.project.gid, this.cloudDevice.gid].join(
            "--"
        );
        this.variableIDBase = ["v", this.project.gid].join("--");

        this.log_debug("Project object", this.project);
        this.log_debug("Device object", this.cloudDevice);
        this.log_debug("SensorGraph", this.sg);
        this.log_debug("Streams", this.streams);
    }

    protected async leaveFromCancellation(info: UserRedirectionInfo) {
        // Make sure we hide any modals that might be visible before leaving
        try {
            await this.hideModal();
        } catch (err) {
            this.log_error(err);
        }

        if (!info.userNotified) {
            await this.alert("Connection Cancelled", info.reason);
        }

        let dest = "main.activeProject";

        if (info.redirectState) {
            dest = info.redirectState;
        }

        // NB, we are assuming that every device page is accessed
        // only from the active project page so this is appropriate
        // back state.
        if (dest === "main.activeProject") {
            this.$ionicHistory.goBack();
        } else {
            this.$state.go(dest);
        }
    }

    /*
     * Override the base implementation to always go back to the active project screen
     */
    protected async leaveFromError(
        message: string,
        title: string = "Fatal Error"
    ) {
        await this.hideLoading();

        // Make sure we hide any modals that might be visible before leaving
        try {
            await this.hideModal();
        } catch (err) {
            this.log_error(err);
        }

        await this.alert(title, message, UISeverity.Error);

        this.$state.go("main.activeProject");
    }

    protected async leaveFromDisconnect(message: string) {
        await this.hideLoading();

        // Make sure we hide any modals that might be visible before leaving
        try {
            await this.hideModal();
        } catch (err) {
            this.log_error(err);
        }

        await this.alert("Device Disconnected", message);

        this.$state.go("main.activeProject");
    }

    protected showSettings() {
        this.switchingToSettings = true;
        let template: string = "";
        let controller: string = "";

        const uiExtra = this.sg.getUiExtra("mobile");
        if (uiExtra && uiExtra.settings) {
            template = uiExtra.settings.template;
            controller = uiExtra.settings.controller;
        }

        this.log_debug(
            "Executing $state.go to main.deviceSettings",
            template,
            controller
        );
        this.$state.go("main.deviceSettings", {
            deviceId: this.slug,
            template,
            controller
        });
    }

    /*
     * If we are in drifter mode, we tell RobustReport service to ignore reports as they come in and we automatically acknowledge
     * user reports back to the device immediately so it doesn't keep sending the same data.
     */
    private async checkIgnoreReport(report: SignedListReport) {
        if (
            this.cloudDevice == null ||
            this.cloudDevice.drifterMode === false
        ) {
            return;
        }

        if (this.device == null) {
            this.log_warn(
                "Race condition triggered on device connect where a robust report was received before adapter.connect returned, not autoacknowledging report"
            );
            return;
        }

        // We only ignore user data
        if (report.streamer !== 0) {
            return;
        }

        const highestID = report.readingIDRange[1];

        try {
            if (
                this.adapter.connectedDevice != null &&
                // tslint:disable-next-line: triple-equals
                this.cloudDevice.slug == this.adapter.connectedDevice.slug
            ) {
                this.log_info(
                    "Automatically acknowledging user data since we're in drifter mode, highest ID: " +
                        highestID
                );
                await this.device.acknowledgeStreamerRPC(0, highestID, false);
                await this.device.graphInput(0x3c06, highestID); // system input 1030: kSGDeviceIgnoredData
            }
        } catch (err) {
            this.log_warn(
                "Error auto-acknowledging report back to device",
                err
            );
        }
    }

    private async connect(deviceSlug: string) {
        const that = this;
        this.log_debug("Starting to connect to device: " + deviceSlug);
        this.device = await this.adapter.connectTo(deviceSlug, {
            scanIfNotFound: true
        });
        this.connected.set();
    }

    private initializeBindings() {
        for (const stream in this.bindings) {
            const binding = this.bindings[stream];

            if (binding.keepLastValue) {
                this.bindingValues[stream] = {
                    displayValue: binding.default,
                    rawValue: 0
                };
            }

            if (binding.property) {
                this[binding.property] = binding.default;
            }
        }

        const that = this;
        setTimeout(function() {
            that.$scope.$apply();
        }, 0);
    }

    private async streamingInterrupted() {
        this.log_info(
            "Disconnecting user since they let the app go to sleep while connected to a device."
        );

        try {
            await this.adapter.disconnect();
        } catch (err) {
            this.log_error(
                "Error disconnecting from device after streaming interruption",
                err
            );
        }

        if (this.connected.isSet) {
            await this.leaveFromError(
                "You must keep this app open while connected to a device.  Please reconnect to the device.",
                "Connection Lost"
            );
        }
    }

    private unexpectedDisconnect() {
        if (!this.connected.isSet) {
            this.log_info(
                "Disconnection before connection process finished.  This is usually due to a firmware update."
            );
            return;
        }

        this.log_info("Unexpected disconnection: ", this.device.slug);
        this.leaveFromDisconnect(
            "Connection to device was temporarily lost.  Try connecting again."
        );
    }
}
