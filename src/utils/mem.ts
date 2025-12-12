import { Buffer } from "buffer";

export namespace M {
  export type U8Ptr = { _m_type: "u8ptr"; addr: number; get(i: number): number; set(i: number, val: number): void };
  export type U8 = { _m_type: "u8"; addr: number; get(): number; set(val: number): void };
  export type U16 = { _m_type: "u16"; addr: number; get(): number; set(val: number): void };
  export type S16 = { _m_type: "s16"; addr: number; get(): number; set(val: number): void };
  export type U32 = { _m_type: "u32"; addr: number; get(): number; set(val: number): void };
  export type U8array = {
    _m_type: "u8array";
    addr: number;
    size: number;
    get(): number[];
    set(val: number[]): void;
  };
  export type Buf = {
    _m_type: "buf";
    addr: number;
    size: number;
    get(): Buffer;
    set(val: Buffer): void;
  };
  export type Bits = { _m_type: "u8bits"; raw: U8; bits: number[]; get(): number; set(val: number): void };
  export type LBCD = {
    _m_type: "lbcd";
    raw: U8array;
    get(): number;
    set(val: number): void;
    setDigit(order: number, val: number): void;
  };
  export type Str = { _m_type: "str"; raw: U8array; get(): string; set(val: string): void };
  export type Struct<T extends object> = { _m_type: "struct"; __raw: U8array } & T;
}

export type MemMapper = {
  readonly addr: number;
  seek: (addr: number) => MemMapper;
  offset: (offset: number) => MemMapper;
  at: <T>(addr: number, fn: (mapper: MemMapper) => T) => T;
  skip: <R>(size: number, ret: R) => R;
  u8_ptr: () => M.U8Ptr;
  u8: () => M.U8;
  u16: () => M.U16;
  s16: () => M.S16;
  u32: () => M.U32;
  u8_array: (size: number) => M.U8array;
  buf: (size: number) => M.Buf;
  bitmap: <T extends string>(names: { [K in T]: number }) => { [K in Exclude<T, "" | `_${string}`>]: M.Bits };
  lbcd: (size: number) => M.LBCD;
  str: (size: number) => M.Str;
  struct: <T extends object>(fn: (mapper: MemMapper) => T) => M.Struct<T>;
};

