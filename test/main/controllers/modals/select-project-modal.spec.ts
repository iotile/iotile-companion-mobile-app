import * as Errors from "@iotile/iotile-common";
import * as IOTileAppModule from "ng-iotile-app";
import * as TestHelpers from "../../../ng-iotile-app/helpers/standard-jig";

import {
    SelectProjectArgs,
    SelectProjectModal
} from "../../../../app/main/controllers/modals/select-project-modal";
import "../../../../app/main/main";

describe("SelectProjectModal", function() {
    const jig = new TestHelpers.StandardJig();
    jig.mockModule("main");

    jig.modal_it(
        "should allow injecting projects and return data",
        SelectProjectModal,
        [],
        async function(modal: SelectProjectModal) {
            const orgs = await jig.cache.projectList();
            const args: SelectProjectArgs = { orgs, selected: null };
            await modal.launch(args);

            expect(modal.orgs.length).toEqual(orgs.length);
            expect(modal.selectedProjectID).toEqual(null);

            modal.closeWithData("test");

            const result = await modal.wait();
            expect(result).toEqual("test");
        }
    );

    jig.modal_it(
        "should return a selected project on save",
        SelectProjectModal,
        [],
        async function(modal: SelectProjectModal) {
            const orgs = await jig.cache.projectList();
            const args: SelectProjectArgs = { orgs, selected: null };
            await modal.launch(args);

            modal.selectedProjectID = "test2";
            modal.onSave();

            const result = await modal.wait();
            expect(result).toEqual("test2");
        }
    );

    jig.modal_it(
        "should return nothing on cancel",
        SelectProjectModal,
        [],
        async function(modal: SelectProjectModal) {
            const orgs = await jig.cache.projectList();
            const args: SelectProjectArgs = { orgs, selected: null };
            await modal.launch(args);

            modal.selectedProjectID = "test2";
            modal.onCancel();

            const result = await modal.wait();
            expect(result).toBeNull();
        }
    );

    jig.modal_it(
        "should allow throwing errors",
        SelectProjectModal,
        [],
        async function(modal: SelectProjectModal) {
            const orgs = await jig.cache.projectList();
            const args: SelectProjectArgs = { orgs, selected: null };
            await modal.launch(args);

            modal.closeWithError(new Errors.ArgumentError("test message"));
            try {
                await modal.wait();
                expect("Should not reach here").toBeNull(); // Make sure we don't get here
            } catch (err) {
                expect(err instanceof Errors.ArgumentError).toBe(true);
                expect(err.message).toEqual("test message");
            }
        }
    );
});
