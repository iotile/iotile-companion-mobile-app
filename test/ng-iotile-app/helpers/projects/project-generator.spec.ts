import {
    Device,
    Project,
    ProjectTemplate,
    SensorGraph,
    Stream,
    Variable,
    VarType
} from "@iotile/iotile-cloud";
import { ProjectGenerator } from "./project-generator";
import ProjectTemplateList = require("./projecttemplate_master_list.json");
import SGList = require("./sg_master_list.json");
import VarTypeList = require("./vartype_master_list.json");

type JSONlist = any[];

describe("ProjectGenerator", function() {
    let generator: ProjectGenerator;

    beforeEach(function() {
        generator = new ProjectGenerator();
    });

    it("should map the json to VarType objects", function() {
        for (const value of (VarTypeList as any) as JSONlist) {
            const vartype = new VarType(value);
            expect(vartype).not.toBeUndefined();
            expect(vartype instanceof VarType).toEqual(true);
        }
    });

    it("should map the json to ProjectTemplate objects", function() {
        for (const value of (ProjectTemplateList as any) as JSONlist) {
            const pt = new ProjectTemplate(value);
            expect(pt).not.toBeUndefined();
            expect(pt instanceof ProjectTemplate).toEqual(true);
        }
    });

    it("should map the json to SensorGraph objects", function() {
        for (const value of (SGList as any) as JSONlist) {
            const sg = new SensorGraph(value);
            expect(sg).not.toBeUndefined();
            expect(sg instanceof SensorGraph).toEqual(true);
        }
    });

    it("should create a project", function() {
        const project = generator.getProject();
        expect(project).not.toBeUndefined();
        expect(project instanceof Project).toEqual(true);
    });

    it("should be able to add a device", function() {
        generator.addDevice(1, "water-meter-v1-1-0");
        const project = generator.getProject();
        const device1 = project.getDevice("d--0000-0000-0000-0001");
        expect(device1).toBeDefined();
        expect(device1 instanceof Device).toEqual(true);
        expect(device1.sensorGraphSlug).toEqual("water-meter-v1-1-0");
    });

    it("should have variables for the device ", function() {
        generator.addDevice(1, "water-meter-v1-1-0");
        const project = generator.getProject();
        const device1 = project.getDevice("d--0000-0000-0000-0001");
        const vars = generator.variablesForDevice(device1);
        expect(vars[0] instanceof Variable).toEqual(true);
        expect(vars.length).toBe(6);
    });

    it("should have the right number of streams", function() {
        generator.addDevice(1, "water-meter-v1-1-0");
        const project = generator.getProject();
        const device1 = project.getDevice("d--0000-0000-0000-0001");
        const streams = generator.streamsForDevice(device1);
        expect(streams[0] instanceof Stream).toEqual(true);
        expect(streams.length).toBe(6);
    });

    it("should be able to add multiple devices", function() {
        generator.addDevice(1, "water-meter-v1-1-0");
        generator.addDevice(2, "4-420-1-flow-protopod-v1-0-0");

        const project = generator.getProject();

        const device1 = project.getDevice("d--0000-0000-0000-0001");
        expect(device1).toBeDefined();
        expect(device1 instanceof Device).toEqual(true);
        expect(device1.sensorGraphSlug).toEqual("water-meter-v1-1-0");

        const device2 = project.getDevice("d--0000-0000-0000-0002");
        expect(device2).toBeDefined();
        expect(device2 instanceof Device).toEqual(true);
        expect(device2.sensorGraphSlug).toEqual("4-420-1-flow-protopod-v1-0-0");

        // check variables and streams as well
        const vars = generator.variablesForDevice(device1);
        expect(vars[0] instanceof Variable).toEqual(true);
        expect(vars.length).toBe(6);
        const streams = generator.streamsForDevice(device1);
        expect(streams[0] instanceof Stream).toEqual(true);
        expect(streams.length).toBe(6);

        const vars2 = generator.variablesForDevice(device2);
        expect(vars2[0] instanceof Variable).toEqual(true);
        expect(vars2.length).toBe(10);
        const streams2 = generator.streamsForDevice(device2);
        expect(streams2[0] instanceof Stream).toEqual(true);
        expect(streams2.length).toBe(10);
    });

    it("should be able to generate a GID", function() {
        expect(generator.generateProjectGID()).toBeDefined();
        expect(generator.generateProjectGID().length).toBeGreaterThan(7);
    });
});
