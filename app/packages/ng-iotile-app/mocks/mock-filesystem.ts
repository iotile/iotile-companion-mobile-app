import { FileSystemError, UnknownFileSystemError } from "@iotile/iotile-common";
import angular = require("angular");

interface GetDirectoryOptions {
    create: boolean;
    exclusive: boolean;
}

interface GetFileOptions {
    create: boolean;
    exclusive: boolean;
}

export interface UploadOptions {
    fileName: string;
    fileKey: string;
    chunkedMode: boolean;
    mimeType: string;
    headers: { [key: string]: string };
}

export class Entry {
    public readonly isFile: boolean;
    public readonly isDirectory: boolean;
    public readonly name: string;
    public readonly fullPath: string;
    public readonly filesystem: FileSystem;
    public readonly nativeURL: string;

    constructor(isFile, isDirectory, name, fullPath, fileSystem, nativeURL) {
        this.isFile = isFile;
        this.isDirectory = isDirectory;
        this.name = name;
        this.fullPath = fullPath;
        this.filesystem = fileSystem || null;
        this.nativeURL = nativeURL || null;
    }

    public remove(
        successCallback: () => void,
        errorCallback: (err: FileError) => void
    ) {
        const files = this.filesystem.fs.files;

        if (this.fullPath in files) {
            delete files[this.fullPath];
            successCallback();
        } else {
            errorCallback(new FileError(FileError.NOT_FOUND_ERR));
        }
    }
}

// tslint:disable: max-classes-per-file
class DirectoryReader {
    private entry: DirectoryEntry;

    constructor(entry: DirectoryEntry) {
        this.entry = entry;
    }

    public readEntries(
        success: (entries: Entry[]) => void,
        failure: (err: FileError) => void
    ) {
        const entries = [];
        const files = this.entry.filesystem.fs.files;

        for (const key in files) {
            if (key.lastIndexOf(this.entry.fullPath, 0) === 0) {
                let relativePath = key.substring(this.entry.fullPath.length);

                if (relativePath.length === 0) {
                    continue;
                }

                if (relativePath[0] === "/") {
                    relativePath = relativePath.substring(1);
                }

                if (relativePath.lastIndexOf("/", 0) < 0) {
                    entries.push(files[key]);
                }
            }
        }

        success(entries);
    }
}

// tslint:disable-next-line: max-classes-per-file
export class DirectoryEntry extends Entry {
    constructor(
        name: string,
        fullPath: string,
        fileSystem: FileSystem,
        nativeURL: string
    ) {
        super(false, true, name, fullPath, fileSystem, nativeURL);
    }

    public createReader() {
        return new DirectoryReader(this);
    }

    public getDirectory(
        path: string,
        options: GetDirectoryOptions,
        successCallback: (dir: DirectoryEntry) => void,
        errorCallback: (err: FileError) => void
    ) {
        const files = this.filesystem.fs.files;

        const combinedPath = this.filesystem.fs.joinPath(this.fullPath, path);

        // If it's not found and we shouldn't create it, that's a failure
        if (!(combinedPath in files) && !options.create) {
            errorCallback(new FileError(FileError.NOT_FOUND_ERR));
            return;
        }

        // If it's not found and we should create it, create it
        if (!(combinedPath in files) && options.create) {
            const entry = new DirectoryEntry(
                path,
                combinedPath,
                this.filesystem,
                combinedPath
            );
            files[combinedPath] = entry;
            successCallback(entry);
            return;
        }

        // Otherwise it exists
        const entry = files[combinedPath];

        // If it's a file, that's always a failure
        if (entry.isFile) {
            errorCallback(new FileError(FileError.TYPE_MISMATCH_ERR));
            return;
        }

        // If we are asked to create it but cannot accept it already being
        // created, fail
        if (options.create && options.exclusive) {
            errorCallback(new FileError(FileError.PATH_EXISTS_ERR));
            return;
        }

        // If it exists and we are asked to create it, but not exclusively, we're good
        successCallback(entry as DirectoryEntry);
    }

