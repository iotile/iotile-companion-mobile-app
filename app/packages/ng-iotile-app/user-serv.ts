import {
    HttpError,
    IOTileCloud,
    Membership,
    ServerInformation,
    User
} from "@iotile/iotile-cloud";
import { ServiceBase, UnknownFileSystemError } from "@iotile/iotile-common";
import angular = require("angular");
import Raven = require("raven-js");
import { FileSystemService } from "./filesystem-serv";

export type UserEventHook = (event: string) => Promise<void>;

export class UserService extends ServiceBase {
    private fs: FileSystemService;
    private cloud: IOTileCloud;

    private user: User;

    private loginHooks: UserEventHook[];
    private logoutHooks: UserEventHook[];

    constructor($injector, Config, IOTileCloud, NetService, FileSystemService) {
        super("UserService", $injector);

        this.cloud = IOTileCloud;
        this.fs = FileSystemService;

        this.user = null;
        this.loginHooks = [];
        this.logoutHooks = [];

        // Start our asynchronous initialization process
        this.beginInitialization();
    }

    public addLoginHook(hook: UserEventHook) {
        this.loginHooks.push(hook);
    }

    public addLogoutHook(hook: UserEventHook) {
        this.logoutHooks.push(hook);
    }

    public getToken() {
        if (this.user === null) {
            return null;
        }

        return this.user.token;
    }

    /*
     * Try to refresh the user's token.  If the token was successfully refreshed, returns
     * a boolean true.  If the token was rejected by the cloud, returns a boolean false.
     * If false is returned, this function will have ensured that the user.json file is
     * destroyed as well.
     *
     * If there was an issue refreshing the token that does not indicate a problem
     * with the token, throws an exception
     */
    public async refresh(): Promise<boolean> {
        await this.initialized;

        if (this.user === null || this.user.token === null) {
            try {
                await this.fs.removeFile("user.json");
            } catch (err) {
                // If the error is just that we already removed the user.json file, it's not a problem
                if (
                    !(
                        err instanceof UnknownFileSystemError &&
                        err.code === UnknownFileSystemError.NOT_FOUND_ERR
                    )
                ) {
                    this.log_warn("Error removing user.json file", err);
                }
            }

            this.user = null;
            return false;
        }

        try {
            const newToken = await this.cloud.refreshToken(this.user.token);
            this.user.token = newToken;
        } catch (err) {
            /*
             * In poor connectivity situations, our refresh logic can fail with a timeout
             * trying to reach iotile.cloud.  We should not log the user out in that case
             * but simply take note of it and go about our lives.  Note that we might
             * expect the above NetService.isOnline() check to fix this issue for us but
             * it won't necessarily because when we resume an app we might get the queued
             * resume event before we get the queued networkChanged event.  So if the network
             * coverage goes out while the app is disabled, we run into an issue here.
             *
             * In any case, no matter the reason, we should not log the user out for connectivity
             * issues.
             */
            if (err instanceof HttpError && err.status === -1) {
                this.log_info(
                    "[main.run] Token refresh failed since we were offline."
                );
                throw err;
            }

            if (
                err instanceof HttpError &&
                err.status < 500 &&
                err.status >= 400
            ) {
                try {
                    await this.fs.removeFile("user.json");
                } catch (err) {
                    // If the error is just that we already removed the user.json file, it's not a problem
                    // We do the fs removal this way of trying and failing rather than checking first to avoid
                    // a potential race after we check for the file's existance since that is also an asynchronous
                    // call.
                    if (
                        !(
                            err instanceof UnknownFileSystemError &&
                            err.code === UnknownFileSystemError.NOT_FOUND_ERR
                        )
                    ) {
                        this.log_warn("Error removing user.json file", err);
                    }
                }

                this.user = null;
                return false;
            }
        }

        this.log_info("Refreshed JWT token successfully");
        this.cloud.setToken("JWT " + this.user.token);

        try {
            await this.saveUser(this.user);
        } catch (err) {
            this.log_error("Error saving refreshed user token.", err);
        }

        return true;
    }

