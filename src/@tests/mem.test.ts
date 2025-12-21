import { create_mem_mapper, set_string, to_js } from "@/utils/mem";
import { Buffer } from "buffer";
import { expect, test, vi } from "vitest";

test("Main types and callback", () => {
  const img = Buffer.alloc(128);
  img.writeUInt8(123, 0);
  img.writeUInt16LE(12345, 1);
  img.writeUInt32LE(1234567890, 3);
  img.writeInt16LE(-12345, 7);
  img.write("hello", 9); // 11 bytes
  img.write("\x78\x56\x34\x12", 20);
  img.write("\x12\x34", 24);
  img.writeUInt8(0b11001010, 26);

  const cb = vi.fn();
  const m = create_mem_mapper(img, cb);

  const obj = {
    u8: m.u8(),
    u16: m.u16(),
    u32: m.u32(),
    s16: m.s16(),
    str: m.str(11),
    lbcd: m.lbcd(4),
    buf: m.buf(2),
    bitmap: m.bitmap({ b4: 4, b2: 2, b1: 1, _skip: 1 }),
  };

  expect(obj.u8.get()).toBe(123);
  expect(obj.u16.get()).toBe(12345);
  expect(obj.u32.get()).toBe(1234567890);
  expect(obj.s16.get()).toBe(-12345);
  expect(obj.str.get()).toBe("hello".padEnd(11, "\x00"));
  expect(obj.lbcd.get()).toBe(12345678);
  expect(obj.buf.get()).toEqual(Buffer.from([0x12, 0x34]));
  expect(obj.bitmap.b4.get()).toBe(0b1100);
  expect(obj.bitmap.b2.get()).toBe(0b10);
  expect(obj.bitmap.b1.get()).toBe(0b1);

  obj.u8.set(42);
  obj.u16.set(42);
  obj.u32.set(42);
  obj.s16.set(-42);
  obj.str.set("42".padEnd(11, "\x00"));
  obj.lbcd.set(40);
  obj.lbcd.setDigit(0, 2);
  obj.buf.set(Buffer.from([42, 0]));
  obj.bitmap.b4.set(1);
  obj.bitmap.b2.set(1);
  obj.bitmap.b1.set(0);

  expect(cb).toBeCalledTimes(11);

  expect(obj.u8.get()).toBe(42);
  expect(obj.u16.get()).toBe(42);
  expect(obj.u32.get()).toBe(42);
  expect(obj.s16.get()).toBe(-42);
  expect(obj.str.get()).toBe("42".padEnd(11, "\x00"));
  expect(obj.lbcd.get()).toBe(42);
  expect(obj.buf.get()).toEqual(Buffer.from([42, 0]));
  expect(obj.bitmap.b4.get()).toBe(1);
  expect(obj.bitmap.b2.get()).toBe(1);
  expect(obj.bitmap.b1.get()).toBe(0);

  obj.buf.fill(0xff);

  expect(obj.buf.get()).toEqual(Buffer.from([0xff, 0xff]));

  expect(() => obj.buf.set(Buffer.alloc(100))).toThrow();
  expect(() => obj.str.set("1")).toThrow();
  expect(() => obj.lbcd.set(123456789)).toThrow();
});

test("Struct", () => {
  const img = Buffer.alloc(4);
  const m = create_mem_mapper(img);

  const obj = {
    x: m.u8(),
    struct: m.struct(() => ({
      a: m.u8(),
      b: m.u8(),
    })),
    y: m.u8(),
  };

  expect(obj.struct.__raw.addr).toBe(1);
  expect(obj.struct.__raw.size).toBe(2);

  obj.struct.a.set(1);
  obj.struct.b.set(2);
  obj.y.set(3);

  expect(img).toEqual(Buffer.from([0, 1, 2, 3]));

  obj.struct.__raw.set(Buffer.from([2, 42]));

  expect(img).toEqual(Buffer.from([0, 2, 42, 3]));
});

test("Navigation", () => {
  const img = Buffer.alloc(128);
  const m = create_mem_mapper(img);

  expect(m.addr).toBe(0);

  m.u8();

  expect(m.addr).toBe(1);

  m.seek(10);

  expect(m.addr).toBe(10);

  m.offset(2);

  expect(m.addr).toBe(12);

  const skipResult = m.skip(2, {});

  expect(m.addr).toBe(14);
  expect(skipResult).toEqual({});

  m.at(100, () => {
    expect(m.addr).toBe(100);

    const u16 = m.u16();
    u16.set(123);

    expect(m.addr).toBe(102);
    expect(img.readUInt16LE(100)).toBe(123);
  });

  expect(m.addr).toBe(14);
});

test("Array", () => {
  const img = Buffer.alloc(128);
  const m = create_mem_mapper(img);

  const a = m.array(10, () => m.u8());

  expect(a.length).toBe(10);
  expect(m.addr).toBe(10);
});

test("set_string()", () => {
  const img = Buffer.alloc(128);
  const m = create_mem_mapper(img);

  const s = m.str(16);

  set_string(s, "hello");

  expect(s.get()).toBe("hello".padEnd(16, "\xFF"));

  set_string(s, "hello", "\x00");

  expect(s.get()).toBe("hello".padEnd(16, "\x00"));
});

test("To JS", () => {
  const img = Buffer.alloc(128);
  const m = create_mem_mapper(img);

  const obj = {
    custom_meta: "Hello, world!",
    empty1: null,
    empty2: undefined,
    number: m.u16(),
    raw: m.buf(4),
    list: m.array(4, () =>
      m.struct(() => ({
        id: m.u8(),
        ...m.bitmap({ deleted: 1, type: 3, _: 4 }),
        name: m.str(14),
      }))
    ),
  };

  expect(to_js(obj)).toEqual({
    custom_meta: undefined,
    empty1: null,
    empty2: undefined,
    number: 0,
    raw: "00 00 00 00",
    list: new Array(4).fill({ id: 0, deleted: 0, type: 0, name: "".padEnd(14, "\x00") }),
  });
});

test("Bits size", () => {
  const img = Buffer.alloc(16);
  const m = create_mem_mapper(img);

  img.writeUInt8(0b10101010, 0);
  img.writeUInt16LE(0b0101010101010101, 1);
  img.writeUInt32LE(0b11001100110011001100110011001100, 3);

  const b1 = m.bitmap({ all: 8 });
  expect(b1.all.get()).toBe(0b10101010);

  b1.all.set(0b11111111);
  expect(b1.all.get()).toBe(0b11111111);

  const b2 = m.bitmap({ all: 16 }, m.u16());
  expect(b2.all.get()).toBe(0b0101010101010101);

  b2.all.set(0b1111111111111111);
  expect(b2.all.get()).toBe(0b1111111111111111);

  const b4 = m.bitmap({ all: 32 }, m.u32());
  expect(b4.all.get()).toBe(0b11001100110011001100110011001100);

  b4.all.set(0b11111111111111111111111111111111);
  expect(b4.all.get()).toBe(0b11111111111111111111111111111111);

  expect(() => m.bitmap({ all: 6 })).toThrow();
  expect(() => m.bitmap({ all: 12 })).toThrow();
  expect(() => m.bitmap({ all: 24 })).toThrow();
  expect(() => m.bitmap({ all: 40 })).toThrow();
});
