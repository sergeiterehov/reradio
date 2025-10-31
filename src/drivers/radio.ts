import { Buffer } from "buffer";
import type { UI } from "./ui";

const SERIAL_TIMEOUT_MS = 5_000;

export class Radio {
  vendor: string = "Noname";
  model: string = "Noname";

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

  protected dispatch_ui() {
    for (const cb of this._callbacks.ui) cb();
  }

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

  async read(onProgress: (k: number) => void) {
    onProgress(0);
    throw new Error("Not implemented");
  }

  async write(onProgress: (k: number) => void) {
    onProgress(0);
    throw new Error("Not implemented");
  }

  async load(snapshot: Buffer) {
    throw new Error("Not implemented");
  }

  ui(): UI.Field.Any[] {
    throw new Error("Not implemented");
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

      if (len + chunk.length > size) {
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
}
