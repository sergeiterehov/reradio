import { Buffer } from "buffer";

export namespace M {
  export type Type<S extends string = string, T = unknown> = {
    _m_type: S;
    __raw: Buf;
    get(): T;
    set(val: T): void;
  };
  export type U8 = Type<"u8", number>;
  export type U16 = Type<"u16", number>;
  export type S16 = Type<"s16", number>;
  export type U32 = Type<"u32", number>;
  export type Buf = Omit<Type<"buf", Buffer>, "__raw"> & {
    __view: Buffer;
    addr: number;
    size: number;
    fill(val: number): void;
  };
  export type Str = Type<"str", string> & { size: number };
  export type Bits = Type<"u8bits", number> & { bits: number[] };
  export type LBCD = Type<"lbcd", number> & {
    setDigit(order: number, val: number): void;
  };
  export type Struct<T extends object> = Omit<Type<"struct", never>, "get" | "set"> & T;
}

export type MemMapper = {
  readonly addr: number;
  seek: (addr: number) => MemMapper;
  offset: (offset: number) => MemMapper;
  at: <T>(addr: number, fn: (mapper: MemMapper) => T) => T;
  skip: <R>(size: number, ret: R) => R;
  u8: () => M.U8;
  u16: () => M.U16;
  s16: () => M.S16;
  u32: () => M.U32;
  buf: (size: number) => M.Buf;
  bitmap: <T extends string>(
    names: { [K in T]: number },
    origin?: M.Type<string, number>
  ) => { [K in Exclude<T, "" | `_${string}`>]: M.Bits };
  lbcd: (size: number) => M.LBCD;
  str: (size: number) => M.Str;
  struct: <T extends object>(fn: (mapper: MemMapper) => T) => M.Struct<T>;
  array: <T>(size: number, fn: (i: number, mapper: MemMapper) => T) => T[];
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

    u8: (): M.U8 => {
      const _cur = cur;
      const buf = mapper.buf(1);
      return {
        _m_type: "u8",
        __raw: buf,
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
      const buf = mapper.buf(2);
      return {
        _m_type: "u16",
        __raw: buf,
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
      const buf = mapper.buf(2);
      return {
        _m_type: "s16",
        __raw: buf,
        get: () => {
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
      const buf = mapper.buf(4);
      return {
        _m_type: "u32",
        __raw: buf,
        get: () => {
          return data.readUInt32LE(_cur);
        },
        set: (val) => {
          data.writeUInt32LE(val, _cur);
          onchange?.();
        },
      };
    },

    buf: (size: number): M.Buf => {
      const _cur = cur;
      cur += size;
      return {
        _m_type: "buf",
        __view: data.slice(_cur, _cur + size),
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
        fill: (val) => {
          data.fill(val, _cur, _cur + size);
          onchange?.();
        },
      };
    },

    bitmap: <T extends string>(
      names: { [K in T]: number },
      origin: M.Type<string, number> = mapper.u8()
    ): { [K in T]: M.Bits } => {
      const bitsize = origin.__raw.size * 8;

      if (Object.values<number>(names).reduce((a, s) => a + s, 0) !== bitsize) {
        throw new Error("Wrong bit size");
      }

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
          __raw: origin.__raw,
          bits,
          get: () => {
            const raw_val = origin.get();
            let val = 0;
            for (let i = 0; i < bits.length; i += 1) {
              val = (val | (((raw_val >> (bitsize - 1 - bits[i])) & 1) << (bits.length - 1 - i))) >>> 0;
            }
            return val;
          },
          set: (value) => {
            let raw_val = origin.get();
            for (let i = 0; i < bits.length; i += 1) {
              raw_val = (raw_val & ~(1 << (bitsize - 1 - bits[i]))) >>> 0;
              raw_val = (raw_val | (((value >> (bits.length - 1 - i)) & 1) << (bitsize - 1 - bits[i]))) >>> 0;
            }
            origin.set(raw_val);
          },
        };

        res[name as T] = ref;
      }

      return res;
    },

    lbcd: (size: number): M.LBCD => {
      const _cur = cur;
      const buf = mapper.buf(size);
      const view = data.slice(_cur, _cur + size);

      return {
        _m_type: "lbcd",
        __raw: buf,
        get: () => {
          const digits: number[] = [];

          for (let i = size - 1; i >= 0; i--) {
            const byte = view[i];
            digits.push((byte >> 4) & 0x0f, byte & 0x0f);
          }

          return Number(digits.join(""));
        },
        set: (value) => {
          const digits = String(value >>> 0)
            .padStart(size * 2, "0")
            .split("")
            .map(Number);
          if (digits.length > size * 2) throw new Error("Wrong number length");

          for (let i = 0; i < size * 2; i += 2) {
            const high = digits[i];
            const low = digits[i + 1];

            view[size - 1 - i / 2] = (high << 4) | low;
          }

          onchange?.();
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
      const buf = mapper.buf(size);
      return {
        _m_type: "str",
        __raw: buf,
        size,
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

      const size = end_cur - begin_cur;

      cur = begin_cur;
      const buf = mapper.buf(size);

      return { ...props, _m_type: "struct", __raw: buf };
    },

    array: (size, fn) =>
      Array(size)
        .fill(0)
        .map((_, i) => fn(i, mapper)),
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

export const set_string = (str: M.Str, val: string, pad = "\xFF") => {
  return str.set(val.substring(0, str.size).padEnd(str.size, pad));
};
