/**
 * A typescript-logging implementation that saves messages locally and pushes to sentry.
 */

import Raven = require("raven-js");
import {
    AbstractCategoryLogger,
    Category,
    CategoryLogMessage,
    ErrorType,
    LogLevel,
    RuntimeSettings
} from "typescript-logging";

export interface LogMessage {
    level: Raven.LogLevel;
    timestamp: Date;
    arguments: any[];
    message: string;
    error: Error | null;
    sentry: object;
    category: string;
}

class LazyLogMessage implements LogMessage {
    private _msg: CategoryLogMessage;
    private _sentry: object | null;
    private _args: any[] | null;
    constructor(msg: CategoryLogMessage) {
        this._msg = msg;
        this._sentry = null;
        this._args = null;
    }

    get timestamp(): Date {
        return this._msg.date;
    }

    get category(): string {
        return this._msg.categories[0].name;
    }

    get level(): Raven.LogLevel {
        return getRavenLevel(this._msg.level);
    }

    get arguments(): any[] {
        if (this._args == null) {
            this._args = this.extractArgs(this._msg);
        }

        return this._args;
    }

    get sentry(): {} {
        if (this._sentry == null) {
            this._sentry = this.extractSentry(this._msg);
        }

        return this._sentry;
    }

    get message(): string {
        return this._msg.messageAsString;
    }

    get error(): Error | null {
        return this._msg.error;
    }

    protected extractArgs(msg: CategoryLogMessage): any[] {
        let args: any[] = [];

        if (msg.logData != null && msg.logData.data != null) {
            const data = msg.logData.data;

            if (Array.isArray(data)) {
                args = data;
            } else if (typeof data === "object") {
                args = [data];
            } else {
                args = [data];
            }
        }

        return args;
    }

    protected extractSentry(msg: CategoryLogMessage): {} {
        let sentryObject = {} as any;

        if (msg.logData != null && msg.logData.data != null) {
            const data = msg.logData.data;

            if (Array.isArray(data)) {
                const stringArgs = convertArgsToString(data);
                let i = 1;
                for (const arg of stringArgs) {
                    sentryObject[`arg${i}`] = arg;
                    i++;
                }
            } else if (typeof data === "object") {
                sentryObject = data;
            } else {
                sentryObject.arg1 = convertArgsToString([data]);
            }
        }

        return sentryObject;
    }
}

// tslint:disable-next-line: max-classes-per-file
export class SentryLogger extends AbstractCategoryLogger {
    public static stack: LogMessage[] = [];

    public static disableConsole: boolean = false;
    public static disableSentry: boolean = false;

    constructor(rootCategory: Category, runtimeSettings: RuntimeSettings) {
        super(rootCategory, runtimeSettings);
    }

    protected getLogMethod(level: LogLevel) {
        switch (level) {
            case LogLevel.Trace:
                // tslint:disable: no-console
                return console.log;

            case LogLevel.Debug:
                return console.debug;

            case LogLevel.Info:
                return console.info;

            case LogLevel.Warn:
                return console.warn;

            case LogLevel.Error:
            case LogLevel.Fatal:
                return console.error;

            default:
                throw new Error(`Unsupported level: ${level}`);
        }
    }

    protected doLog(msg: CategoryLogMessage): void {
        const logMessage = new LazyLogMessage(msg);
        const logMethod = this.getLogMethod(msg.level);

        if (!SentryLogger.disableConsole) {
            const args = logMessage.arguments.slice();
            args.unshift(`[${logMessage.category}] ${logMessage.message}`);

            if (logMessage.error != null) {
                args.push(logMessage.error);
            }

            logMethod.apply(console, args);
        }

        if (SentryLogger.stack.length === 50) {
            SentryLogger.stack.shift();
        }

        SentryLogger.stack.push(logMessage);

        if (!SentryLogger.disableSentry) {
            this.sendToSentry(logMessage);
        }
    }

    protected sendToSentry(logMessage: LogMessage) {
        if (logMessage.error != null) {
            Raven.captureException(logMessage.error, {
                extra: {
                    message: logMessage.message,
                    level: logMessage.level,
                    tags: {
                        category: logMessage.category
                    },
                    ...logMessage.sentry
                }
            });
        } else if (logMessage.level === "error") {
            Raven.captureMessage(logMessage.message, {
                extra: logMessage.sentry,
                level: logMessage.level,
                tags: {
                    category: logMessage.category
                }
            });
        }
    }
}

function convertArgsToString(args: any[]): string[] {
    const stringArgs = [];

    for (const arg of args) {
        if (typeof arg === "string") {
            stringArgs.push(arg);
        } else if (typeof arg === "number") {
            stringArgs.push(arg.toString());
        } else if (typeof arg === "boolean") {
            stringArgs.push("" + arg);
        } else if (arg === null) {
            stringArgs.push("null");
        } else if (arg === undefined) {
            stringArgs.push("undefined");
        } else {
            try {
                const strArg = JSON.stringify(arg, null, 4);
                stringArgs.push(strArg);
            } catch (err) {
                stringArgs.push("{Object with circular references}");
            }
        }
    }

    return stringArgs;
}

function getRavenLevel(level: LogLevel): Raven.LogLevel {
    switch (level) {
        case LogLevel.Trace:
        case LogLevel.Debug:
            return "debug";

        case LogLevel.Info:
            return "info";

        case LogLevel.Warn:
            return "warning";

        case LogLevel.Error:
            return "error";

        case LogLevel.Fatal:
            return "critical";

        default:
            throw new Error(`Unsupported level: ${level}`);
    }
}
