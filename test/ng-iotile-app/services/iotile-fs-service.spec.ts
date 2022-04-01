import {
    DATA_DIRECTORY,
    FileSystemService,
    MockCordovaFile
} from "ng-iotile-app";
import * as TestHelpers from "../helpers/standard-jig";

describe("module: iotile.app, service: FileSystemService", function() {
    let FileSystemService: FileSystemService;
    let MockFilePlugin: MockCordovaFile;
    const jig = new TestHelpers.StandardJig();

    // Prevent user and report services from initializing and using the filesystem
    jig.mockUserService();
    jig.mockReportService();
    jig.mockCacheService();

    beforeEach(inject(function(_FileSystemService_, _MockCordovaFile_) {
        FileSystemService = _FileSystemService_;
        MockFilePlugin = _MockCordovaFile_;
        MockFilePlugin.clear("/");
    }));

    it("should allow creating and checking directories for existence", async function(done) {
        try {
            expect(await FileSystemService.checkDirectory("test_dir")).toBe(
                false
            );
        } catch (err) {
            done.fail(err);
            return;
        }

        try {
            await FileSystemService.createDirectory("test_dir");
            expect(await FileSystemService.checkDirectory("test_dir")).toBe(
                true
            );

            try {
                await FileSystemService.createDirectory("test_dir");
                done.fail(
                    "Error should have been thrown creating a directory twice"
                );
            } catch (err) {
                done();
            }
        } catch (err) {
            done.fail("Failed to create directory: code = " + err.code);
        }
    });

    it("should allow creating and removing directories", async function(done) {
        try {
            await FileSystemService.createDirectory("test_dir");
            await FileSystemService.createDirectory("test_dir/test_dir2");
            expect(Object.keys(MockFilePlugin.files).length).toBe(3);

            await FileSystemService.removeDirectory("test_dir");
            expect(Object.keys(MockFilePlugin.files).length).toBe(1);
            done();

            try {
                await FileSystemService.removeDirectory("test_dir/test_dir2");
                done.fail(
                    "This call should throw since the parent directory was removed"
                );
            } catch (err) {}

            try {
                await FileSystemService.removeDirectory("test_dir");
                done.fail(
                    "This call should throw since the directory does not exist"
                );
            } catch (err) {}
        } catch (err) {
            done.fail(
                "Failure creating and removing directories: code = " + err.code
            );
        }
    });

    it("should allow creating files", async function(done) {
        try {
            expect(await FileSystemService.checkFile("test_file")).toBe(false);
            await FileSystemService.writeFile(
                "test_file",
                new Blob([new ArrayBuffer(64)], {
                    type: "application/octet-stream"
                })
            );
            expect(await FileSystemService.checkFile("test_file")).toBe(true);
            const data = await FileSystemService.readFile("test_file");

            expect(data.byteLength).toBe(64);
            done();
        } catch (err) {
            done.fail(err);
        }
    });

    it("should error on reading a nonexistent file", async function(done) {
        try {
            await FileSystemService.readFile("test_file");
            done.fail("An error should have been thrown.");
        } catch (err) {
            done();
        }
    });

    it("should allow reading and writing JSON files", async function(done) {
        try {
            await FileSystemService.writeJSONFile("test.json", {
                test1: 1,
                test2: "hello"
            });
            const obj: any = await FileSystemService.readJSONFile("test.json");

            expect(obj.test1).toBe(1);
            expect(obj.test2).toBe("hello");

            done();
        } catch (err) {
            done.fail(err);
        }
    });

    it("should allow listing directory contents", async function(done) {
        try {
            await FileSystemService.writeJSONFile("report_test", {});

            await FileSystemService.createDirectory("reports");

            let entries = await FileSystemService.listDirectory("reports");
            expect(entries.length).toBe(0);

            await FileSystemService.writeJSONFile("reports/test", {});
            await FileSystemService.writeJSONFile("reports/test2", {});

            entries = await FileSystemService.listDirectory("reports");
            expect(entries.length).toBe(2);

            done();
        } catch (err) {
            done.fail(err);
        }
    });

    it("should allow deleting directory contents", async function(done) {
        try {
            await FileSystemService.createDirectory("reports");
            await FileSystemService.createDirectory("reports/test");
            await FileSystemService.writeJSONFile("reports/test1", {});
            await FileSystemService.writeJSONFile("reports/test2", {});
            await FileSystemService.writeJSONFile("reports/test3", {});
            await FileSystemService.writeJSONFile("reports/test4", {});

            let entries = await FileSystemService.listDirectory("reports");
            expect(entries.length).toBe(5);

            await FileSystemService.removeFilesInDirectory("reports");
            entries = await FileSystemService.listDirectory("reports");
            expect(entries.length).toBe(1);

            done();
        } catch (err) {
            done.fail(err);
        }
    });

    it("should allow saving temporary files", async function(done) {
        try {
            const contents = new Uint8Array([1, 2, 3, 4, 5]);

            const filePath = await FileSystemService.createTemporaryFile(
                "knownext",
                contents.buffer as ArrayBuffer
            );
            expect(filePath).toMatch(/.*\.knownext$/);

            const readContents = await FileSystemService.readFile(
                filePath,
                DATA_DIRECTORY
            );
            expect(contents).toEqual(new Uint8Array(readContents));

            done();
        } catch (err) {
            done.fail(err);
        }
    });
});
