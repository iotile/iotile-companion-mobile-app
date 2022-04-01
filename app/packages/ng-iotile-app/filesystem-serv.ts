import {
    ArgumentError,
    BatchOperationError,
    FileSystemError,
    guid,
    joinPath,
    UnknownFileSystemError
} from "@iotile/iotile-common";
import angular = require("angular");
import {
    DirectoryEntry,
    Entry,
    FileEntry,
    MockCordovaFile,
    MockFileTransfer,
    UploadOptions
} from "./mocks/mock-filesystem";

export const DATA_DIRECTORY: "data" = "data";
export const APP_DIRECTORY: "app" = "app";

export type FileLocation = "data" | "app";

/**
 * @ngdoc service
 * @name iotile.app.service:FileSystemService
 */
export class FileSystemService {
    private log;
    private $timeout: ng.ITimeoutService;
    private mock: boolean;

    constructor($log, Config, $injector, $timeout) {
        this.log = $log;
        this.$timeout = $timeout;
        this.mock = Config.FS && Config.FS.MOCK_FS;

        if (this.mock) {
            $log.log(
                "[FileSystemService] Using Mock filesystem implementation."
            );

            // Inject our mock cordova plugin into the window object
            const mockFS: MockCordovaFile = $injector.get("MockCordovaFile");
            window.resolveLocalFileSystemURL = function(path, success, error) {
                return mockFS.resolveLocalFileSystemURL(path, success, error);
            };

            window.FileTransfer = MockFileTransfer;

            // If we're told to have uploads fail, set a global flag
            // so that our upload routine fails.
            if (Config.FS.MOCK_UPLOAD_FAIL) {
                (window as any).globalArchMockFileUploadFail = true;
            }
        }
    }

    public splitFilePath(inputPath: string) {
        const slashLocation = inputPath.lastIndexOf("/");

        if (slashLocation === -1) {
            return ["/", inputPath];
        }

        const parentFolder = inputPath.substring(0, slashLocation + 1);
        const fileName = inputPath.substring(slashLocation + 1);

        return [parentFolder, fileName];
    }

    /**
     * @ngdoc method
     * @name iotile.app.service:FileSystemService#checkDirectory
     * @methodOf iotile.app.service:FileSystemService
     *
     * @description
     * Check if a directory exists.
     *
     * **This is an async method**
     *
     * Returns true if the directory exists, false if it does not and
     * throws a FileSystemError if any error happens.
     *
     * @param {string} directory The name of the directory to check
     * @returns {boolean} True if the directory exists, false if it doesn't
     *      An error is thrown if there is an error accessing the directory.
     */
    public async checkDirectory(
        directory: string,
        location: FileLocation = DATA_DIRECTORY
    ): Promise<boolean> {
        const that = this;

        return new Promise<boolean>(function(resolve, reject) {
            const path = that.createFullPath(directory, location);
            window.resolveLocalFileSystemURL(
                path,
                function(entry: Entry) {
                    if (entry.isDirectory) {
                        resolve(true);
                    } else {
                        reject(
                            new UnknownFileSystemError(
                                UnknownFileSystemError.TYPE_MISMATCH_ERR
                            )
                        );
                    }
                },
                function(err) {
                    if (err.code === UnknownFileSystemError.NOT_FOUND_ERR) {
                        resolve(false);
                    } else {
                        reject(new UnknownFileSystemError(err.code));
                    }
                }
            );
        });
    }

    /**
     * @ngdoc method
     * @name iotile.app.service:FileSystemService#checkFile
     * @methodOf iotile.app.service:FileSystemService
     *
     * @description
     * Check if a file exists.
     *
     * **This is an async method**
     *
     * Returns true if the file exists, false if it does not and
     * throws a FileSystemError if any error happens.
     *
     * @param {string} file The name of the file to check
     * @returns {boolean} True if the file exists, false if it doesn't
     *      An error is thrown if there is an error accessing the file.
     */
    public async checkFile(
        file: string,
        location: FileLocation = DATA_DIRECTORY
    ): Promise<boolean> {
        const that = this;

        return new Promise<boolean>(function(resolve, reject) {
            const path = that.createFullPath(file, location);
            window.resolveLocalFileSystemURL(
                path,
                function(entry: Entry) {
                    if (entry.isFile) {
                        resolve(true);
                    } else {
                        reject(
                            new UnknownFileSystemError(
                                UnknownFileSystemError.TYPE_MISMATCH_ERR
                            )
                        );
                    }
                },
                function(err) {
                    if (err.code === UnknownFileSystemError.NOT_FOUND_ERR) {
                        resolve(false);
                    } else {
                        reject(new UnknownFileSystemError(err.code));
                    }
                }
            );
        });
    }

