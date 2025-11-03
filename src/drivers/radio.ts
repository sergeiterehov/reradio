import { Buffer } from "buffer";
import type { UI } from "./ui";

const SERIAL_TIMEOUT_MS = 1_000;
const SERIAL_SOFT_BUFFER = false;
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

  baudRate: number = 9600;

  private _serial?: {
    port: SerialPort;
    r: ReadableStreamDefaultReader<Uint8Array>;
    w: WritableStreamDefaultWriter<Uint8Array>;
    buffer: Uint8Array[];
  };

  private _callbacks = {
    progress: new Set<(k: number) => void>(),
    ui: new Set<() => void>(),
  };

  constructor() {}

  subscribe_ui = (cb: () => void) => {
    this._callbacks.ui.add(cb);
    return () => {
      this._callbacks.ui.delete(cb);
    };
  };

  protected readonly dispatch_ui = () => {
    for (const cb of this._callbacks.ui) cb();
  };

  async connect() {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });

    if (!port.readable || !port.writable) {
      throw new Error("Radio port is not open");
    }

    const r = (port.readable as ReadableStream<Uint8Array>).getReader();
    const w = (port.writable as WritableStream<Uint8Array>).getWriter();

    const buffer: Uint8Array[] = [];

    this._serial = { port, r, w, buffer };
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

  protected async _serial_write(buf: Buffer) {
    const { w } = this._getSerial();

    Promise.race([
      await w.write(new Uint8Array(buf)),
      new Promise<void>((_, reject) =>
        setTimeout(reject, SERIAL_TIMEOUT_MS, new Error("Timeout while serial writing"))
      ),
    ]);

    if (SERIAL_LOG) console.log("W:", buf.length, buf.toString("hex"));
  }

  protected async _serial_read(size: number) {
    const { r, buffer } = this._getSerial();

    const chunks: Uint8Array[] = [];
    let len = 0;

    while (len < size) {
      if (buffer.length) {
        const bufChunk = buffer.shift()!;

        if (bufChunk.length > size - len) {
          const bufChunkSlice = bufChunk.subarray(0, size - len);
          buffer.unshift(bufChunk.subarray(bufChunkSlice.length));

          chunks.push(bufChunkSlice);
          len += bufChunkSlice.length;

          break;
        }

        chunks.push(bufChunk);
        len += bufChunk.length;

        continue;
      }

      const { value: chunk } = await Promise.race([
        r.read(),
        new Promise<ReturnType<typeof r.read>>((_, reject) =>
          setTimeout(reject, SERIAL_TIMEOUT_MS, new Error("Timeout while serial reading"))
        ),
      ]);
      if (!chunk || chunk.length === 0) throw new Error("Incomplete response");

      if (SERIAL_LOG) console.log("R:", chunk.length, Buffer.from(chunk).toString("hex"));

      if (SERIAL_SOFT_BUFFER && len + chunk.length > size) {
        const chunkSlice = chunk.subarray(0, size - len);
        buffer.push(chunk.subarray(chunkSlice.length));

        chunks.push(chunkSlice);
        len += chunkSlice.length;

        break;
      }

      chunks.push(chunk);
      len += chunk.length;
    }

    return Buffer.concat(chunks);
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
