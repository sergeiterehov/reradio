import { Buffer } from "buffer";
import type { UI } from "@/utils/ui";

type FnProgress = (k: number, step?: string) => void;

export type RadioInfo = {
  vendor: string;
  model: string;
};

export class Radio {
  static Info: RadioInfo = {
    vendor: "Noname",
    model: "Noname",
  };

  get info() {
    return (this.constructor as typeof Radio).Info;
  }

  private _callbacks = {
    progress: new Set<FnProgress>(),
    ui: new Set<() => void>(),
    ui_change: new Set<() => void>(),
  };

  constructor() {}

  readonly subscribe_progress = (cb: FnProgress) => {
    this._callbacks.progress.add(cb);
    return () => {
      this._callbacks.progress.delete(cb);
    };
  };

  readonly subscribe_ui = (cb: () => void) => {
    this._callbacks.ui.add(cb);
    return () => {
      this._callbacks.ui.delete(cb);
    };
  };

  readonly subscribe_ui_change = (cb: () => void) => {
    this._callbacks.ui_change.add(cb);
    return () => {
      this._callbacks.ui_change.delete(cb);
    };
  };

  protected readonly dispatch_progress: FnProgress = (k, s) => this._callbacks.progress.forEach((cb) => cb(k, s));
  protected readonly dispatch_ui = () => this._callbacks.ui.forEach((cb) => cb());
  protected readonly dispatch_ui_change = () => this._callbacks.ui_change.forEach((cb) => cb());

  async read() {
    throw new Error("Not implemented");
  }

  async write() {
    throw new Error("Not implemented");
  }

  async load(snapshot: Buffer) {
    throw new Error("Not implemented");
  }

  ui(): UI.Root {
    throw new Error("Not implemented");
  }
}
