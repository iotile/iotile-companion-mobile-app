export class MockGeolocationService {
    private lat: number;
    private lon: number;

    constructor() {
        this.lat = 37.406484;
        this.lon = -122.108438;
    }

    public async captureLocation() {}
}