    public async logout(noCloud: boolean = false) {
        await this.initialized;

        this.user = null;

        try {
            await this.fs.removeFile("user.json");

            if (!noCloud) {
                await this.cloud.logout();
            }

            // Run any post logout hooks
            await this.runHooks("logout", this.logoutHooks);
        } catch (err) {
            this.log_error("Error logging out", err);
            throw err;
        } finally {
            this.cloud.setToken(null);
        }
    }

    public async login(
        email: string,
        password: string,
        server: ServerInformation
    ) {
        await this.initialized;

        this.cloud.server = server;
        const cloudUser = await this.cloud.login(email, password);
        await this.saveUser(cloudUser);

        Raven.setUserContext({
            email: this.user.email,
            id: this.user.id
        });

        this.cloud.setToken("JWT " + this.user.token);

        // Run any login hooks
        await this.runHooks("login", this.loginHooks);
    }

    public async register(
        username: string,
        name: string,
        email: string,
        password1: string,
        password2: string
    ) {
        // If a user needs to register, they will need to do so on the production server
        this.cloud.server = this.cloud.defaultServer();
        return this.cloud.register(username, name, email, password1, password2);
    }

    public isAuthenticated(): boolean {
        return this.user !== null;
    }

    public isStaff(): boolean {
        if (this.user) {
            return this.user.isStaff;
        } else {
            return false;
        }
    }

    public hasAccessToAdvancedOptions(orgSlug: string): boolean {
        // HACK: These are equivalent for current purposes
        // NOTE: Will return 'true' for staff/owners
        return this.canResetDevice(orgSlug);
    }

    public canReadProperties(orgSlug: string): boolean {
        if (this.user) {
            return this.user.canReadProperties(orgSlug);
        } else {
            return false;
        }
    }

    public canModifyDevice(orgSlug: string): boolean {
        if (this.user) {
            return this.user.canModifyDevice(orgSlug);
        } else {
            return false;
        }
    }

    public canModifyStreamVariables(orgSlug: string): boolean {
        if (this.user) {
            return this.user.canModifyStreamVariables(orgSlug);
        } else {
            return false;
        }
    }

    public canResetDevice(orgSlug: string): boolean {
        if (this.user) {
            return this.user.canResetDevice(orgSlug);
        } else {
            return false;
        }
    }

    public setRoles(roles: { [key: string]: Membership }) {
        if (this.user) {
            this.user.setOrgRoles(roles);
        }
        this.saveUser(this.user);
    }

    protected async initialize() {
        this.log_info("Initializing and checking for saved user data");
        const foundData = await this.fs.checkFile("user.json");
        if (!foundData) {
            return;
        } else {
            await this.loadUser();
            // Update Raven with our user data
            Raven.setUserContext({
                email: this.user.email,
                id: this.user.id
            });

            this.cloud.setToken("JWT " + this.user.token);
        }
    }

    private checkCloudUser(obj: any): obj is User {
        if (obj.email === undefined || obj.email === null) {
            return false;
        }

        if (obj.isStaff === undefined || obj.isStaff === null) {
            return false;
        }

        if (obj.token === undefined || obj.token === null) {
            return false;
        }

        if (obj.id === undefined || obj.id === null) {
            return false;
        }

        return true;
    }

    private async runHooks(event: string, hooks: UserEventHook[]) {
        for (const hook of hooks) {
            try {
                await hook(event);
            } catch (err) {
                this.log_warn("Error running hook on event: " + event, err);
            }
        }
    }

    private async loadUser() {
        const rawUser = await this.fs.readJSONFile("user.json");
        const unserializedUser = User.Unserialize(rawUser);
        const userData = unserializedUser.user;

        if (!this.checkCloudUser(userData)) {
            this.log_error(
                "Invalid user data read back from file, missing keys",
                userData
            );
            await this.fs.removeFile("user.json");
            return;
        }

        this.log_info("Initialized user information from persisted file.");

        this.user = userData;
        this.cloud.server =
            unserializedUser.server || this.cloud.defaultServer();
    }

    /*
    Save the user and server preference persistently in the local filesystem 
    */
    private async saveUser(user): Promise<void> {
        let serializedUser;
        if (user) {
            this.user = user;
            serializedUser = user.toJson();
        } else {
            serializedUser = {};
        }
        serializedUser.server = this.cloud.server;
        await this.fs.writeJSONFile("user.json", serializedUser);
    }
}

angular.module("iotile.app").service("User", UserService);
