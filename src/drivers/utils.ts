import type { Buffer } from "buffer";

export namespace M {
  export type U8 = { addr: number; get(): number; set(val: number): void };
  export type U8array = { addr: number; size: number; get(i: number): number; set(i: number, val: number): void };
  export type Bits = { raw: U8; bits: number[]; get(): number; set(val: number): void };
  export type LBCD = {
    raw: U8array;
    get(): number;
    set(val: number): void;
    setDigit(order: number, val: number): void;
  };
}

export type MemReader = {
  seek: (addr: number) => MemReader;
  skip: <R>(size: number, ret: R) => R;
  u8: () => M.U8;
  u8_array: (size: number) => M.U8array;
  bits: <T extends string>(...names: (T | null)[]) => { [K in T]: M.Bits };
  lbcd: (size: number) => M.LBCD;
};

export const create_mem_mapper = (data: Buffer, onchange?: () => void): MemReader => {
  let cur = 0;

  const mapper = {
    seek: (addr: number) => {
      cur = addr;
      return mapper;
    },

    skip: <R>(size: number, ret: R): R => {
      cur += size;
      return ret;
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
    u8_array: (size: number): M.U8array => {
      const _cur = cur;
      cur += size;
      return {
        addr: _cur,
        size,
        get: (i) => {
          return data.readUInt8(_cur + i);
        },
        set: (i, val) => {
          data.writeUInt8(val, _cur + i);
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

    lbcd: (size: number): M.LBCD => {
      const raw = mapper.u8_array(size);

      return {
        raw,
        get: () => {
          const digits: number[] = [];

          for (let i = size - 1; i >= 0; i--) {
            const byte = raw.get(i);
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

            raw.set(size - 1 - i / 2, (high << 4) | low);
          }
        },
        setDigit: (order, value) => {
          const q = 4 * (order % 2);
          const byte = (order / 2) >>> 0;
          raw.set(byte, (raw.get(byte) & ~(0x0f << q)) | ((value & 0xf) << q));
        },
      };
    },
  };

  return mapper;
};

export const dup = <T extends string | null>(size: number, value: T): T[] => Array(size).fill(value);
