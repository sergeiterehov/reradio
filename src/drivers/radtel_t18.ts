import { Buffer } from "buffer";
import { Radio } from "./radio";
import { create_mem_reader, ref_bits, ref_lbcd, type MemRef, dup } from "./utils";
import type { UI } from "./ui";

const CMD_ACK = Buffer.from([0x06]);
const CMD_EXIT = Buffer.from("b", "ascii");

type Mem = {
  memory: {
    rxfreq: MemRef;
    txfreq: MemRef;
    rxtone: MemRef;
    txtone: MemRef;
    flags: {
      jumpcode: MemRef;
      skip: MemRef;
      highpower: MemRef;
      narrow: MemRef;
      bcl: MemRef;
    };
  }[];
  settings: {
    voice: MemRef;
    language: MemRef;
    scan: MemRef;
    vox: MemRef;
    vox_level: MemRef;
    lovoltnotx: MemRef;
    hivoltnotx: MemRef;
    unknown2: MemRef[];
    rogerbeep: MemRef;
    batterysaver: MemRef;
    beep: MemRef;
    squelchlevel: MemRef;
    timeouttimer: MemRef;
    tail: MemRef;
    channel: MemRef;
  };
};

function parseMem(channels: number, data: Buffer, onchange?: () => void) {
  const memory: Mem["memory"] = [];

  const r = create_mem_reader(data, onchange);

  r.seek(0x0000);

  for (let i = 0; i < channels; i += 1) {
    memory.push({
      rxfreq: ref_lbcd(r.u8_(4)),
      txfreq: ref_lbcd(r.u8_(4)),
      rxtone: ref_lbcd(r.u8_(2)),
      txtone: ref_lbcd(r.u8_(2)),
      flags: ref_bits(r.u8(), ["jumpcode", null, null, "skip", "highpower", "narrow", null, "bcl"]),
      ...r.skip(3),
    });
  }

  r.seek(0x0630);

  const settings: Mem["settings"] = {
    ...ref_bits(r.u8(), [...dup(7, null), "voice"]),
    ...ref_bits(r.u8(), [...dup(7, null), "language"]),
    ...ref_bits(r.u8(), [...dup(7, null), "scan"]),
    ...ref_bits(r.u8(), [...dup(7, null), "vox"]),
    ...ref_bits(r.u8(), [...dup(5, null), ...dup(3, "vox_level")]),

    ...ref_bits(r.u8(), [...dup(7, null), "lovoltnotx"]),
    ...ref_bits(r.u8(), [...dup(7, null), "hivoltnotx"]),
    unknown2: r.u8_(8),

    ...ref_bits(r.u8(), [...dup(5, null), "rogerbeep", "batterysaver", "beep"]),
    squelchlevel: r.u8(),
    timeouttimer: r.u8(),
    ...ref_bits(r.u8(), [...dup(7, null), "tail"]),
    channel: r.u8(),
  };

  const mem: Mem = {
    memory,
    settings,
  };

  return mem;
}

export class T18Radio extends Radio {
  vendor = "Radtel";
  model = "T18";

  protected _echo = false;
  protected _fingerprint = [Buffer.from("SMP558\x00\x00", "ascii")];
  protected _magic = Buffer.from("1ROGRAM", "ascii");
  protected _memSize = 0x03f0;
  protected _ackBlock = true;
  protected _blockSize = 0x08;
  protected _channels = 16;
  protected CMD_EXIT = Buffer.from("b", "ascii");

  protected _img?: Buffer;
  protected _mem?: Mem;

  constructor() {
    super();
  }

  protected async _enterProgrammingMode() {
    const _magic = Buffer.concat([Buffer.from([0x02]), this._magic]);

    await this._serial_write(_magic);
    if (this._echo) await this._serial_read(_magic.length);

    // Читаем ACK
    const ack1 = await this._serial_read(1);
    if (ack1[0] !== CMD_ACK[0]) {
      throw new Error("Radio refused to enter programming mode");
    }

    // Отправляем 0x02 и читаем идентификатор (8 байт)
    await this._serial_write(Buffer.from([0x02]));

    if (this._echo) await this._serial_read(1);

    const ident = await this._serial_read(8);

    // Проверка по отпечаткам
    const matchesFingerprint = this._fingerprint.some((fp) => ident.slice(0, fp.length).equals(fp));

    if (!matchesFingerprint) {
      throw new Error("Radio identification failed.");
    }

    // Отправляем ACK и читаем подтверждение
    await this._serial_write(CMD_ACK);
    if (this._echo) await this._serial_read(CMD_ACK.length);

    const ack2 = await this._serial_read(1);

    if (this.model === "RT647") {
      if (ack2[0] !== 0xf0) {
        throw new Error("Radio refused to enter programming mode");
      }
    } else {
      if (ack2[0] !== CMD_ACK[0]) {
        throw new Error("Radio refused to enter programming mode");
      }
    }
  }

