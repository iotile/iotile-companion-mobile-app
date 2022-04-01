/*
 * Test Project Data
 * id: test-1
 * devices: B6
 * variable: 5001
 * description: Stream 5001 has null input and output units that should resolve the correct variable
 *              units.
 *
 */

import * as IOTileCloudModule from "@iotile/iotile-cloud";
import { TestCloudInformation } from "./types";

export function createTest1Project(): TestCloudInformation {
    const proj: IOTileCloudModule.Project = new IOTileCloudModule.Project(
        test_proj
    );
    proj.addDevices([new IOTileCloudModule.Device(deviceB6)]);
    proj.addVariable(new IOTileCloudModule.Variable(var5003));
    proj.addStream(new IOTileCloudModule.Stream(stream5003));
    proj.addSensorGraph(
        new IOTileCloudModule.SensorGraph(sg_double_moisture_1_1_0)
    );

    const vartype = new IOTileCloudModule.VarType(soil_moisture_percent);
    const project_template = new IOTileCloudModule.ProjectTemplate(
        default_template
    );

    return {
        projects: [proj],
        vartypes: [vartype],
        project_templates: [project_template]
    };
}

const sg_double_moisture_1_1_0 = {
    id: 3,
    name: "Double Soil Moisture",
    slug: "double-soil-moisture-v1-1-0",
    org: "arch-systems",
    project_template: null,
    variable_templates: [],
    display_widget_templates: [],
    ui_extra: {
        mobile: {
            ioInfo: {
                map: {
                    "5003": {
                        label: "IO 1",
                        settingsTemplate: "default-settings",
                        settingsController: "defaultSettingsCtrl"
                    }
                },
                order: ["5003"]
            },
            template: "default",
            controller: "defaultCtrl",
            other: null
        }
    },
    major_version: 1,
    minor_version: 0,
    patch_version: 0,
    created_on: "2017-01-26T06:26:21.206491Z"
};

const var5003 = {
    id: "45af436b-4551-47e4-b893-6b794587781d",
    name: "IO 1",
    lid: 20483,
    var_type: "soil-moisture-percent",
    input_unit: {
        slug: "in--soil-moisture-percent--percent",
        unit_full: "Percent",
        unit_short: "%",
        m: 100,
        d: 4095,
        o: 0.0
    },
    output_unit: {
        slug: "out--soil-moisture-percent--percent",
        unit_full: "Percent",
        unit_short: "%",
        m: 1,
        d: 1,
        o: 0.0,
        decimal_places: 1,
        derived_units: {}
    },
    derived_variable: null,
    project: "test-1",
    org: "arch-internal",
    about: "",
    created_on: "2017-04-26T21:09:59.693387Z",
    type: "N/A",
    raw_value_format: "<L",
    units: "",
    multiplication_factor: 1,
    division_factor: 1,
    offset: 0.0,
    decimal_places: 2,
    mdo_label: "",
    web_only: false,
    app_only: false,
    slug: "v--0000-0054--5003"
};

const stream5003 = {
    id: "85952a17-ca0b-470e-a283-b6b2af8504f7",
    project_id: "test-1",
    project: "p--0000-0054",
    device: "d--0000-0000-0000-00b6",
    variable: "v--0000-0054--5003",
    data_label: "IO 1",
    input_unit: null,
    output_unit: null,
    raw_value_format: "<L",
    mdo_type: "S",
    mdo_label: "",
    multiplication_factor: 100,
    division_factor: 4095,
    offset: null,
    org: "arch-internal",
    created_on: "2017-04-20T23:33:29.182704Z",
    slug: "s--0000-0054--0000-0000-0000-00b6--5003",
    type: "Num",
    enabled: true
};

const deviceB6 = {
    id: 182,
    slug: "d--0000-0000-0000-00b6",
    gid: "0000-0000-0000-00b6",
    label: "Dracaena Lisa (00b6)",
    active: true,
    firmware_versions: [],
    sg: "double-soil-moisture-v1-1-0",
    template: "1d1p2bt101es-v2-0-0",
    org: "arch-internal",
    project: "test-1",
    lat: "37.406285",
    lon: "-122.109335",
    created_on: "2016-11-09T15:47:39.918383Z"
};

const soil_moisture_percent = {
    name: "Soil Moisture Percent",
    slug: "soil-moisture-percent",
    available_input_units: [
        {
            slug: "in--soil-moisture-percent--ec-5",
            unit_full: "EC-5",
            unit_short: "%",
            m: 5908,
            d: 40950,
            o: -67.5
        },
        {
            slug: "in--soil-moisture-percent--percent",
            unit_full: "Percent",
            unit_short: "%",
            m: 100,
            d: 4095,
            o: 0.0
        }
    ],
    available_output_units: [
        {
            slug: "out--soil-moisture-percent--percent",
            unit_full: "Percent",
            unit_short: "%",
            m: 1,
            d: 1,
            o: 0.0,
            decimal_places: 1,
            derived_units: {}
        }
    ],
    storage_units_full: "Percent",
    storage_units_short: "%"
};

const default_template = {
    id: 2,
    name: "Default Template",
    slug: "default-template-v1-0-0",
    org: "arch-systems",
    version: "v1.0.0",
    extra_data: {
        web: {
            projectTemplateSlug: "default"
        }
    },
    created_on: "2017-01-22T22:50:24.512275Z"
};

const test_proj = {
    id: "test-1",
    name: "Gateway Managed Office Plants",
    slug: "p--0000-0054",
    gid: "0000-0054",
    org: "arch-internal",
    about:
        "This project contains office plant devices whose data are managed by our MVP gateway.  Users should not collect data with their phones from these plants.",
    project_template: "default-template-v1-0-0",
    page: {
        label: "Default",
        slug: "default",
        id: 1
    },
    created_on: "2017-02-08T00:49:52.533023Z",
    created_by: "tim"
};
