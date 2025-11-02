import { Buffer } from "buffer";
import { Radio, type RadioInfo } from "./radio";
import { create_mem_mapper, dup, type M, type MemReader } from "./utils";
import type { UI } from "./ui";

const CMD_ACK = Buffer.from([0x06]);
const CMD_EXIT = Buffer.from("b", "ascii");

namespace T18Radio {
  export namespace Mem {
    export type Channel = {
      rxfreq: M.LBCD;
      txfreq: M.LBCD;
      rxtone: M.LBCD;
      txtone: M.LBCD;
      flags: {
        jumpcode: M.Bits;
        skip: M.Bits;
        highpower: M.Bits;
        narrow: M.Bits;
        bcl: M.Bits;
      };
    };

    export type Settings = {
      voice: M.Bits;
      language: M.Bits;
      scan: M.Bits;
      vox: M.Bits;
      vox_level: M.Bits;
      lovoltnotx: M.Bits;
      hivoltnotx: M.Bits;
      rogerbeep: M.Bits;
      batterysaver: M.Bits;
      beep: M.Bits;
      squelchlevel: M.U8;
      timeouttimer: M.U8;
      tail: M.Bits;
      channel: M.U8;
    };
  }

  export type Mem = {
    _reader: MemReader;
    memory: Mem.Channel[];
    settings: Mem.Settings;
  };
}

export class T18Radio extends Radio {
  static Info: RadioInfo = {
    vendor: "Radtel",
    model: "T18",
  };

  protected static _uiSquelch(getRef: (i: number) => M.LBCD): UI.Field.Channels["squelch_rx"] {
    return {
      options: ["Off", "CTCSS", "DCS"],
      get: (i) => {
        const ref = getRef(i);

        if (ref.raw.get(0) === 0xff) return { mode: "Off" };

        const tone = ref.get();

        if (tone >= 12_000) return { mode: "DCS", polarity: "I", code: tone - 12_000 };
        if (tone >= 8_000) return { mode: "DCS", polarity: "N", code: tone - 8_000 };

        return { mode: "CTCSS", freq: tone / 10 };
      },
      set: (i, val) => {
        const ref = getRef(i);

        if (val.mode === "Off") {
          ref.raw.set(0, 0xff);
          ref.raw.set(1, 0xff);
        } else if (val.mode === "CTCSS") {
          ref.set(val.freq * 10);
        } else if (val.mode === "DCS") {
          ref.set(val.code % 1_000);
          ref.setDigit(3, val.polarity === "I" ? 12 : 8);
        }
      },
    };
  }

  protected static _uiChannels(channels: T18Radio.Mem.Channel[]): UI.Field.Channels {
    return {
      type: "channels",
      id: "channels",
      name: "Channels",
      tab: "Channels",
      get: () => channels.length,
      set: () => {},
      size: 16,
      channel: { get: (i) => `CH ${i + 1}` },
      freq: {
        get: (i) => channels[i].rxfreq.get() * 10,
        set: (i, val) => {
          channels[i].rxfreq.set(val / 10);
          channels[i].txfreq.set(val / 10);
        },
      },
      mode: {
        options: ["FM", "NFM"],
        get: (i) => (channels[i].flags.narrow.get() ? "NFM" : "FM"),
        set: (i, val) => channels[i].flags.narrow.set(val === "NFM" ? 1 : 0),
      },
      squelch_rx: T18Radio._uiSquelch((i) => channels[i].rxtone),
      squelch_tx: T18Radio._uiSquelch((i) => channels[i].txtone),
    };
  }

  protected _echo = false;
  protected _fingerprint = [Buffer.from("SMP558\x00\x00", "ascii")];
  protected _magic = Buffer.from("1ROGRAM", "ascii");
  protected _memSize = 0x03f0;
  protected _ackBlock = true;
  protected _blockSize = 0x08;
  protected _channels = 16;
  protected CMD_EXIT = Buffer.from("b", "ascii");

  protected _img?: Buffer;
  protected _mem?: T18Radio.Mem;

  constructor() {
    super();
  }

  protected _parse(data: Buffer) {
    const channels: T18Radio.Mem.Channel[] = [];

    const r = create_mem_mapper(data, this.dispatch_ui);

    r.seek(0x0000);

    for (let i = 0; i < this._channels; i += 1) {
      channels.push({
        rxfreq: r.lbcd(4),
        txfreq: r.lbcd(4),
        rxtone: r.lbcd(2),
        txtone: r.lbcd(2),
        flags: r.bits("jumpcode", null, null, "skip", "highpower", "narrow", null, "bcl"),
        ...r.skip(3, {}),
      });
    }

    r.seek(0x0630);

    const settings: T18Radio.Mem["settings"] = {
      ...r.bits(...dup(7, null), "voice"),
      ...r.bits(...dup(7, null), "language"),
      ...r.bits(...dup(7, null), "scan"),
      ...r.bits(...dup(7, null), "vox"),
      ...r.bits(...dup(5, null), ...dup(3, "vox_level")),

      ...r.bits(...dup(7, null), "lovoltnotx"),
      ...r.bits(...dup(7, null), "hivoltnotx"),
      ...r.skip(8, {}),

      ...r.bits(...dup(5, null), "rogerbeep", "batterysaver", "beep"),
      squelchlevel: r.u8(),
      timeouttimer: r.u8(),
      ...r.bits(...dup(7, null), "tail"),
      channel: r.u8(),
    };

    const mem: T18Radio.Mem = {
      _reader: r,
      memory: channels,
      settings,
    };

    return mem;
  }

