export type MutexReleaser = () => void;
export type QueuedRunnable = (MutexReleaser) => void;

export class Mutex {
    private _queue: QueuedRunnable[] = [];
    private _pending = false;

    public acquire(): Promise<MutexReleaser> {
        const that = this;

        const entry = new Promise<MutexReleaser>(function(resolve, reject) {
            that._queue.push(resolve);
        });

        if (!this._pending) {
            this.dispatch();
        }

        return entry;
    }

    private dispatch() {
        if (this._queue.length > 0) {
            const nextRunnable = this._queue.shift();
            const that = this;
            const releaseFunction = function() {
                that.dispatch();
            };

            this._pending = true;
            nextRunnable(releaseFunction);
        } else {
            this._pending = false;
        }
    }
}
