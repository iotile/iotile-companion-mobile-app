export class MockIonicModal {
    public shown: boolean;
    constructor() {
        this.shown = false;
    }

    public remove(): Promise<void> {
        this.shown = false;
        return Promise.resolve();
    }

    public show(): Promise<void> {
        this.shown = true;
        return Promise.resolve();
    }

    public hide(): Promise<void> {
        this.shown = false;
        return Promise.resolve();
    }

    public isShown(): boolean {
        return this.shown;
    }
}