  protected _ui(): UI.Root {
    if (!this._mem) return [];

    const { settings, memory } = this._mem;

    const ui: UI.Root = [
      T18Radio._uiChannels(memory),
      {
        type: "switcher",
        id: "beep",
        name: "Beep",
        tab: "Feedback",
        get: () => (settings.beep.get() ? true : false),
        set: (val) => settings.beep.set(val ? 1 : 0),
      },
      {
        type: "switcher",
        id: "prompts",
        name: "Voice prompts",
        tab: "Feedback",
        get: () => settings.voice.get(),
        set: (val) => settings.voice.set(Number(val)),
      },
      {
        type: "select",
        id: "language",
        name: "Language",
        tab: "Feedback",
        options: [
          { value: 0, name: "English" },
          { value: 1, name: "Chinese" },
        ],
        get: () => settings.language.get(),
        set: (val) => settings.language.set(Number(val)),
      },
      {
        type: "select",
        id: "sql",
        name: "Squelch level",
        tab: "Radio",
        options: Array(10)
          .fill(0)
          .map((_, i) => ({ value: i, name: String(i) })),
        get: () => settings.squelchlevel.get(),
        set: (val) => settings.squelchlevel.set(Number(val)),
      },
      {
        type: "switcher",
        id: "roger",
        name: "Roger beep",
        tab: "Radio",
        get: () => settings.rogerbeep.get(),
        set: (val) => settings.rogerbeep.set(Number(val)),
      },
      {
        type: "switcher",
        id: "vox",
        name: "VOX",
        tab: "Radio",
        get: () => settings.vox.get(),
        set: (val) => settings.vox.set(Number(val)),
      },
      {
        type: "select",
        id: "vox_level",
        name: "VOX level",
        tab: "Radio",
        options: Array(5)
          .fill(0)
          .map((_, i) => ({ value: i, name: String(i + 1) })),
        get: () => settings.vox_level.get(),
        set: (val) => settings.vox_level.set(Number(val)),
      },
    ];

    return ui;
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

    if (ack2[0] !== CMD_ACK[0]) {
      throw new Error("Radio refused to enter programming mode");
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
    this.dispatch_ui();

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

    const mem = this._parse(data);
    this._mem = mem;
    this.dispatch_ui();

    onProgress(1);
  }

  ui() {
    return this._ui();
  }

  async load(snapshot: Buffer) {
    this._img = snapshot;
    this._mem = this._parse(this._img);
    this.dispatch_ui();
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
  static Info: RadioInfo = {
    vendor: "Retevis",
    model: "RB18",
  };

  protected _magic = Buffer.from("PROGRAL", "ascii");
  protected _fingerprint = [Buffer.from("P3107\xF7", "ascii")];
  protected _memSize = 0x0660;
  protected _blockSize = 0x10;
  protected _channels = 22;
  protected CMD_EXIT = Buffer.from("E", "ascii");
}

export class RB618Radio extends RB18Radio {
  static Info: RadioInfo = {
    vendor: "Retevis",
    model: "RB618",
  };

  protected _channels = 16;
}

export class BFC50Radio extends RB618Radio {
  // TODO: https://github.com/emuehlstein/baofeng_bfc50/blob/main/chirpdriver/radtel_t18.py#L1189
  static Info: RadioInfo = {
    vendor: "Baofeng",
    model: "BF-C50",
  };
}

export class BFC50DemoRadio extends BFC50Radio {
  static Info: RadioInfo = {
    vendor: "Baofeng",
    model: "BF-C50 (Demo)",
  };

  constructor() {
    super();

    this.load(
      Buffer.from(
        "002542450025424593069306e3ffffff00254345002543450010001009ffffff00254445002544451415141509ffffff00254545002545453520352009ffffff00254645002546451824182409ffffff00254745002547452380238009ffffff00254845002548451481148109ffffff00254945002549450582058209ffffff00255145002551450683068309ffffff00255245002552451184118409ffffff00255345002553450385038509ffffff00255445002554450686068609ffffff00255545002555455487548709ffffff0025214000252140ffffffff09ffffff0050554300505543ffffffff09ffffff0050894600508946ffffffff09ffffff00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000010101ffffffffffffffff0302000601ffffffffffffffffffffff0000f73331303350ffffffffffffffff",
        "hex"
      )
    );
  }
}
