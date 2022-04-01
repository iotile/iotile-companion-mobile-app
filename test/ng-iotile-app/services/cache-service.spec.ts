import * as TestHelpers from "../helpers/standard-jig";

describe("module: iotile.app, service: CacheService", function() {
    const jig = new TestHelpers.StandardJig();

    function modifyWaterStreams(stream5001, stream5002) {
        stream5001.dataLabel = "Test Label";
        stream5002.dataLabel = "Hello Label";

        stream5001.mdo.m = 15;
        stream5001.mdo.d = 10;
        stream5001.mdo.o = 100;

        stream5002.mdo.m = 16;
        stream5002.mdo.d = 11;
        stream5002.mdo.o = 101;
    }

    async function verifyWaterStreams(proj, act5001, act5002) {
        // Make sure existing references to streams are updated
        expect(act5001.mdo.m).toEqual(15);
        expect(act5001.mdo.d).toEqual(10);
        expect(act5001.mdo.o).toEqual(100);
        expect(act5001.dataLabel).toEqual("Test Label");

        expect(act5002.mdo.m).toEqual(16);
        expect(act5002.mdo.d).toEqual(11);
        expect(act5002.mdo.o).toEqual(101);
        expect(act5002.dataLabel).toEqual("Hello Label");

        // Make sure the stream in the project is updated
        act5001 = proj.getStream("s--0000-006e--0000-0000-0000-0006--5001");
        act5002 = proj.getStream("s--0000-006e--0000-0000-0000-0007--5002");
        expect(act5001.mdo.m).toEqual(15);
        expect(act5001.mdo.d).toEqual(10);
        expect(act5001.mdo.o).toEqual(100);
        expect(act5001.dataLabel).toEqual("Test Label");

        expect(act5002.mdo.m).toEqual(16);
        expect(act5002.mdo.d).toEqual(11);
        expect(act5002.mdo.o).toEqual(101);
        expect(act5002.dataLabel).toEqual("Hello Label");

        // Reload project from disk to make sure it is persisted
        // and loaded back into the new active project object
        await jig.cache.setActiveProject(
            "04d10130-db9e-452e-a725-5cbb1a1e1ae4"
        );
        act5001 = proj.getStream("s--0000-006e--0000-0000-0000-0006--5001");
        act5002 = proj.getStream("s--0000-006e--0000-0000-0000-0007--5002");
        expect(act5001.mdo.m).toEqual(15);
        expect(act5001.mdo.d).toEqual(10);
        expect(act5001.mdo.o).toEqual(100);
        expect(act5001.dataLabel).toEqual("Test Label");

        expect(act5002.mdo.m).toEqual(16);
        expect(act5002.mdo.d).toEqual(11);
        expect(act5002.mdo.o).toEqual(101);
        expect(act5002.dataLabel).toEqual("Hello Label");

        // Make sure getting the project again has the correct data
        proj = await jig.cache.getActiveProject();
        act5001 = proj.getStream("s--0000-006e--0000-0000-0000-0006--5001");
        act5002 = proj.getStream("s--0000-006e--0000-0000-0000-0007--5002");
        expect(act5001.mdo.m).toEqual(15);
        expect(act5001.mdo.d).toEqual(10);
        expect(act5001.mdo.o).toEqual(100);
        expect(act5001.dataLabel).toEqual("Test Label");

        expect(act5002.mdo.m).toEqual(16);
        expect(act5002.mdo.d).toEqual(11);
        expect(act5002.mdo.o).toEqual(101);
        expect(act5002.dataLabel).toEqual("Hello Label");
    }

    /*
     * To run these tests you must use the async_it jig or you will get very unpredictable results
     */

    jig.async_it("should properly synchronize data to disk", async function() {
        await jig.cache.syncCache();

        const metaEntries = await jig.FileSystemService.listDirectory("meta");
        const projEntries = await jig.FileSystemService.listDirectory(
            "projects"
        );
        expect(metaEntries.length).toEqual(4);
        expect(projEntries.length).toEqual(2);

        projEntries.sort();
        expect(projEntries[0].name).toEqual(
            "04d10130-db9e-452e-a725-5cbb1a1e1ae4.json"
        );
        expect(projEntries[1].name).toEqual(
            "5311e938-1150-4d40-bc66-e2319d112655.json"
        );

        metaEntries.sort();
        expect(metaEntries[0].name).toEqual("project_list.json");
        expect(metaEntries[1].name).toEqual("variable_types.json");
        expect(metaEntries[2].name).toEqual("project_templates.json");
        expect(metaEntries[3].name).toEqual("cache_state.json");
    });

    jig.async_it(
        "should properly synchronize the active project",
        async function() {
            await jig.cache.syncCache();
            await jig.cache.setActiveProject(
                "04d10130-db9e-452e-a725-5cbb1a1e1ae4"
            );
            const proj = await jig.cache.getActiveProject();

            expect(proj.devices.length).toEqual(5);
            expect(proj.hasDevice("d--0000-0000-0000-0005")).toBe(true);

            // Delete one device on the 'cloud'
            jig.cloud.devices = jig.cloud.devices.slice(1);

            // await jig.cloud.wrapHTTP(jig.cache.syncProject('04d10130-db9e-452e-a725-5cbb1a1e1ae4'));
            // let active_proj = await jig.cache.getActiveProject();
            // expect(active_proj.id).toEqual(proj.id);
            // expect(active_proj.devices.length).toEqual(4);
            // expect(active_proj.hasDevice("d--0000-0000-0000-0005")).toBe(false);
        }
    );
});
