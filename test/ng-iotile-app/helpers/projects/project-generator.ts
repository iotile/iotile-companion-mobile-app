import {
    Device,
    Project,
    ProjectTemplate,
    SensorGraph,
    Stream,
    Variable,
    VarType
} from "@iotile/iotile-cloud";
import { ArgumentError, deviceIDToSlug, guid } from "@iotile/iotile-common";
import ProjectTemplateList = require("./projecttemplate_master_list.json");
import SGList = require("./sg_master_list.json");
import VarTypeList = require("./vartype_master_list.json");

type JSONlist = any[];

export class ProjectGenerator {
    public variableTypes: { [key: string]: VarType } = {};
    public projectTemplates: { [key: string]: ProjectTemplate } = {};

    private sensorGraphs: { [key: string]: SensorGraph } = {};

    private devices: Device[] = [];
    private projectTemplate: Project;

    constructor(name?: string, gid?: string) {
        if (name == null) {
            name = "Test Project";
        }

        let id = guid();

        if (gid == null) {
            gid = this.generateProjectGID();
        } else {
            // if we pass in a gid, also set guid to a hard value
            id = "00000000-0000-4000-" + gid + "00000000";
        }

        const projectJSON = {
            id,
            name,
            slug: `p--${gid}`,
            gid,
            org: "arch-test-data",
            about: "This is internally generated test data",
            project_template: "default-template-v1-0-0",
            page: {
                slug: "default",
                label: "Default",
                id: 1
            },
            created_on: "2017-05-16T19:15:58.463647Z",
            created_by: "project_generator"
        };

        this.projectTemplate = new Project(projectJSON);

        for (const value of (VarTypeList as any) as JSONlist) {
            const vartype = new VarType(value);
            this.variableTypes[vartype.slug] = vartype;
        }
        for (const value of (ProjectTemplateList as any) as JSONlist) {
            const project_template = new ProjectTemplate(value);
            this.projectTemplates[project_template.slug] = project_template;
        }
        for (const value of (SGList as any) as JSONlist) {
            const sg = new SensorGraph(value);
            this.sensorGraphs[sg.slug] = sg;
        }
    }

    public addDevice(id: number, sgSlug: string, name?: string) {
        if (!(sgSlug in this.sensorGraphs)) {
            throw new ArgumentError(
                `could not find Sensor Graph by slug: ${sgSlug}`
            );
        }

        if (name == null) {
            name = `Test Device ${id}`;
        }

        const deviceSlug = deviceIDToSlug(id);

        const sg = new SensorGraph(this.sensorGraphs[sgSlug].toJson());

        const deviceJSON = {
            id,
            slug: deviceSlug,
            gid: deviceSlug.substr(3),
            label: name,
            active: true,
            firmware_versions: [],
            sg: sg.slug,
            template: "1d1p2bt103-v3-0-0",
            org: "arch-internal",
            project: this.projectTemplate.id,
            lat: null,
            lon: null,
            created_on: "2016-11-04T00:42:34.197512Z"
        };

        const device = new Device(deviceJSON);
        this.projectTemplate.addSensorGraph(sg);
        // Project doesn't have an addDevice, and addDevices overrides the previously
        // existing Device list: we have to add them all again with each new addition
        this.devices.push(device);
        this.projectTemplate.addDevices(this.devices);

        const variables = this.variablesForDevice(device);
        const streams = this.streamsForDevice(device);

        for (const value of variables) {
            if (this.projectTemplate.getVariable(value.slug) == null) {
                this.projectTemplate.addVariable(value);
            }
        }

        for (const value of streams) {
            this.projectTemplate.addStream(value);
        }
    }

    // Generate variables from variable templates in sensor graph
    public variablesForDevice(device: Device): Variable[] {
        const sg = this.projectTemplate.getSensorGraph(device.sensorGraphSlug);
        const vars: Variable[] = [];

        for (const varTemplate of sg.variableTemplates) {
            const varType = this.variableTypes[varTemplate.var_type];
            if (varType == null) {
                throw new ArgumentError(
                    `Could not find variable type ${varTemplate.var_type}`
                );
            }

            let inputUnit = varType.getInputUnitForSlug(
                varTemplate.default_input_unit
            );
            let outputUnit = varType.getOutputUnitForSlug(
                varTemplate.default_output_unit
            );
            inputUnit = (inputUnit ? inputUnit.toJson() : null) as any;
            outputUnit = (outputUnit ? outputUnit.toJson() : null) as any;
            const variableJSON = {
                id: guid(),
                name: `Variable ${varTemplate.lid_hex}`,
                lid: parseInt(varTemplate.lid_hex, 16),
                var_type: varTemplate.var_type,
                input_unit: inputUnit,
                output_unit: outputUnit,
                derived_variable: null,
                project: this.projectTemplate.id,
                org: this.projectTemplate.orgSlug,
                about: `Test Variable ${varTemplate.lid_hex}`,
                created_on: "2016-11-04T00:48:37.453225Z",
                type: "N/A",
                raw_value_format: "<L",
                units: "",
                multiplication_factor: varTemplate.m,
                division_factor: varTemplate.d,
                offset: varTemplate.o,
                decimal_places: 0,
                mdo_label: "",
                web_only: varTemplate.web_only,
                app_only: varTemplate.app_only,
                slug: `v--${this.projectTemplate.gid}--${varTemplate.lid_hex}`
            };

            const variable = new Variable(variableJSON);
            vars.push(variable);
        }

        return vars;
    }

    public getProject() {
        const project = Project.Unserialize(this.projectTemplate.serialize());
        return project;
    }

    public streamsForDevice(device: Device): Stream[] {
        const sg = this.projectTemplate.getSensorGraph(device.sensorGraphSlug);
        const streams: Stream[] = [];

        for (const varTemplate of sg.variableTemplates) {
            const varType = this.variableTypes[varTemplate.var_type];
            if (varType == null) {
                throw new ArgumentError(
                    `Could not find variable type ${varTemplate.var_type}`
                );
            }

            const streamJSON = {
                id: guid(),
                project_id: this.projectTemplate.id,
                project: this.projectTemplate.slug,
                device: device.slug,
                variable: `v--${this.projectTemplate.gid}--${
                    varTemplate.lid_hex
                }`,
                data_label: "",
                input_unit: varType.availableInputUnits[0],
                output_unit: varType.availableOutputUnits[0],
                raw_value_format: "<L",
                mdo_type: "S",
                mdo_label: "",
                multiplication_factor: 1,
                division_factor: 1,
                offset: 0.0,
                org: this.projectTemplate.orgSlug,
                created_on: "2017-06-22T20:10:10.606357Z",
                slug: `s--${this.projectTemplate.gid}--${device.gid}--${
                    varTemplate.lid_hex
                }`,
                type: "Num",
                enabled: true
            };

            const stream = new Stream(streamJSON);
            streams.push(stream);
        }

        return streams;
    }

    public generateProjectGID(): string {
        const id = Math.floor(Math.random() * (0xffffffff + 1)); // generate a random int in [0, 0xFFFFFFFF];
        let idString = id.toString(16).toLowerCase();

        while (idString.length < 8) {
            idString = "0" + idString;
        }

        return idString.substr(0, 4) + "-" + idString.substr(4);
    }
}
