import type { Buffer } from "buffer";

export type MemRef = { addr: number; get(): number; set(val: number): void };

export const create_mem_reader = (data: Buffer, onchange?: () => void) => {
  let cur = 0;

  const reader = {
    seek: (addr: number) => {
      cur = addr;
      return reader;
    },

    u8: (): MemRef => {
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
    u8_: (size: number) => {
      const bytes: MemRef[] = [];
      for (let i = 0; i < size; i += 1) bytes.push(reader.u8());
      return bytes;
    },

    skip: (size: number): object | null => {
      cur += size;
      return null;
    },
  };

  return reader;
};

export const ref_bits = <T extends string>(ref: MemRef, names: (T | null)[]): { [K in T]: MemRef } => {
  const res = {} as { [K in T]: MemRef };

  const nameBits = {} as { [K in T]: number[] };

  for (let i = 0; i < names.length; i += 1) {
    const name = names[i];
    if (!name) continue;

    (nameBits[name] ||= []).push(i);
  }

  for (const name in nameBits) {
    const bits = nameBits[name];

    res[name] = {
      addr: ref.addr + bits[0],
      get: () => {
        const raw = ref.get();
        let value = 0;
        for (let i = 0; i < bits.length; i += 1) {
          value |= ((raw >> bits[i]) & 1) << i;
        }
        return value;
      },
      set: (value) => {
        let raw = ref.get();
        for (let i = 0; i < bits.length; i += 1) {
          raw &= ~(1 << bits[i]);
          raw |= ((value >> i) & 1) << bits[i];
        }
        ref.set(raw);
      },
    };
  }

  return res;
};

export const ref_lbcd = (refs: MemRef[]): MemRef => {
  const size = refs.length;

  return {
    addr: refs[0].addr,
    get: () => {
      const digits: number[] = [];

      for (let i = size - 1; i >= 0; i--) {
        const byte = refs[i].get();
        const high = (byte >> 4) & 0x0f;
        const low = byte & 0x0f;

        if (high > 9 || low > 9) return 0;

        digits.push(high, low);
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

        refs[size - 1 - i / 2].set((high << 4) | low);
      }
    },
  };
};

export const dup = <T extends string | null>(size: number, value: T): T[] => Array(size).fill(value);