  protected async _exitProgrammingMode() {
    await this._serial_write(CMD_EXIT);
    if (this._echo) await this._serial_read(CMD_EXIT.length);
  }

  protected async _readBlock(addr: number, size: number) {
    const cmd = new Buffer(4);
    cmd.write("R", 0);
    cmd.writeInt16BE(addr, 1);
    cmd.writeUInt8(size, 3);

    await this._serial_write(cmd);
    if (this._echo) await this._serial_read(cmd.length);

    const res = await this._serial_read(4 + size);
    const expected = Buffer.concat([Buffer.from("W"), cmd.slice(1)]);
    if (Buffer.compare(expected, res.slice(0, expected.length)) !== 0) {
      throw new Error(`Error riding block 0x${addr.toString(16)}`);
    }

    const data = res.slice(4);

    if (this._ackBlock) {
      await this._serial_write(CMD_ACK);
      if (this._echo) await this._serial_read(CMD_ACK.length);

      const ack = await this._serial_read(1);
      if (!ack.equals(CMD_ACK)) throw new Error(`No ACK reading block 0x${addr.toString(16)}`);
    }

    return data;
  }

  protected async _writeBlock(data: Buffer, addr: number) {
    const cmd = new Buffer(4);
    cmd.write("W", 0);
    cmd.writeInt16BE(addr, 1);
    cmd.writeUInt8(data.length, 3);

    await this._serial_write(Buffer.concat([cmd, data]));
    if (this._echo) await this._serial_read(cmd.length + data.length);

    const sck = await this._serial_read(1);
    if (!sck.equals(CMD_ACK)) throw new Error("No ACK");
  }

  async read(onProgress: (k: number) => void) {
    onProgress(0);

    this._img = undefined;
    this._mem = undefined;

    const { _memSize, _blockSize } = this;

    await this._enterProgrammingMode();

    onProgress(0.1);

    const blocks: Buffer[] = [];

    for (let addr = 0; addr < _memSize; addr += _blockSize) {
      const block = await this._readBlock(addr, _blockSize);
      blocks.push(block);

      // console.log(addr, block.toHex());
      onProgress(0.1 + 0.8 * ((addr + _blockSize) / _memSize));
    }

    await this._exitProgrammingMode();

    const data = Buffer.concat(blocks);
    this._img = data;

    const mem = parseMem(this._channels, data, () => this.dispatch_ui());
    this._mem = mem;

    onProgress(1);
  }

  async write(onProgress: (k: number) => void) {
    onProgress(0);

    if (!this._img) throw new Error("No data read");

    const { _memSize, _blockSize } = this;

    await this._enterProgrammingMode();

    onProgress(0.1);

    for (let addr = 0; addr < _memSize; addr += _blockSize) {
      const block = this._img.slice(addr, addr + _blockSize);

      await this._writeBlock(block, addr);

      // console.log(addr, block.toHex());
      onProgress(0.1 + 0.8 * ((addr + _blockSize) / _memSize));
    }

    await this._exitProgrammingMode();

    onProgress(1);
  }
}

export class RB18Radio extends T18Radio {
  vendor = "Retevis";
  model = "RB18";

  protected _magic = Buffer.from("PROGRAL", "ascii");
  protected _fingerprint = [Buffer.from("P3107\xF7", "ascii")];
  protected _memSize = 0x0660;
  protected _blockSize = 0x10;
  protected _channels = 22;
  protected CMD_EXIT = Buffer.from("E", "ascii");
}

export class RB618Radio extends RB18Radio {
  vendor = "Retevis";
  model = "RB618";

  protected _channels = 16;

  ui() {
    if (!this._mem) return [];

    const { settings } = this._mem;

    const ui: UI.Field.Any[] = [
      {
        type: "switcher",
        id: "beep",
        name: "Beep",
        get: () => (settings.beep.get() ? true : false),
        set: (val) => settings.beep.set(val ? 1 : 0),
      },
      {
        type: "select",
        id: "language",
        name: "Voice language",
        options: [
          { value: 0, name: "China" },
          { value: 1, name: "English" },
        ],
        get: () => settings.language.get(),
        set: (val) => settings.language.set(Number(val)),
      },
    ];

    return ui;
  }
}
