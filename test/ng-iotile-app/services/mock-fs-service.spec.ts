import angular = require("angular");
import * as IOTileAppModule from "ng-iotile-app";
// tslint:disable-next-line
require("angular-mocks/ngMock");

describe("module: main, service: FileSystemService", function() {
    // const FileSystemService: IOTileAppModule.FileSystemService;
    let MockFilePlugin: IOTileAppModule.MockCordovaFile;
    let $timeout;

    beforeEach(function() {
        angular.mock.module("iotile.app");
    });

    beforeEach(inject(function(_MockCordovaFile_, _$timeout_) {
        MockFilePlugin = _MockCordovaFile_;
        MockFilePlugin.clear("/");
        $timeout = _$timeout_;
    }));
});
