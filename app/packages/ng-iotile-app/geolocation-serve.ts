import { ServiceBase } from "@iotile/iotile-common";
import angular = require("angular");
// tslint:disable-next-line: no-submodule-imports
import "ionic-angular/js/ionic";

export interface Position {
    coords: {
        latitude: number;
        longitude: number;
    };
}

export class Geolocation extends ServiceBase {
    private lat: number;
    private lon: number;

    private geolocation;

    constructor($injector) {
        super("Geolocation", $injector);
        this.geolocation = $injector.get("$cordovaGeolocation");

        this.lat = null;
        this.lon = null;
    }

    public async captureLocation() {
        const options = { timeout: 10000, enableHighAccuracy: true };

        try {
            const position: Position = await this.geolocate(options);

            this.lat = +position.coords.latitude.toFixed(6);
            this.lon = +position.coords.longitude.toFixed(6);

            this.log_info(`Latitude: ${this.lat}, Longitude: ${this.lon}`);
        } catch (err) {
            this.log_warn("Error getting location", err);
        }
    }

    private geolocate(options): Promise<any> {
        const that = this;

        return new Promise((resolve, reject) => {
            that.geolocation
                .getCurrentPosition(options)
                .then(position => {
                    resolve(position);
                })
                .catch(err => {
                    reject(err);
                });
        });
    }
}

angular.module("iotile.app").service("Geolocation", Geolocation);
