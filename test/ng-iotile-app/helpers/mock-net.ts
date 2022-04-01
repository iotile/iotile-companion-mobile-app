export class MockNetService {
    public online: boolean;

    constructor() {
        this.online = false;
    }

    public isOnline() {
        return this.online;
    }
}
