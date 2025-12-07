import { Buffer } from "buffer";
import { hex } from "@/utils/radio";

const SERIAL_TIMEOUT_MS = 1_000;
const SERIAL_LOG = true;

export type Serial = {
  begin(config: SerialOptions): Promise<void>;
  end(): Promise<void>;
  clear(config?: { timeout?: number }): Promise<void>;
  read(size: number, config?: { timeout?: number }): Promise<Buffer>;
  write(data: Buffer): Promise<void>;
};

type SerialState = {
  port: SerialPort;
  r: ReadableStreamDefaultReader<Uint8Array>;
  w: WritableStreamDefaultWriter<Uint8Array>;
  buffer: Uint8Array[];
  onRead?: (size: number) => void;
};

let _state: SerialState | undefined;

function _getState() {
  if (!_state) throw new Error("Port is not opened");

  return _state;
}

async function _begin_serial_reader() {
  const state = _getState();

  while (true) {
    const { value, done } = await state.r.read().catch((e): { value: undefined; done: true } => {
      console.log("Serial reader exception:", e);
      return { value: undefined, done: true };
    });

    state.onRead?.(value ? value.length : 0);

    if (done) break;

    if (SERIAL_LOG) console.log(new Date().toISOString(), "RX:", value.length, hex(Buffer.from(value)));

    state.buffer.push(value);
  }
}

export const serial: Serial = {
  async begin(config) {
    if (!navigator.serial) throw new Error("Web Serial API not available");

    if (_state) throw new Error("Serial port is not closed");

    const port = await navigator.serial.requestPort();
    await port.open(config);

    if (!port.readable || !port.writable) {
      throw new Error("Radio port is not open");
    }

    const r = (port.readable as ReadableStream<Uint8Array>).getReader();
    const w = (port.writable as WritableStream<Uint8Array>).getWriter();

    const buffer: Uint8Array[] = [];

    _state = { port, r, w, buffer };

    _begin_serial_reader();
  },

  async end() {
    if (!_state) return;

    _state.r.releaseLock();
    _state.w.releaseLock();
    await _state.port.close();

    _state = undefined;
  },

  async clear(config) {
    await serial.read(0xffffff, config).catch(() => null);
  },

  async read(size, config = {}) {
    const { timeout = SERIAL_TIMEOUT_MS } = config;

    const state = _getState();

    if (state.onRead) throw new Error("Serial already is reading");

    const chunks: Uint8Array[] = [];
    let len = 0;

    const started_at = Date.now();

    while (len < size) {
      const rest_timeout = Math.max(0, timeout - (Date.now() - started_at));

      if (!state.buffer.length) {
        try {
          await Promise.race([
            new Promise<void>((resolve, reject) => {
              state.onRead = (size) => {
                if (!size) return reject(new Error("Serial closed"));
                resolve();
              };
            }),
            new Promise((_, reject) => {
              setTimeout(reject, rest_timeout, new Error("Timeout while serial reading"));
            }),
          ]);
        } finally {
          state.onRead = undefined;
        }
      }

      if (!state.buffer.length) continue;

      const bufChunk = state.buffer.shift()!;

      if (bufChunk.length > size - len) {
        const bufChunkSlice = bufChunk.subarray(0, size - len);
        state.buffer.unshift(bufChunk.subarray(bufChunkSlice.length));

        chunks.push(bufChunkSlice);
        len += bufChunkSlice.length;

        break;
      }

      chunks.push(bufChunk);
      len += bufChunk.length;
    }

    const data = Buffer.concat(chunks);

    if (SERIAL_LOG) console.log(new Date().toISOString(), "Read:", data.length, hex(data));

    return data;
  },

  async write(data) {
    const { w } = _getState();

    Promise.race([
      await w.write(new Uint8Array(data)),
      new Promise<void>((_, reject) =>
        setTimeout(reject, SERIAL_TIMEOUT_MS, new Error("Timeout while serial writing"))
      ),
    ]);

    if (SERIAL_LOG) console.log(new Date().toISOString(), "TX:", data.length, hex(data));
  },
};
