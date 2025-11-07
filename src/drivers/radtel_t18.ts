import { Buffer } from "buffer";
import { Radio, type RadioInfo } from "./radio";
import { create_mem_mapper, dup, type M } from "./mem";
import type { UI } from "./ui";
import { common_ui } from "./common_ui";

const CMD_ACK = Buffer.from([0x06]);

namespace T18Radio {
  export namespace Mem {
    export type Channel = {
      rxfreq: M.LBCD;
      txfreq: M.LBCD;
      rxtone: M.LBCD;
      txtone: M.LBCD;
      jumpcode: M.Bits;
      skip: M.Bits;
      highpower: M.Bits;
      narrow: M.Bits;
      bcl: M.Bits;
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
    memory: Mem.Channel[];
    settings: Mem.Settings;
  };
}

export class T18Radio extends Radio {
  static Info: RadioInfo = {
    vendor: "Radtel",
    model: "T18",
  };

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
        ...r.bits("jumpcode", null, null, "skip", "highpower", "narrow", null, "bcl"),
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
      memory: channels,
      settings,
    };

    return mem;
  }

  protected _ui(): UI.Root {
    if (!this._mem) return { fields: [] };

    const { settings, memory } = this._mem;

    const ui: UI.Root = {
      fields: [
        {
          ...common_ui.channels({ size: memory.length }),
          freq: {
            min: 400_000_000,
            max: 470_000_000,
            get: (i) => memory[i].rxfreq.get() * 10,
            set: (i, val) => {
              memory[i].rxfreq.set(val / 10);
              memory[i].txfreq.set(val / 10);
            },
          },
          offset: {
            get: (i) => (memory[i].txfreq.get() - memory[i].rxfreq.get()) * 10,
            set: (i, val) => memory[i].txfreq.set(memory[i].rxfreq.get() + val / 10),
          },
          mode: {
            options: ["FM", "NFM"],
            get: (i) => (memory[i].narrow.get() ? "NFM" : "FM"),
            set: (i, val) => memory[i].narrow.set(val === "NFM" ? 1 : 0),
          },
          squelch_rx: common_ui.channel_squelch_lbcd((i) => memory[i].rxtone),
          squelch_tx: common_ui.channel_squelch_lbcd((i) => memory[i].txtone),
          power: {
            options: [1, 5],
            name: (val) => (val < 5 ? "Low" : "Height"),
            get: (i) => (memory[i].highpower.get() ? 5 : 1),
            set: (i, val) => memory[i].highpower.set(val === 5 ? 1 : 0),
          },
          scan: {
            options: ["Off", "On"],
            get: (i) => (memory[i].skip.get() ? "Off" : "On"),
            set: (i, val) => memory[i].skip.set(val === "Off" ? 1 : 0),
          },
        },
        common_ui.beep(settings.beep),
        common_ui.voice_prompt(settings.voice),
        common_ui.voice_language(settings.language, { languages: ["English", "Chinese"] }),
        common_ui.vox(settings.vox),
        common_ui.vox_level(settings.vox_level, { min: 0, max: 9 }),
        common_ui.roger_beep(settings.rogerbeep),
        common_ui.sql(settings.squelchlevel, { min: 0, max: 9 }),
      ],
    };

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
    await this._serial_write(this.CMD_EXIT);
    if (this._echo) await this._serial_read(this.CMD_EXIT.length);
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

    await this._serial_clear();

    this._img = undefined;
    this._mem = undefined;
    this.dispatch_ui_change();

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
    await this.load(data);

    onProgress(1);
  }

  ui() {
    return this._ui();
  }

  async load(snapshot: Buffer) {
    this._img = snapshot;
    this._mem = this._parse(this._img);
    this.dispatch_ui_change();
  }

  async write(onProgress: (k: number) => void) {
    onProgress(0);

    await this._serial_clear();

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