    // See here for error cases with create and exclusive
    // https://stackoverflow.com/questions/32863184/exclusive-parameter-when-using-getfile-with-phonegap
    public getFile(
        path: string,
        options: GetFileOptions,
        successCallback: (dir: FileEntry) => void,
        errorCallback: (err: FileError) => void
    ) {
        const files = this.filesystem.fs.files;

        const combinedPath = this.filesystem.fs.joinPath(this.fullPath, path);

        // If it's not found and we shouldn't create it, that's a failure
        if (!(combinedPath in files) && !options.create) {
            errorCallback(new FileError(FileError.NOT_FOUND_ERR));
            return;
        }

        // If it's not found and we should create it, create it
        if (!(combinedPath in files) && options.create) {
            const entry = new FileEntry(
                path,
                combinedPath,
                this.filesystem,
                combinedPath
            );
            files[combinedPath] = entry;
            successCallback(entry);
            return;
        }

        // Otherwise it exists
        const entry = files[combinedPath];

        // If it's a file, that's always a failure
        if (entry.isDirectory) {
            errorCallback(new FileError(FileError.TYPE_MISMATCH_ERR));
            return;
        }

        if (options.create && !options.exclusive) {
            successCallback(entry as FileEntry);
            return;
        }

        // If it exists and we are asked to create it, fail
        if (options.create && options.exclusive) {
            errorCallback(new FileError(FileError.PATH_EXISTS_ERR));
            return;
        }

        successCallback(entry as FileEntry);
    }

    public removeRecursively(
        successCallback: () => void,
        errorCallback: (err: FileError) => void
    ) {
        const files = this.filesystem.fs.files;
        const toRemove = [];

        for (const key in files) {
            if (key.lastIndexOf(this.fullPath, 0) === 0) {
                toRemove.push(key);
            }
        }

        // tslint:disable-next-line: prefer-for-of
        for (let i = 0; i < toRemove.length; ++i) {
            delete files[toRemove[i]];
        }

        successCallback();
    }
}

class ProgressEvent {
    public type: string;
    public target: {};
    public total: number;
    public loaded: number;
    public bubbles: boolean;
    public cancelBubble: boolean;
    public cancelable: boolean;
    public lengthComputable: boolean;

    constructor(type, dict) {
        this.type = type;
        this.bubbles = false;
        this.cancelBubble = false;
        this.cancelable = false;
        this.lengthComputable = false;
        this.loaded = dict && dict.loaded ? dict.loaded : 0;
        this.total = dict && dict.total ? dict.total : 0;
        this.target = dict && dict.target ? dict.target : null;
    }
}

/**
 * This is based on cordova-file-plugin here:
 * https://github.com/apache/cordova-plugin-file/blob/master/www/FileWriter.js
 */
class MockFileWriter {
    public onwriteend: (evt: ProgressEvent) => void;
    public onwritestart: (evt: ProgressEvent) => void;
    public result;
    public error;
    private entry: FileEntry;

    constructor(entry: FileEntry) {
        this.entry = entry;
        this.onwriteend = null;
        this.onwritestart = null;
        this.error = null;
        this.result = null;
    }

    public write(data: Blob) {
        this.entry.contents = data.slice();

        if (this.onwritestart) {
            this.onwritestart(
                new ProgressEvent("writestart", { target: this })
            );
        }

        if (this.onwriteend) {
            this.onwriteend(new ProgressEvent("writeend", { target: this }));
        }
    }
}

export class MockFileTransfer {
    constructor() {}

    public upload(
        filePath: string,
        server: string,
        successCallback: ({}) => void,
        errorCallback: (FileError) => void,
        options: UploadOptions,
        trustAllHosts: boolean
    ) {
        if ((window as any).globalArchMockFileUploadFail) {
            errorCallback(
                new UnknownFileSystemError(FileSystemError.NOT_FOUND_ERR)
            );
        } else {
            successCallback({});
        }
    }
}

