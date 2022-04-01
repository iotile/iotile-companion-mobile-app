import * as IOTileAppModule from "ng-iotile-app";
import * as TestHelpers from "../../../ng-iotile-app/helpers/standard-jig";

import {
    CreateProjectArgs,
    CreateProjectModal
} from "../../../../app/main/controllers/modals/create-project-modal";
import "../../../../app/main/main";

describe("CreateProjectModal", function() {
    const jig = new TestHelpers.StandardJig();
    jig.mockModule("main");

    jig.modal_it(
        "should initialize properly",
        CreateProjectModal,
        [],
        async function(modal: CreateProjectModal) {
            const orgs = await jig.cache.projectList();
            const args: CreateProjectArgs = { orgs };
            await modal.launch(args);

            expect(modal.orgs.length).toEqual(orgs.length);
            expect(modal.selectedOrg).toBeNull();
            expect(modal.projectName).toBeNull();
        }
    );

    jig.modal_it(
        "should allow cancelling",
        CreateProjectModal,
        [],
        async function(modal: CreateProjectModal) {
            const orgs = await jig.cache.projectList();
            const args: CreateProjectArgs = { orgs };
            await modal.launch(args);

            modal.onCancel();
            const result = await modal.wait();
            expect(result).toBeNull();
        }
    );

    jig.modal_it("should allow saving", CreateProjectModal, [], async function(
        modal: CreateProjectModal
    ) {
        const orgs = await jig.cache.projectList();
        const args: CreateProjectArgs = { orgs };
        await modal.launch(args);

        expect(modal.canSave()).toBe(false);
        modal.selectedOrg = orgs[0];
        expect(modal.canSave()).toBe(false);
        modal.projectName = "abc";
        expect(modal.canSave()).toBe(true);

        // Test 30 character limit on names
        modal.projectName = "sadfsadfabcdffffffffffffffffffa";
        expect(modal.canSave()).toBe(false);
        modal.projectName = "sadfsadfabcdffffffffffffffffff";
        expect(modal.canSave()).toBe(true);

        modal.onSave();

        const result = await modal.wait();
        expect(result).not.toBeNull();
        expect(result.projectName).toEqual("sadfsadfabcdffffffffffffffffff");
        expect(result.projectOrgID).toEqual(orgs[0].slug);
    });
});
