export interface WalkthroughState {
    name: string;
    args: any;
}

export class Walkthrough {
    private _index: number;
    private _states: WalkthroughState[];

    constructor() {
        this._index = 0;
        this._states = [];
    }

    public begin(): any {
        this._index = 0;
        if (this._states.length) {
            return this._states[this._index];
        } else {
            return false;
        }
    }

    public nextState(): any {
        this._index += 1;
        if (this._index === this._states.length) {
            return false;
        } else {
            return this._states[this._index];
        }
    }

    public getState(): any {
        return this._states[this._index];
    }

    public prevState(): any {
        if (this._index === 0) {
            return false;
        }
        this._index -= 1;
        return this._states[this._index];
    }

    public progress(): any {
        return { step: this._index + 1, total: this._states.length };
    }

    public addState(name: string, args: any) {
        this._states.push({ name, args });
    }
}
