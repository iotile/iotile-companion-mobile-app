import { delay } from "@iotile/iotile-common";
import * as IOTileAppModule from "ng-iotile-app";

describe("module: iotile.app, class: Mutex", function() {
    let mutex: IOTileAppModule.Mutex;
    let shared: number[];

    function createRunnable(i: number) {
        return mutex.acquire().then(async function(release) {
            await delay(10 - i);
            shared.push(i);
            release();
        });
    }

    beforeEach(function() {
        mutex = new IOTileAppModule.Mutex();
        shared = [];
    });

    it("should properly block and queue runnables", async function(done) {
        try {
            const promises = [];

            for (let i = 0; i < 10; ++i) {
                promises.push(createRunnable(i));
            }

            await Promise.all(promises);

            expect(shared.length).toBe(10);

            for (let i = 0; i < 10; ++i) {
                expect(shared[i]).toEqual(i);
            }

            done();
        } catch (err) {
            done.fail(err);
        }
    });
});
