import * as IOTileCloudModule from "@iotile/iotile-cloud";
import * as Errors from "@iotile/iotile-common";
import { createTest1Project } from "./mock-proj-test1";
import { TestCloudInformation } from "./types";

function buildMap() {
    const data: { [key: string]: TestCloudInformation } = {};

    data["test-1"] = createTest1Project();

    return data;
}
export function getProject(name: string) {
    const data = buildMap();

    if (!(name in data)) {
        throw new Errors.ArgumentError("Unknown mock project name: " + name);
    }

    return data[name];
}
