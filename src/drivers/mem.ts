import type { Buffer } from "buffer";

export namespace M {
  export type U8Ptr = { addr: number; get(i: number): number; set(i: number, val: number): void };
  export type U8 = { addr: number; get(): number; set(val: number): void };
  export type U16 = { addr: number; get(): number; set(val: number): void };
  export type U8array = {
    addr: number;
    size: number;
    get(): number[];
    set(val: number[]): void;
  };
  export type Bits = { raw: U8; bits: number[]; get(): number; set(val: number): void };
  export type LBCD = {
    raw: U8array;
    get(): number;
    set(val: number): void;
    setDigit(order: number, val: number): void;
  };
  export type Str = { raw: U8array; get(): string; set(val: string): void };
}

export type MemMapper = {
  seek: (addr: number) => MemMapper;
  skip: <R>(size: number, ret: R) => R;
  u8_ptr: () => M.U8Ptr;
  u8: () => M.U8;
  u16: () => M.U16;
  u8_array: (size: number) => M.U8array;
  bits: <T extends string>(...names: (T | null)[]) => { [K in T]: M.Bits };
  bitmap: <T extends string>(names: { [K in T]: number }) => { [K in T]: M.Bits };
  lbcd: (size: number) => M.LBCD;
  str: (size: number) => M.Str;
  struct: <T extends object>(fn: (mapper: MemMapper) => T) => T & { __raw: M.U8array };
};

export const create_mem_mapper = (data: Buffer, onchange?: () => void): MemMapper => {
  let cur = 0;

  const mapper: MemMapper = {
    seek: (addr: number) => {
      cur = addr;
      return mapper;
    },

    skip: <R>(size: number, ret: R): R => {
      cur += size;
      return ret;
    },

    u8_ptr: (): M.U8Ptr => {
      const _cur = cur;
      return {
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

    u8_array: (size: number): M.U8array => {
      const _cur = cur;
      cur += size;
      return {
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

    bits: <T extends string>(...names: (T | null)[]): { [K in T]: M.Bits } => {
      const raw = mapper.u8();

      const res = {} as { [K in T]: M.Bits };
      const nameBits = {} as { [K in T]: number[] };

      for (let i = 0; i < 8; i += 1) {
        const name = names[i];
        if (!name) continue;

        (nameBits[name] ||= []).push(7 - i);
      }

      for (const name in nameBits) {
        const bits = nameBits[name];

        res[name] = {
          raw,
          bits,
          get: () => {
            const raw_val = raw.get();
            let val = 0;
            for (let i = 0; i < bits.length; i += 1) {
              val |= ((raw_val >> bits[i]) & 1) << i;
            }
            return val;
          },
          set: (value) => {
            let raw_val = raw.get();
            for (let i = 0; i < bits.length; i += 1) {
              raw_val &= ~(1 << bits[i]);
              raw_val |= ((value >> i) & 1) << bits[i];
            }
            raw.set(raw_val);
          },
        };
      }

      return res;
    },
    bitmap: <T extends string>(names: { [K in T]: number }): { [K in T]: M.Bits } => {
      const args: string[] = [];

      for (const [name, size] of Object.entries<number>(names)) {
        args.push(...Array(size).fill(name));
      }

      return mapper.bits(...args) as { [K in T]: M.Bits };
    },

    lbcd: (size: number): M.LBCD => {
      const _cur = cur;
      const raw = mapper.u8_array(size);

      return {
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

      return { ...props, __raw: mapper.seek(begin_cur).u8_array(end_cur - begin_cur) };
    },
  };

  return mapper;
};

type ToJS<T = unknown> = T extends null | undefined
  ? T
  : T extends Array<infer E>
  ? ToJS<E>
  : T extends { size: number; get(i: number): infer V }
  ? V[]
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
      const get = value.get;

      if ("size" in value) {
        return Array(value.size)
          .fill(0)
          .map((_, i) => get(i)) as ToJS<T>;
      }

      return get() as ToJS<T>;
    }

    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, to_js(v)])) as ToJS<T>;
  }

  return undefined as ToJS<T>;
};

export const dup = <T extends string | null>(size: number, value: T): T[] => Array(size).fill(value);
export const array_of = <T>(size: number, fn: (i: number) => T): T[] =>
  Array(size)
    .fill(0)
    .map((_, i) => fn(i));
