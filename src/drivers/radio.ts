import { Buffer } from "buffer";
import type { UI } from "./ui";

const SERIAL_TIMEOUT_MS = 1_000;
const SERIAL_LOG = true;

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

  baudRate: number = 9_600;

  private _serial?: {
    port: SerialPort;
    r: ReadableStreamDefaultReader<Uint8Array>;
    w: WritableStreamDefaultWriter<Uint8Array>;
    buffer: Uint8Array[];
    onRead?: (size: number) => void;
  };

  private _callbacks = {
    progress: new Set<(k: number) => void>(),
    ui: new Set<() => void>(),
    ui_change: new Set<() => void>(),
  };

  constructor() {}

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

  protected readonly dispatch_ui = () => this._callbacks.ui.forEach((cb) => cb());
  protected readonly dispatch_ui_change = () => this._callbacks.ui_change.forEach((cb) => cb());

  async connect() {
    if (!navigator.serial) throw new Error("Web Serial API not available");

    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: this.baudRate });

    if (!port.readable || !port.writable) {
      throw new Error("Radio port is not open");
    }

    const r = (port.readable as ReadableStream<Uint8Array>).getReader();
    const w = (port.writable as WritableStream<Uint8Array>).getWriter();

    const buffer: Uint8Array[] = [];

    this._serial = { port, r, w, buffer };

    this._begin_serial_reader();
  }

  async disconnect() {
    if (!this._serial) return;

    this._serial.r.releaseLock();
    this._serial.w.releaseLock();
    await this._serial.port.close();

    this._serial = undefined;
  }

  private _getSerial() {
    if (!this._serial) throw new Error("Port is not opened");

    return this._serial;
  }

  private async _begin_serial_reader() {
    const serial = this._getSerial();

    while (true) {
      const { value, done } = await serial.r.read().catch((e): { value: undefined; done: true } => {
        console.log("Serial reader exception:", e);
        return { value: undefined, done: true };
      });

      serial.onRead?.(value ? value.length : 0);

      if (done) break;

      if (SERIAL_LOG) console.log(new Date().toISOString(), "RX:", value.length, Buffer.from(value).toString("hex"));

      serial.buffer.push(value);
    }
  }

  protected async _serial_write(buf: Buffer) {
    const { w } = this._getSerial();

    Promise.race([
      await w.write(new Uint8Array(buf)),
      new Promise<void>((_, reject) =>
        setTimeout(reject, SERIAL_TIMEOUT_MS, new Error("Timeout while serial writing"))
      ),
    ]);

    if (SERIAL_LOG) console.log(new Date().toISOString(), "TX:", buf.length, buf.toString("hex"));
  }

  protected async _serial_read(size: number, config: { timeout?: number } = {}) {
    const { timeout = SERIAL_TIMEOUT_MS } = config;

    const serial = this._getSerial();

    const chunks: Uint8Array[] = [];
    let len = 0;

    const started_at = Date.now();

    while (len < size) {
      const rest_timeout = Math.max(0, timeout - (Date.now() - started_at));

      if (!serial.buffer.length) {
        const prevOnRead = serial.onRead;
        try {
          await Promise.race([
            new Promise<void>((resolve, reject) => {
              serial.onRead = (size) => {
                if (prevOnRead) prevOnRead(size);

                if (!size) return reject(new Error("Serial closed"));
                resolve();
              };
            }),
            new Promise((_, reject) => {
              setTimeout(reject, rest_timeout, new Error("Timeout while serial reading"));
            }),
          ]);
        } finally {
          serial.onRead = prevOnRead;
        }
      }

      if (!serial.buffer.length) continue;

      const bufChunk = serial.buffer.shift()!;

      if (bufChunk.length > size - len) {
        const bufChunkSlice = bufChunk.subarray(0, size - len);
        serial.buffer.unshift(bufChunk.subarray(bufChunkSlice.length));

        chunks.push(bufChunkSlice);
        len += bufChunkSlice.length;

        break;
      }

      chunks.push(bufChunk);
      len += bufChunk.length;
    }

    const data = Buffer.concat(chunks);

    if (SERIAL_LOG) console.log(new Date().toISOString(), "Read:", data.length, data.toString("hex"));

    return data;
  }

  protected async _serial_clear({ timeout = 300 }: { timeout?: number } = {}) {
    await this._serial_read(0xffffff, { timeout }).catch(() => null);
  }

  async read(onProgress: (k: number) => void) {
    throw new Error("Not implemented");
  }

  async write(onProgress: (k: number) => void) {
    throw new Error("Not implemented");
  }

  async load(snapshot: Buffer) {
    throw new Error("Not implemented");
  }

  ui(): UI.Root {
    throw new Error("Not implemented");
  }
}