    /**
     * @ngdoc method
     * @name iotile.app.service:FileSystemService#createDirectory
     * @methodOf iotile.app.service:FileSystemService
     *
     * @description
     * Create a new directory
     *
     * **This is an async method**
     *
     * If the directory already exists, an error is thrown.
     *
     * @param {string} directory The name of the directory to check
     */
    public async createDirectory(
        directory: string,
        location: FileLocation = DATA_DIRECTORY
    ) {
        const that = this;

        return new Promise<void>(function(resolve, reject) {
            directory = that.createFullPath(directory, location);
            const [parentFolder, dirName] = that.splitFilePath(directory);

            window.resolveLocalFileSystemURL(
                parentFolder,
                function(entry: DirectoryEntry) {
                    const options = { create: true, exclusive: true };
                    entry.getDirectory(
                        dirName,
                        options,
                        function(directory) {
                            resolve();
                        },
                        function(err) {
                            reject(
                                new UnknownFileSystemError(
                                    err.code,
                                    entry.fullPath
                                )
                            );
                        }
                    );
                },
                function(err) {
                    reject(new UnknownFileSystemError(err.code, directory));
                }
            );
        });
    }

    /**
     * @ngdoc method
     * @name iotile.app.service:FileSystemService#removeFile
     * @methodOf iotile.app.service:FileSystemService
     *
     * @description
     * Remove a file from the file system
     *
     * **This is an async method**
     *
     * @param {string} file The name of the file to remove
     */
    public async removeFile(
        file: string,
        location: FileLocation = DATA_DIRECTORY
    ) {
        const that = this;

        return new Promise<void>(function(resolve, reject) {
            const path = that.createFullPath(file, location);
            window.resolveLocalFileSystemURL(
                path,
                function(entry: Entry) {
                    if (entry.isFile) {
                        entry.remove(resolve, function(err) {
                            reject(
                                new UnknownFileSystemError(
                                    err.code,
                                    entry.fullPath
                                )
                            );
                        });
                    } else {
                        reject(
                            new UnknownFileSystemError(
                                UnknownFileSystemError.TYPE_MISMATCH_ERR,
                                entry.fullPath
                            )
                        );
                    }
                },
                function(err) {
                    reject(new UnknownFileSystemError(err.code, file));
                }
            );
        });
    }

    /**
     * @ngdoc method
     * @name iotile.app.service:FileSystemService#removeFile
     * @methodOf iotile.app.service:FileSystemService
     *
     * @description
     * Remove a directory and all of its contents from the file system
     *
     * **This is an async method**
     *
     * @param {string} file The name of the directory to remove
     */
    public async removeDirectory(
        file: string,
        location: FileLocation = DATA_DIRECTORY
    ) {
        const that = this;

        return new Promise<void>(function(resolve, reject) {
            const path = that.createFullPath(file, location);
            window.resolveLocalFileSystemURL(
                path,
                function(entry: Entry) {
                    if (entry.isDirectory) {
                        (entry as DirectoryEntry).removeRecursively(
                            resolve,
                            function(err) {
                                reject(
                                    new UnknownFileSystemError(
                                        err.code,
                                        entry.fullPath
                                    )
                                );
                            }
                        );
                    } else {
                        reject(
                            new UnknownFileSystemError(
                                UnknownFileSystemError.TYPE_MISMATCH_ERR,
                                entry.fullPath
                            )
                        );
                    }
                },
                function(err) {
                    reject(new UnknownFileSystemError(err.code, file));
                }
            );
        });
    }

