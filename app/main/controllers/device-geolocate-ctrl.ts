import * as IOTileCloudModule from "@iotile/iotile-cloud";
import angular = require("angular");
// tslint:disable-next-line: no-submodule-imports
import { BaseSettingsController } from "ng-iotile-app/classes/settings-base";

export class DeviceGeoLocateController extends BaseSettingsController {
    public get niceLatitude(): string {
        let lat = this.lat;
        if (lat == null) {
            return "Unknown";
        }

        let dir = "N";
        if (lat < 0) {
            dir = "S";
            lat *= -1;
        }

        const dms = this.decimalToDMS(lat);
        return dms + " " + dir;
    }

    public get niceLongitude(): string {
        let lng = this.lng;
        if (lng == null) {
            return "Unknown";
        }

        let dir = "E";
        if (lng < 0) {
            dir = "W";
            lng *= -1;
        }

        const dms = this.decimalToDMS(lng);
        return dms + " " + dir;
    }
    public hasLocation: boolean;

    private lat: number;
    private lng: number;
    private geolocation;

    constructor($scope, $injector) {
        super("GeoLocateController", $injector, $scope);

        this.geolocation = $injector.get("Geolocation");
        this.hasLocation = false;
    }

    public async captureLocation() {
        await this.showLoading("Finding Location");

        try {
            await this.geolocation.captureLocation();

            this.lat = this.geolocation.lat;
            this.lng = this.geolocation.lon;
            this.hasLocation = true;

            this.log_info(
                "Lat: " + this.lat.toFixed(6),
                " Long: " + this.lng.toFixed(6)
            );
            this.$scope.$apply();
        } catch (err) {
            this.log_warn("Error getting location", err);
            this.setError("Could not get location.");
        } finally {
            await this.hideLoading();
        }
    }

    protected async postInitialize() {
        this.hasLocation = false;
        this.lat = parseFloat(this.device.lat.toString() || null);
        this.lng = parseFloat(this.device.lon.toString() || null);

        // If we have a previous location, show it
        this.log_info("Lat: " + this.lat, " Long: " + this.lng);

        if (
            this.lat !== null &&
            this.lng !== null &&
            !isNaN(this.lat) &&
            !isNaN(this.lng)
        ) {
            this.hasLocation = true;
        }
    }

    protected getChanges(): IOTileCloudModule.DeviceDelta[] {
        /*
         * If the user never gave us a location, don't return any deltas.
         * The deltas will show a change since we had to modify what the device
         * stored above in postInitialize() to display it to the user.
         */
        if (!this.hasLocation) {
            return [];
        }

        // Build delta from unmodified device since that is what is persisted in local cache
        // All deltas are built using strings to avoid false conflict errors due to rounding in comparing the cloud and local values
        return [
            new IOTileCloudModule.DeviceLocationDelta(
                this.origDevice.lat,
                this.origDevice.lon,
                +this.lat.toFixed(6),
                +this.lng.toFixed(6),
                this.device.slug
            )
        ];
    }

    private decimalToDMS(dec: number): string {
        const degrees = Math.floor(dec);
        let frac = (dec - degrees) * 60;
        const minutes = Math.floor(frac);
        frac = frac - minutes;
        frac *= 60;
        const seconds = frac.toFixed(2);

        return degrees + " Deg" + " " + minutes + "'" + " " + seconds + "''";
    }
}

angular
    .module("main")
    .controller("DeviceGeoLocateCtrl", DeviceGeoLocateController as any);
