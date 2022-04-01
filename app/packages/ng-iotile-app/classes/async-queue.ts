export type WorkQueueCallback = (type: string, value: any) => Promise<void>;

class AsyncWorkItem {
    // tslint:disable: variable-name
    public readonly resolver: (any) => void;
    public readonly rejector: (any) => void;
    public readonly item: any;
    public readonly type: string;

    constructor(
        type: string,
        item: any,
        resolver: (any) => void,
        rejector: (any) => void
    ) {
        this.item = item;
        this.resolver = resolver;
        this.rejector = rejector;
        this.type = type;
    }
}

/**
 * @ngdoc object
 * @name Utilities.type:AsyncWorkQueue
 *
 * @description
 * A queue of work items that are processed one at a time in an asynchronous
 * fashion.  This allows for accumulating work items between services where
 * work items may be generated at a faster rate than they can be consumed.
 *
 * For example, IOTileAdapter can generate new robust reports very quickly
 * as it gets them from a device.  However, the ReportService needs to process
 * each one and save it in a database, which could take longer.
 *
 * Putting an AsyncWorkQueue in between makes sure that work items are all buffered
 * and processed sequentially.
 *
 * @property {boolean} idle Whether the work queue is idle and not current processing
 *     any items in the background
 */
// tslint:disable-next-line: max-classes-per-file
export class AsyncWorkQueue {
    /**
     * @ndgoc method
     * @name Utilities.type:AsyncWorkQueue#constructor
     * @methodOf Utilities.type:AsyncWorkQueue
     *
     * @description
     * Constructor for AsyncWorkQueue, creates a new AsyncWorkQueue
     * with an internal queue of work items and a processing function
     * that takes in a work item and processes it.
     *
     * The processing function is called exactly once for each item in the work
     * queue and if items are added faster than they can be processed, they are
     * buffered while they wait.
     *
     * @param {function} processingFunction The function that will process each
     *     work item.  The function must be an async function with signature:
     *     (any) => Future<void>
     */
    private processor: WorkQueueCallback;
    private workitems: any[];
    private _inProgress: boolean;

    constructor(processingFunction: WorkQueueCallback) {
        this.processor = processingFunction;
        this.workitems = [];
        this._inProgress = false;
    }

    get idle() {
        return !this._inProgress;
    }

    /**
     * @ndgoc method
     * @name Utilities.type:AsyncWorkQueue#process
     * @methodOf Utilities.type:AsyncWorkQueue
     *
     * @description
     * Add an item to the work queue with the option to wait
     * for it to finish processing using await.
     *
     * @param {string} type The type of the workitem
     * @param {any} item
     * @returns {Promise<any>} A promise that will be fufilled when
     *    the work item is finished being processed or rejected if an
     *    exception is thrown during the processing.
     */
    public process(type: string, item: any): Promise<any> {
        const that = this;

        return new Promise<any>(function(resolve, reject) {
            const workitem = new AsyncWorkItem(type, item, resolve, reject);
            that.put(workitem);
        });
    }

    /**
     * @description
     * Add a workitem to the queue of work for this queue
     *
     * @param {AsyncWorkItem} item The item to add to the work queue
     */
    private put(item: AsyncWorkItem) {
        this.workitems.push(item);

        if (this._inProgress === false) {
            this.startQueue();
        }
    }

    private async startQueue() {
        this._inProgress = true;

        while (this.workitems.length > 0) {
            const current: AsyncWorkItem = this.workitems.shift();

            try {
                const result = await this.processor(current.type, current.item);

                if (current.resolver !== null) {
                    current.resolver(result);
                }
            } catch (err) {
                if (current.rejector !== null) {
                    current.rejector(err);
                }
            }
        }

        this._inProgress = false;
    }
}
