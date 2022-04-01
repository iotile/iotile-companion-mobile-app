// Karma configuration
// Generated on Wed Jul 01 2015 13:51:22 GMT+0200 (CEST)

'use strict';

var webpackConfigFunction = require('./webpack.config.js');
var webpackConfig = webpackConfigFunction('test');

//CommonChunksPlugin doesn't work with karma so remove it
webpackConfig.plugins = webpackConfig.plugins.slice(1);

module.exports = function (config) {

  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine'],

    client: {
      captureConsole: true
    },

    browserConsoleLogOptions: {
      terminal: true,
      level: "log"
    },

    /*
     * There must be a single index.spec.ts for all tests since the tests require angular
     * and angular-mocks and if you have multiple entry points, those modules will be loaded
     * multiple times.
     */
    files: [
      'test/index.spec.ts'
    ],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      "test/**/*": ['webpack', 'sourcemap']
    },

    webpack: webpackConfig,
    webpackMiddleware: {
      stats: 'errors-only',
      noInfo: true
    },

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['spec'], //add 'coverage' here

    // web server port
    port: 9876,

    // enable / disable colors in the output (reporters and logs)
    colors: true,

    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,

    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    //browsers: ['PhantomJS', 'Chrome'],
    browsers: ['ChromeDebugging'],

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true,

    mime: { 'text/x-typescript': ['ts','tsx'] },

    customLaunchers: {
      ChromeDebugging: {
        base: 'Chrome',
        flags: ['--remote-debugging-port=9333']
      }
    },
  });
};