export class InMemoryFileTransfer {
    constructor() {}

    public upload(
        filePath: string,
        server: string,
        successCallback: ({}) => void,
        errorCallback: (FileError) => void,
        options: UploadOptions,
        trustAllHosts: boolean
    ) {
        const XHR = new XMLHttpRequest();
    }
}

class FileSystem {
    public readonly name: string;
    public readonly root: DirectoryEntry;

    public fs: MockCordovaFile;

    constructor(fs: MockCordovaFile, name: string, root: DirectoryEntry) {
        this.name = name;
        this.fs = fs;

        if (root) {
            this.root = new DirectoryEntry(
                root.name,
                root.fullPath,
                this,
                root.nativeURL
            );
        } else {
            this.root = new DirectoryEntry(this.name, "/", this, null);
        }
    }
}

export class FileEntry extends Entry {
    public contents: Blob;

    constructor(
        name: string,
        fullPath: string,
        fileSystem: FileSystem,
        nativeURL: string
    ) {
        super(true, false, name, fullPath, fileSystem, nativeURL);
    }

    public createWriter(
        successCallback: (writer: MockFileWriter) => void,
        errorCallback: (err: FileError) => void
    ) {
        const writer = new MockFileWriter(this);

        successCallback(writer);
    }

    public file(
        successCallback: (Blob: Blob) => void,
        errorCallback: (err: FileError) => void
    ) {
        successCallback(this.contents);
    }
}

class FileError {
    public static readonly NOT_FOUND_ERR = 1;
    public static readonly SECURITY_ERR = 2;
    public static readonly ABORT_ERR = 3;
    public static readonly NOT_READABLE_ERR = 4;
    public static readonly ENCODING_ERR = 5;
    public static readonly NO_MODIFICATION_ALLOWED_ERR = 6;
    public static readonly INVALID_STATE_ERR = 7;
    public static readonly SYNTAX_ERR = 8;
    public static readonly INVALID_MODIFICATION_ERR = 9;
    public static readonly QUOTA_EXCEEDED_ERR = 10;
    public static readonly TYPE_MISMATCH_ERR = 11;
    public static readonly PATH_EXISTS_ERR = 12;

    public readonly code: number;

    constructor(code: number) {
        this.code = code;
    }
}

export class MockCordovaFile {
    public files: { [key: string]: Entry };
    private $log: ng.ILogService;

    constructor($log) {
        this.$log = $log;
        this.clear("/");
    }

    /**
     * Mock of cordova-file-plugin functionality implemented here:
     * https://github.com/apache/cordova-plugin-file/blob/master/www/resolveLocalFileSystemURI.js
     *
     * @param path
     * @param successCallback
     * @param errorCallback
     */
    public resolveLocalFileSystemURL(
        path: string,
        successCallback: (arg: Entry) => void,
        errorCallback: (arg: FileError) => void
    ) {
        if (path[0] !== "/") {
            path = "/" + path;
        }

        // Remove trailing slash for directories (except for root)
        if (path[path.length - 1] === "/" && path.length > 1) {
            path = path.substring(0, path.length - 1);
        }

        if (path in this.files) {
            const entry = this.files[path];
            successCallback(entry);
        } else {
            errorCallback(new FileError(FileError.NOT_FOUND_ERR));
        }
    }

    public canonicalizePath(path: string) {
        return path;
    }

    public joinPath(path1: string, path2: string) {
        if (path1[path1.length - 1] !== "/") {
            path1 += "/";
        }

        if (path2[0] === "/") {
            return path2;
        }

        return this.canonicalizePath(path1 + path2);
    }

    public clear(baseDir: string) {
        this.files = {};
        this.files[baseDir] = new DirectoryEntry(
            baseDir,
            baseDir,
            new FileSystem(this, baseDir, null),
            baseDir
        );
    }
}

angular.module("iotile.app").service("MockCordovaFile", MockCordovaFile);
