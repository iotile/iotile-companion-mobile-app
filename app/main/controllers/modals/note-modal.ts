import { Device, IOTileCloud } from "@iotile/iotile-cloud";
import { guid, ModalBase } from "@iotile/iotile-common";
import { Position } from "ng-iotile-app";

export class NoteModal extends ModalBase {
    public devices: Device[];
    public target: Device;
    public prefix?: string;
    public note: string;
    public hasLocation: boolean;
    public file: File;

    private timestamp: Date;
    private lat: number;
    private lon: number;
    private cachedLocation: boolean;

    private cloud: IOTileCloud;
    private geolocation;
    private camera;

    constructor(
        $injector,
        devices: Device[],
        prefix?: string,
        location?: Position
    ) {
        super("NoteModal", "main/templates/modals/note.html", $injector, {
            animation: "slide-in-up",
            backdropClickToClose: true,
            hardwareBackButtonClose: true
        });
        this.devices = devices;
        this.note = "";
        this.prefix = prefix;
        this.cloud = $injector.get("IOTileCloud");
        this.geolocation = $injector.get("Geolocation");
        this.camera = $injector.get("$cordovaCamera");

        if (location) {
            this.cachedLocation = true;
            this.hasLocation = true;
            this.lat = location.coords.latitude;
            this.lon = location.coords.longitude;
        } else {
            this.cachedLocation = false;
            this.hasLocation = false;
            this.lat = null;
            this.lon = null;
        }
    }

    public async toggleLocation() {
        if (this.hasLocation) {
            this.lat = null;
            this.lon = null;
            this.hasLocation = false;
        } else {
            await this.captureLocation();
        }
    }

    public async captureLocation() {
        await this.showLoading("Finding Location");

        try {
            await this.geolocation.captureLocation();

            this.lat = this.geolocation.lat;
            this.lon = this.geolocation.lon;
            this.hasLocation = true;

            this.log_info(
                "Lat: " + this.lat.toFixed(6),
                " Long: " + this.lon.toFixed(6)
            );
        } catch (err) {
            this.log_warn("Error getting location", err);
            this.setError("Could not get location.");
        } finally {
            await this.hideLoading();
        }
    }

    public async captureImage() {
        if (this.camera) {
            const that = this;

            const options = {
                quality: 100,
                destinationType: Camera.DestinationType.DATA_URL,
                sourceType: Camera.PictureSourceType.CAMERA,
                encodingType: Camera.EncodingType.PNG,
                targetWidth: 500,
                targetHeight: 500,
                saveToPhotoAlbum: true,
                correctOrientation: true
            };

            this.camera.getPicture(options).then(
                function(imageData) {
                    that.getFile(imageData, "image/png");
                },
                function(err) {
                    that.log_debug("Image Capture failed: ", err);
                }
            );
        }
    }

    public async selectImage() {
        if (this.camera) {
            const that = this;

            const options = {
                quality: 100,
                destinationType: Camera.DestinationType.DATA_URL,
                sourceType: Camera.PictureSourceType.PHOTOLIBRARY,
                encodingType: Camera.EncodingType.PNG,
                targetWidth: 500,
                targetHeight: 500,
                saveToPhotoAlbum: false
            };

            this.camera.getPicture(options).then(
                function(imageData) {
                    that.getFile(imageData, "image/png");
                },
                function(err) {
                    if (!err.includes("no image selected")) {
                        that.log_debug("Image Selection failed: ", err);
                    }
                }
            );
        }
    }

    public removeImage() {
        this.file = null;
        this.$scope.$apply();
    }

    public async sendNote() {
        await this.showLoading("Posting Note to Cloud");

        try {
            this.timestamp = new Date();
            if (this.prefix) {
                this.note = this.prefix + "\n--------\n" + this.note;
            }
            const resp: any = await this.cloud.postNote(
                this.target.slug,
                this.timestamp,
                this.note
            );

            if (this.hasLocation) {
                await this.cloud.postLocation(
                    this.target.slug,
                    this.timestamp,
                    this.lat,
                    this.lon
                );
            }
            if (this.file) {
                await this.cloud.postFileToNote(resp.id, this.file);
            }
        } finally {
            this.hideLoading();
            this.remove();
        }
    }

    protected async initialize() {
        if (!this.cachedLocation) {
            await this.toggleLocation();
        }
        // device ready listener for camera?
    }

    /**
     * Turn base 64 image into a File, so we can send it using multipart/form-data posts
     */
    private getFile(
        b64Data: string,
        contentType: string,
        sliceSize: number = 512
    ) {
        contentType = contentType || "";
        sliceSize = sliceSize || 512;

        const byteCharacters = atob(b64Data);
        const byteArrays = [];

        for (
            let offset = 0;
            offset < byteCharacters.length;
            offset += sliceSize
        ) {
            const slice = byteCharacters.slice(offset, offset + sliceSize);

            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }

            const byteArray = new Uint8Array(byteNumbers);

            byteArrays.push(byteArray);
        }

        const blob: any = new Blob(byteArrays, {
            type: contentType
        });
        blob.lastModifiedDate = new Date();
        // assign an arbitrary unique name; the camera plugin lets you have actual data or metadata, but not both.
        blob.name = guid().slice(1, 15) + ".png";
        this.file = blob as File;
    }
}
