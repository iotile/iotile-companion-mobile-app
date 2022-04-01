/*
 * This file is necessary because webpack common chunks plugin is not supported by Karma.
 * This means that if we specify multiple karma entry points, i.e. one per file, we will
 * load angular and angular-mocks multiple times, causing unrecoverable issues.
 *
 * So we need to only have one entry point, which this file provides.
 */

/**
 * Disable logging messages below warnings during testing and make sure we don't try
 * to post anything to sentry.
 */
import {
    CategoryConfiguration,
    CategoryLogFormat,
    CategoryServiceFactory,
    LoggerType,
    LogLevel
} from "typescript-logging";
import { SentryLogger } from "../app/packages/ng-iotile-app";

SentryLogger.disableSentry = true;

const categoryConfig = new CategoryConfiguration(
    LogLevel.Warn,
    LoggerType.MessageBuffer,
    new CategoryLogFormat(),
    (cat, runtime) => new SentryLogger(cat, runtime)
);

CategoryServiceFactory.setDefaultConfiguration(categoryConfig, false);

require("./ng-iotile-app/index.spec.js");
require("./main/index.spec.js");
