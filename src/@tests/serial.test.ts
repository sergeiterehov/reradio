import { hex, serial } from "@/utils/serial";
import { Buffer } from "buffer";
import { afterEach, expect, test, vi } from "vitest";

function mockSerial() {
  const serial = {
    getPorts: vi.fn().mockResolvedValue([]),
    requestPort: vi.fn().mockImplementation(async () => {
      const transform = new TransformStream<Uint8Array, Uint8Array>();

      const port = {
        connected: true,
        readable: transform.readable,
        writable: transform.writable,
        open: async (options: SerialOptions) => {},
        close: async () => {
          port.connected = false;
        },
      };

      return port as SerialPort;
    }),
  };

  Object.defineProperty(navigator, "serial", {
    value: serial,
    writable: true,
  });

  return serial;
}

afterEach(() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator as any).serial;
  } catch {
    //
  }
});

test("Try API", async () => {
  await expect(serial.begin({ baudRate: 9600 })).rejects.toThrow();
});

test("Serial", async () => {
  mockSerial();

  await expect(serial.end()).resolves;

  await expect(serial.write(Buffer.from([1]))).rejects.toThrow();

  await serial.begin({ baudRate: 9600 });

  await expect(serial.begin({ baudRate: 9600 })).rejects.toThrow();

  await serial.write(Buffer.from([1, 2, 3]));
  await serial.write(Buffer.from([4, 5, 6]));
  expect(await serial.read(2)).toEqual(Buffer.from([1, 2]));
  expect(await serial.read(4)).toEqual(Buffer.from([3, 4, 5, 6]));

  const [bufferedReading] = await Promise.all([
    serial.read(2),
    serial.write(Buffer.from([10])).then(() => serial.write(Buffer.from([20]))),
  ]);
  expect(bufferedReading).toEqual(Buffer.from([10, 20]));

  await serial.write(Buffer.from([1, 2, 3]));
  await serial.clear({ timeout: 10 });

  await expect(Promise.all([serial.read(1, { timeout: 50 }), serial.read(1, { timeout: 50 })])).rejects.toThrow();
  await serial.clear({ timeout: 10 });

  await serial.end();
});

test("hex()", () => {
  expect(hex(Buffer.alloc(0))).toBe("");
  expect(hex(Buffer.from([10, 20, 1, 2]))).toBe("0A 14 01 02");
});
