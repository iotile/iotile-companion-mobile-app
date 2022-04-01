import { ServerInformation } from "@iotile/iotile-cloud";
import { ArgumentError } from "@iotile/iotile-common";
import { StandardJig } from "../../../ng-iotile-app/helpers/standard-jig";

import { SelectServerModal } from "../../../../app/main/controllers/modals/select-server-modal";
import "../../../../app/main/main";

describe("SelectServerModal", function() {
    const jig = new StandardJig();
    jig.mockModule("main");
    const args: ServerInformation[] = [
        {
            shortName: "LOCALHOST",
            longName: "Local Server",
            url: "/proxy/api/v1"
        },
        {
            shortName: "STAGE",
            longName: "Proxy Staging Server",
            url: "/proxy_stage/api/v1"
        },
        {
            shortName: "PRODUCTION",
            longName: "Proxy Production Server",
            url: "/proxy_prod/api/v1",
            default: true
        }
    ];

    jig.modal_it(
        "should allow injecting servers and return data",
        SelectServerModal,
        [],
        async function(modal: SelectServerModal) {
            await modal.launch(args);

            expect(modal.selected).toEqual({
                shortName: "PRODUCTION",
                longName: "Proxy Production Server",
                url: "/proxy_prod/api/v1",
                default: true
            });

            modal.closeWithData({
                shortName: "PRODUCTION",
                longName: "Proxy Production Server",
                url: "/proxy_prod/api/v1",
                default: true
            });

            const result = await modal.wait();
            expect(result).toEqual({
                shortName: "PRODUCTION",
                longName: "Proxy Production Server",
                url: "/proxy_prod/api/v1",
                default: true
            });
        }
    );

    jig.modal_it(
        "should return a selected server on save",
        SelectServerModal,
        [],
        async function(modal: SelectServerModal) {
            await modal.launch(args);

            modal.selected = {
                shortName: "PRODUCTION",
                longName: "Proxy Production Server",
                url: "/proxy_prod/api/v1",
                default: true
            };
            modal.onSave();

            const result = await modal.wait();
            expect(result).toEqual({
                shortName: "PRODUCTION",
                longName: "Proxy Production Server",
                url: "/proxy_prod/api/v1",
                default: true
            });
        }
    );

    jig.modal_it(
        "should allow throwing errors",
        SelectServerModal,
        [],
        async function(modal: SelectServerModal) {
            await modal.launch(args);

            modal.closeWithError(new ArgumentError("test message"));
            try {
                await modal.wait();
                expect("Should not reach here").toBeNull(); // Make sure we don't get here
            } catch (err) {
                expect(err instanceof ArgumentError).toBe(true);
                expect(err.message).toEqual("test message");
            }
        }
    );
});