export const create_mem_mapper = (data: Buffer, onchange?: () => void): MemMapper => {
  let cur = 0;

  const mapper: MemMapper = {
    get addr() {
      return cur;
    },

    seek: (addr: number) => {
      cur = addr;
      return mapper;
    },

    offset: (offset: number) => {
      cur += offset;
      return mapper;
    },

    at: (addr, fn) => {
      const prev = cur;
      try {
        cur = addr;
        return fn(mapper);
      } finally {
        cur = prev;
      }
    },

    skip: <R>(size: number, ret: R): R => {
      cur += size;
      return ret;
    },

    u8_ptr: (): M.U8Ptr => {
      const _cur = cur;
      return {
        _m_type: "u8ptr",
        addr: _cur,
        get: (i) => {
          return data.readUInt8(_cur + i);
        },
        set: (i, val) => {
          data.writeUInt8(val, _cur + i);
          onchange?.();
        },
      };
    },

    u8: (): M.U8 => {
      const _cur = cur;
      cur += 1;
      return {
        _m_type: "u8",
        addr: _cur,
        get: () => {
          return data.readUInt8(_cur);
        },
        set: (val) => {
          data.writeUInt8(val, _cur);
          onchange?.();
        },
      };
    },

    u16: (): M.U16 => {
      const _cur = cur;
      cur += 2;
      return {
        _m_type: "u16",
        addr: _cur,
        get: () => {
          return data.readUInt16LE(_cur);
        },
        set: (val) => {
          data.writeUInt16LE(val, _cur);
          onchange?.();
        },
      };
    },

    s16: (): M.S16 => {
      const _cur = cur;
      cur += 2;
      return {
        _m_type: "s16",
        addr: _cur,
        get: () => {
          console.log("Reading S16 at", _cur, "value:", data.slice(_cur, _cur + 2));
          return data.readInt16LE(_cur);
        },
        set: (val) => {
          data.writeInt16LE(val, _cur);
          onchange?.();
        },
      };
    },

    u32: (): M.U32 => {
      const _cur = cur;
      cur += 4;
      return {
        _m_type: "u32",
        addr: _cur,
        get: () => {
          return data.readUInt32LE(_cur);
        },
        set: (val) => {
          data.writeUInt32LE(val, _cur);
          onchange?.();
        },
      };
    },

    u8_array: (size: number): M.U8array => {
      const _cur = cur;
      cur += size;
      return {
        _m_type: "u8array",
        addr: _cur,
        size,
        get: () => {
          const res: number[] = [];
          for (let i = 0; i < size; i += 1) res.push(data.readUInt8(_cur + i));
          return res;
        },
        set: (vals) => {
          if (size !== vals.length) throw new Error("Wrong array length");

          for (let i = 0; i < size; i += 1) data.writeUInt8(vals[i], _cur + i);
          onchange?.();
        },
      };
    },

    buf: (size: number): M.Buf => {
      const _cur = cur;
      cur += size;
      return {
        _m_type: "buf",
        addr: _cur,
        size,
        get: () => {
          return Buffer.from(data.slice(_cur, _cur + size));
        },
        set: (val) => {
          if (size !== val.length) throw new Error("Wrong buffer length");

          val.copy(data, _cur);
          onchange?.();
        },
      };
    },

    bitmap: <T extends string>(names: { [K in T]: number }): { [K in T]: M.Bits } => {
      const raw = mapper.u8();

      const res = {} as { [K in T]: M.Bits };
      let bitCursor = 0;

      for (const [name, size] of Object.entries<number>(names)) {
        const bits: number[] = [];

        for (let i = 0; i < size; i += 1) {
          bits.push(bitCursor);
          bitCursor += 1;
        }

        // Важно! делать это после увеличения bitCursor
        if (!name || name.startsWith("_")) continue;

        const ref: M.Bits = {
          _m_type: "u8bits",
          raw,
          bits,
          get: () => {
            const raw_val = raw.get();
            let val = 0;
            for (let i = 0; i < bits.length; i += 1) {
              val |= ((raw_val >> (7 - bits[i])) & 1) << (bits.length - 1 - i);
            }
            return val;
          },
          set: (value) => {
            let raw_val = raw.get();
            for (let i = 0; i < bits.length; i += 1) {
              raw_val &= ~(1 << (7 - bits[i]));
              raw_val |= ((value >> (bits.length - 1 - i)) & 1) << (7 - bits[i]);
            }
            raw.set(raw_val);
          },
        };

        res[name as T] = ref;
      }

      return res;
    },

    lbcd: (size: number): M.LBCD => {
      const _cur = cur;
      const raw = mapper.u8_array(size);

      return {
        _m_type: "lbcd",
        raw,
        get: () => {
          const digits: number[] = [];
          const bytes = raw.get();

          for (let i = size - 1; i >= 0; i--) {
            const byte = bytes[i];
            digits.push((byte >> 4) & 0x0f, byte & 0x0f);
          }

          return Number(digits.join(""));
        },
        set: (value) => {
          const bytes = raw.get();
          const digits = String(value >>> 0)
            .padStart(size * 2, "0")
            .split("")
            .map(Number);
          if (digits.length > size * 2) throw new Error("Wrong number length");

          for (let i = 0; i < size * 2; i += 2) {
            const high = digits[i];
            const low = digits[i + 1];

            bytes[size - 1 - i / 2] = (high << 4) | low;
          }

          raw.set(bytes);
        },
        setDigit: (order, value) => {
          const q = 4 * (order % 2);
          const byte = (order / 2) >>> 0;

          data.writeUInt8((data.readUInt8(_cur + byte) & ~(0x0f << q)) | ((value & 0xf) << q), _cur + byte);
          onchange?.();
        },
      };
    },

    str: (size: number) => {
      const _cur = cur;
      const raw = mapper.u8_array(size);

      return {
        _m_type: "str",
        raw,
        get: () => {
          const chars: string[] = [];
          for (let i = 0; i < size; i += 1) {
            chars.push(String.fromCharCode(data.readUInt8(_cur + i)));
          }
          return chars.join("");
        },
        set: (val: string) => {
          if (val.length !== size) throw new Error("String has wrong len");

          for (let i = 0; i < size; i += 1) {
            data.writeUInt8(val.charCodeAt(i), _cur + i);
          }

          onchange?.();
        },
      };
    },

    struct: (fn) => {
      const begin_cur = cur;
      const props = fn(mapper);
      const end_cur = cur;

      return { ...props, _m_type: "struct", __raw: mapper.seek(begin_cur).u8_array(end_cur - begin_cur) };
    },
  };

  return mapper;
};

type ToJS<T = unknown> = T extends null | undefined
  ? T
  : T extends Array<infer E>
  ? ToJS<E>[]
  : T extends { _m_type: "buf" }
  ? string
  : T extends { get(): infer V }
  ? V
  : T extends object
  ? { [K in keyof T]: ToJS<T[K]> }
  : undefined;

export const to_js = <T>(value: T): ToJS<T> => {
  if (value === null || value === undefined) return value as ToJS<T>;

  if (Array.isArray(value)) {
    return value.map(to_js) as ToJS<T>;
  }

  if (typeof value === "object") {
    if ("get" in value && typeof value.get === "function") {
      const got: unknown = value.get();

      if (Buffer.isBuffer(got)) {
        return got.toString("hex").toUpperCase().match(/../g)?.join(" ") as ToJS<T>;
      }

      return got as ToJS<T>;
    }

    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => k !== "" && !k.startsWith("_"))
        .map(([k, v]) => [k, to_js(v)])
    ) as ToJS<T>;
  }

  return undefined as ToJS<T>;
};

export const dup = <T extends string | null>(size: number, value: T): T[] => Array(size).fill(value);
export const array_of = <T>(size: number, fn: (i: number) => T): T[] =>
  Array(size)
    .fill(0)
    .map((_, i) => fn(i));

export const set_string = (str: M.Str, val: string, pad = "\xFF") => {
  return str.set(val.substring(0, str.raw.size).padEnd(str.raw.size, pad));
};