    /**
     * @ngdoc method
     * @name iotile.app.service:FileSystemService#writeFile
     * @methodOf iotile.app.service:FileSystemService
     *
     * @description
     * Write data to a file on the file system.  If the file
     * already exists, it is deleted and recreated.  If the
     * file is created in a subdirectory of the file system,
     * the parent directory must already exist.
     *
     * **This is an async method**
     *
     * @param {string} file The name of the directory to check
     */
    public async writeFile(
        file: string,
        data: Blob,
        location: FileLocation = DATA_DIRECTORY
    ) {
        const that = this;

        return new Promise<void>(function(resolve, reject) {
            const path = that.createFullPath(file, location);
            const [parentFolder, filename] = that.splitFilePath(path);

            window.resolveLocalFileSystemURL(
                parentFolder,
                function(entry: DirectoryEntry) {
                    entry.getFile(
                        filename,
                        { create: true, exclusive: false },
                        function(fileEntry: FileEntry) {
                            fileEntry.createWriter(
                                function(writer) {
                                    writer.onwriteend = function(evt) {
                                        // NB, this is now the writer
                                        if (this.error) {
                                            reject(
                                                new UnknownFileSystemError(
                                                    this.error.code
                                                )
                                            );
                                        } else {
                                            resolve();
                                        }
                                    };

                                    writer.write(data);
                                },
                                function(err) {
                                    reject(
                                        new UnknownFileSystemError(err.code)
                                    );
                                }
                            );
                        },
                        function(err) {
                            reject(new UnknownFileSystemError(err.code));
                        }
                    );
                },
                function(err) {
                    reject(new UnknownFileSystemError(err.code));
                }
            );
        });
    }

    /**
     * @ngdoc method
     * @name iotile.app.service:FileSystemService#writeJSONFile
     * @methodOf iotile.app.service:FileSystemService
     *
     * @description
     * Write an object as a JSON file.
     *
     * **This is an async method**
     *
     * @param {string} file The name of the file to write
     * @param {object} jsonObject The object to serialize and write to a file
     */
    public async writeJSONFile(
        file: string,
        jsonObject: {},
        location: FileLocation = DATA_DIRECTORY
    ) {
        const data = new Blob([JSON.stringify(jsonObject)], {
            type: "application/json"
        });

        return this.writeFile(file, data, location);
    }

    /**
     * @ngdoc method
     * @name iotile.app.service:FileSystemService#readFile
     * @methodOf iotile.app.service:FileSystemService
     *
     * @description
     * Read the data inside a file as an ArrayBuffer
     *
     * **This is an async method**
     *
     * @param {string} file The name of the file to read
     * @returns {ArrayBuffer} The contents of the file.
     */
    public async readFile(
        file: string,
        location: FileLocation = DATA_DIRECTORY
    ) {
        const that = this;

        return new Promise<ArrayBuffer>(function(resolve, reject) {
            const path = that.createFullPath(file, location);
            window.resolveLocalFileSystemURL(
                path,
                function(entry: Entry) {
                    if (entry.isFile) {
                        (entry as FileEntry).file(
                            function(data) {
                                const reader = new FileReader();
                                reader.onloadend = function(evt: any) {
                                    if (
                                        evt.target.result !== undefined ||
                                        evt.target.result !== null
                                    ) {
                                        resolve(evt.target.result);
                                    } else {
                                        reject(
                                            new UnknownFileSystemError(
                                                evt.target.error
                                            )
                                        );
                                    }
                                };

                                reader.readAsArrayBuffer(data);
                            },
                            function(err) {
                                reject(new UnknownFileSystemError(err.code));
                            }
                        );
                    }
                },
                function(err) {
                    reject(new UnknownFileSystemError(err.code));
                }
            );
        });
    }

    /*
     * Remove all files in the given directory.  If there are issues
     * removing any files, an UnknownFileSystemError is thrown with a
     * list of the files that could not be removed.
     */
    public async removeFilesInDirectory(
        directory: string,
        location: FileLocation = DATA_DIRECTORY
    ) {
        const entries = await this.listDirectory(directory, location);
        const failures = [];

        for (const entry of entries) {
            if (!entry.isFile) {
                continue;
            }

            try {
                await this.removeFile(entry.fullPath);
            } catch (err) {
                failures.push(err);
            }
        }

        if (failures.length > 0) {
            throw new BatchOperationError(
                "Error removing files in directory",
                failures
            );
        }
    }

    public async listDirectory(
        directory: string,
        location: FileLocation = DATA_DIRECTORY
    ): Promise<Entry[]> {
        const that = this;

        return new Promise<Entry[]>(function(resolve, reject) {
            const path = that.createFullPath(directory, location);
            window.resolveLocalFileSystemURL(
                path,
                function(entry: Entry) {
                    if (!entry.isFile) {
                        const dirEntry = entry as DirectoryEntry;
                        const reader = dirEntry.createReader();

                        reader.readEntries(
                            function(entries) {
                                resolve(entries);
                            },
                            function(err) {
                                reject(
                                    new UnknownFileSystemError(err.code, path)
                                );
                            }
                        );
                    } else {
                        reject(
                            new UnknownFileSystemError(
                                FileSystemError.TYPE_MISMATCH_ERR,
                                path
                            )
                        );
                    }
                },
                function(err) {
                    reject(new UnknownFileSystemError(err.code, path));
                }
            );
        });
    }

