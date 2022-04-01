import { IOTileCloud } from "@iotile/iotile-cloud";
import { delay, ServiceBase } from "@iotile/iotile-common";
import { IOTileAdapter, IOTileDevice } from "@iotile/iotile-device";
import angular = require("angular");
import Raven = require("raven-js");
import { FileLocation, FileSystemService } from "./filesystem-serv";
import { Mutex } from "./mutex";
import { UserService } from "./user-serv";

const USAGE_DATA_FILE_NAME: string = "usage_data.json";

interface FirmwareArgs {
    device: string;
    version: string;
}

enum SentryTarget {
    Log = "log",
    Debug = "debug",
    Info = "info",
    Warn = "warn",
    Error = "error"
}

interface SentryArgs {
    target: SentryTarget;
    msg: string;
}

interface NoteArgs {
    msg: string;
}

interface LogEntry {
    user: UserService;
    name: string;
    timestamp: number;
    args: FirmwareArgs | SentryArgs | NoteArgs;
}

export class UsageDataService extends ServiceBase {
    private fs: FileSystemService;
    private log: ng.ILogService;
    private user: UserService;
    private fsMutex: Mutex;
    private cloud: IOTileCloud;
    private net;

    constructor(
        $injector,
        FileSystemService,
        User,
        $log,
        IOTileCloud,
        NetService
    ) {
        super("UsageDataService", $injector);

        this.fsMutex = new Mutex();
        this.log = $log;
        this.user = User;
        this.fs = FileSystemService;
        this.cloud = IOTileCloud;
        this.net = NetService;

        this.beginInitialization();
    }

    // Synchronous wrapper for logEvent, handle promise rejection
    public logEventNow(name: string, args) {
        this.logEvent(name, args)
            .then(() => {
                // tslint:disable-next-line: no-console
                console.log(
                    "Successfully logged event ",
                    name,
                    JSON.stringify(args)
                );
            })
            .catch(err => {
                // tslint:disable-next-line: no-console
                console.log(
                    "[UsageDataService] Couldn't log event; Error: ",
                    err
                );
            });
    }

    public async logEvent(name: string, args): Promise<void> {
        await this.initialized;

        const releaseFS = await this.fsMutex.acquire();

        try {
            const data: LogEntry = {
                user: this.user,
                name,
                timestamp: Date.now(),
                args
            };

            try {
                const existing_data: any = await this.fs.readJSONFile(
                    USAGE_DATA_FILE_NAME
                );
                existing_data.logs.push(data);

                await this.fs.writeJSONFile(
                    USAGE_DATA_FILE_NAME,
                    existing_data
                );
                this.log.info("[UsageDataService] Saved log event to disk");
            } catch (err) {
                this.log.error(
                    "[UsageDataService] Could not save log event to disk"
                );
                throw err;
            }
        } finally {
            releaseFS();
        }
    }

    protected async initialize() {
        await this.prepareFile();

        // Start our infinite background task uploading logs to the cloud
        this.syncToCloud();
    }

    private async prepareFile(): Promise<void> {
        await this.user.initialized;
        await this.cloud.initialized;

        try {
            if (!(await this.fs.checkFile(USAGE_DATA_FILE_NAME))) {
                await this.fs.writeJSONFile(USAGE_DATA_FILE_NAME, { logs: [] });
            }
        } catch (err) {
            this.log.error(
                "[UsageDataService] Could not check or create usage data file",
                err
            );
            throw err;
        }
    }

    private async postLogEntry(log): Promise<{} | void> {
        try {
            if (log.name === "firmware") {
                return await this.cloud.postFirmwareUpgrade(
                    log.args.device,
                    log.args.version
                );
            } else if (log.name === "sentry" && log.args.target === "error") {
                // NB: Sentry only currently tracks errors [see main.route.ts]
                return this.log.error(log.args.msg);
            } else {
                // FIXME: add Notes support
                return;
            }
        } catch (err) {
            return err;
        }
    }

    private async syncToCloud() {
        await this.initialized;

        while (true) {
            await delay(5000);

            if (!this.net.isOnline() || !this.user.isAuthenticated()) {
                continue;
            }

            const failed = [];

            const releaseFS = await this.fsMutex.acquire();

            try {
                const data: any = await this.fs.readJSONFile(
                    USAGE_DATA_FILE_NAME
                );

                for (const log in data.logs) {
                    const success = await this.postLogEntry(log);

                    if (success instanceof Error) {
                        failed.push(log);
                    }
                }

                await this.fs.writeJSONFile(USAGE_DATA_FILE_NAME, failed);
            } catch (err) {
                this.log.error(
                    "[UsageDataService] Unhandled error in syncToCloud",
                    err
                );
            } finally {
                releaseFS();
            }
        }
    }
}

angular.module("iotile.app").service("UsageDataService", UsageDataService);
