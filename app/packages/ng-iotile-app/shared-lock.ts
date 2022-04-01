// tslint:disable-next-line: no-namespace
namespace IOTileAppModule {
    interface SharedLockUser {
        resolver: (arg: () => void) => void;
        releaseFunction: () => void;
        exclusive: boolean;
    }

    /**
     * @description
     * A simple write preferring read-write lock
     *
     * As many people as want can hold the lock in a shared
     * fashion using acquireShared(), but only one person
     * can hold it exclusively using acquireExclusive().  If
     * someone acquires the lock exclusively, no more shared
     * users are scheduled until the exclusive user finishes.
     */
    export class SharedLock {
        private heldExclusive: boolean;
        private waiters: SharedLockUser[];
        private currentHolders: number;

        constructor() {
            this.waiters = [];
            this.heldExclusive = false;
            this.currentHolders = 0;
        }

        public acquireShared(): Promise<() => void> {
            return this.acquire(false);
        }

        public acquireExclusive(): Promise<() => void> {
            return this.acquire(true);
        }

        private acquire(exclusive: boolean): Promise<() => void> {
            const that = this;

            const sharedWaiter = {
                resolver: null,
                releaseFunction: null,
                exclusive
            };

            const promise = new Promise<() => void>(function(resolve, reject) {
                const releaseFunction = () => {
                    that.currentHolders -= 1;
                    that.schedule();
                };

                sharedWaiter.releaseFunction = releaseFunction;
                sharedWaiter.resolver = resolve;

                that.waiters.push(sharedWaiter);
                that.schedule();
            });

            return promise;
        }

        private schedule() {
            // If someone has exclusive access to the lock, we can't do anything
            if (this.heldExclusive) {
                return;
            }

            // Otherwise, try to schedule as many people as possible
            while (this.waiters.length > 0) {
                if (
                    this.waiters[0].exclusive === false ||
                    this.currentHolders === 0
                ) {
                    // We can always schedule a shared user of the lock if no exclusive
                    // user holds it and we can schedule an exclusive holder if there
                    // are no current holders of the lock.
                    const next = this.waiters.shift();
                    this.currentHolders += 1;
                    this.heldExclusive = next.exclusive;
                    next.resolver(next.releaseFunction);
                }

                // If the lock is now held exclusively, we can't schedule anyone else
                if (this.heldExclusive) {
                    break;
                }
            }
        }
    }
}