    /**
     * @ngdoc method
     * @name iotile.app.service:FileSystemService#readJSONFile
     * @methodOf iotile.app.service:FileSystemService
     *
     * @description
     * Read the data inside a file as a JSON object.
     * The file must previously have been written as a JSON text
     * file, otherwise this method will throw an exception.
     *
     * **This is an async method**
     *
     * @param {string} file The name of the file to read
     * @returns {object} The contents of the file.
     */
    public async readJSONFile(
        file: string,
        location: FileLocation = DATA_DIRECTORY
    ) {
        const that = this;

        return new Promise<{}>(function(resolve, reject) {
            const path = that.createFullPath(file, location);
            window.resolveLocalFileSystemURL(
                path,
                function(entry: Entry) {
                    if (entry.isFile) {
                        (entry as FileEntry).file(
                            function(data) {
                                const reader = new FileReader();
                                reader.onloadend = function(evt: any) {
                                    if (
                                        evt.target.result !== undefined ||
                                        evt.target.result !== null
                                    ) {
                                        const text = evt.target.result;

                                        try {
                                            const result = JSON.parse(text);
                                            resolve(result);
                                        } catch (err) {
                                            reject(
                                                new UnknownFileSystemError(err)
                                            );
                                        }
                                    } else {
                                        reject(
                                            new UnknownFileSystemError(
                                                evt.target.error
                                            )
                                        );
                                    }
                                };

                                reader.readAsText(data);
                            },
                            function(err) {
                                reject(new UnknownFileSystemError(err.code));
                            }
                        );
                    }
                },
                function(err) {
                    reject(new UnknownFileSystemError(err.code));
                }
            );
        });
    }

    public async uploadFile(
        file: string,
        server: string,
        options: UploadOptions,
        trustAllHosts: boolean,
        location: FileLocation = DATA_DIRECTORY
    ) {
        const ft = new window.FileTransfer();
        const that = this;

        if ((await this.checkFile(file, location)) === false) {
            throw new UnknownFileSystemError(
                UnknownFileSystemError.NOT_FOUND_ERR
            );
        }

        // FIXME: Figure out what the right type of FileTransfer.upload's promise is
        return new Promise<any>(function(resolve, reject) {
            const path = that.createFullPath(file, location);
            ft.upload(path, server, resolve, reject, options, trustAllHosts);
        });
    }

    /**
     * Create a uniquely named temporary file.
     *
     * @param extension The file extension that we should give to the file (not including a .)
     * @param ArrayBuffer The contents of the file that will be saved with it.
     *
     * @returns The complete path to the file.
     */
    public async createTemporaryFile(
        extension: string,
        contents: ArrayBuffer
    ): Promise<string> {
        // Make sure our temporary folder exists
        if ((await this.checkDirectory("temp", DATA_DIRECTORY)) === false) {
            try {
                await this.createDirectory("temp", DATA_DIRECTORY);
            } catch (err) {
                if (await this.checkDirectory("temp", DATA_DIRECTORY)) {
                    // There is a potential race if multiple people call createTemporaryFile
                    // at the same time since they could fight over who makes the "temp" directory
                    // so if we did make it successfully, there's no error.
                } else {
                    throw err;
                }
            }
        }

        const fileName = guid() + "." + extension;
        const filePath = joinPath("temp", fileName);

        await this.writeFile(
            filePath,
            new Blob([contents], { type: "application/octet-stream" }),
            DATA_DIRECTORY
        );
        return filePath;
    }

    private getRootFilesystem(name: FileLocation): string {
        if (this.mock) {
            return "/";
        }

        if (name === DATA_DIRECTORY) {
            return window.cordova.file.dataDirectory;
        } else if (name === APP_DIRECTORY) {
            return window.cordova.file.applicationDirectory;
        }

        throw new ArgumentError(`Unknown root filesystem name ${name}`);
    }

    private createFullPath(path: string, name: FileLocation): string {
        const root = this.getRootFilesystem(name);

        return joinPath(root, path);
    }
}

angular.module("iotile.app").service("FileSystemService", FileSystemService);
