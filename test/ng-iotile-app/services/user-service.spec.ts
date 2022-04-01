import {
    HttpError,
    IOTileCloud,
    ServerInformation,
    User
} from "@iotile/iotile-cloud";
import { ServiceBase, UnknownFileSystemError } from "@iotile/iotile-common";
import { FileSystemService, MockCordovaFile, UserService } from "ng-iotile-app";
import { StandardJig } from "../helpers/standard-jig";

describe("module: main, service: UserService", function() {
    let FileSystemService: FileSystemService;
    let $injector;
    const jig = new StandardJig();
    jig.mockCacheService();

    const server: ServerInformation = {
        shortName: "PRODUCTION",
        longName: "Production Server",
        url: "https://iotile.cloud/api/v1",
        default: true
    };

    async function injectUser(hasServer: boolean) {
        const user = new User({
            username: "testUser",
            name: "Test",
            email: "test@gmail.com",
            id: 1,
            token: "xdcvb8rvbvwdcnz"
        });
        const userData = user.toJson();

        if (hasServer) {
            userData.server = server;
        }
        await FileSystemService.writeJSONFile("user.json", userData);
    }

    beforeEach(inject(function(_$injector_, _FileSystemService_) {
        $injector = _$injector_;
        FileSystemService = _FileSystemService_;
    }));

    jig.async_it(
        "should initialize correctly with a user and serverInformation",
        async function() {
            await injectUser(true);
            const foundData = await FileSystemService.checkFile("user.json");
            expect(foundData).toEqual(true);

            const rawUser = await FileSystemService.readJSONFile("user.json");
            const unserializedUser = User.Unserialize(rawUser);
            const userData = unserializedUser.user;
            const savedServer = unserializedUser.server;
            expect(savedServer).toEqual(server);
            expect(userData.email).toBe("test@gmail.com");

            const UserService: UserService = $injector.get("User");
            await UserService.initialized;
            expect(UserService).toBeDefined();

            expect(UserService.isAuthenticated()).toEqual(true);
            expect((UserService as any).user).toEqual(userData);
            expect((UserService as any).cloud.server).toEqual(server);
        }
    );

    jig.async_it(
        "should initialize correctly with a user and no serverInformation",
        async function() {
            await injectUser(false);
            const foundData = await FileSystemService.checkFile("user.json");
            expect(foundData).toEqual(true);

            const rawUser = await FileSystemService.readJSONFile("user.json");
            const unserializedUser = User.Unserialize(rawUser);
            const userData = unserializedUser.user;
            const savedServer = unserializedUser.server;
            expect(savedServer).toBeUndefined();
            expect(userData.email).toBe("test@gmail.com");

            const UserService: UserService = $injector.get("User");
            await UserService.initialized;
            expect(UserService).toBeDefined();
            expect(UserService.isAuthenticated()).toEqual(true);
            expect((UserService as any).user).toEqual(userData);
            expect((UserService as any).cloud.server).toEqual(server);
        }
    );

    jig.async_it(
        "should initialize correctly with no user data",
        async function() {
            const foundData = await FileSystemService.checkFile("user.json");
            expect(foundData).toEqual(false);

            const UserService: UserService = $injector.get("User");
            await UserService.initialized;
            expect(UserService).toBeDefined();
            expect(UserService.isAuthenticated()).toEqual(false);

            // set default server
            expect((UserService as any).cloud.server).toEqual(server);
        }
    );

    jig.async_it("should save user and server data on login", async function() {
        const UserService: UserService = $injector.get("User");
        await UserService.initialized;
        expect(UserService).toBeDefined();
        expect(UserService.isAuthenticated()).toEqual(false);

        let foundData = await FileSystemService.checkFile("user.json");
        expect(foundData).toEqual(false);

        const IOTileCloud: IOTileCloud = $injector.get("IOTileCloud");
        spyOn(IOTileCloud, "login").and.returnValue(
            new User({ email: "test@gmail.com" })
        );

        await UserService.login("test@gmail.com", "234", server);

        expect(UserService.isAuthenticated()).toEqual(true);

        foundData = await FileSystemService.checkFile("user.json");
        expect(foundData).toEqual(true);

        const rawUser = await FileSystemService.readJSONFile("user.json");
        const unserializedUser = User.Unserialize(rawUser);
        const userData = unserializedUser.user;
        const savedServer = unserializedUser.server;
        expect(savedServer).toEqual(server);
        expect(userData.email).toBe("test@gmail.com");
    });
});
