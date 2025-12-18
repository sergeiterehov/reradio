import { Buffer } from "buffer";
import { Radio, type RadioInfo } from "./_radio";
import { array_of, create_mem_mapper } from "@/utils/mem";
import type { UI } from "@/utils/ui";
import { common_ui } from "@/utils/common_ui";
import { t } from "i18next";
import { serial } from "@/utils/serial";

const CMD_ACK = Buffer.from([0x06]);

export abstract class BaseT18ProtocolRadio extends Radio {
  protected _echo = false;
  protected _fingerprint = [Buffer.from("SMP558\x00\x00", "ascii")];
  protected _magic = Buffer.from("1ROGRAM", "ascii");
  protected _memSize = 0x03f0;
  protected _ackBlock = true;
  protected _blockSize = 0x08;
  protected CMD_EXIT = Buffer.from("b", "ascii");

  protected _img?: Buffer;
  protected abstract _mem?: unknown;

  constructor() {
    super();
  }

  protected abstract _parse(data: Buffer): void;

  protected async _enterProgrammingMode() {
    const _magic = Buffer.concat([Buffer.from([0x02]), this._magic]);

    await serial.write(_magic);
    if (this._echo) await serial.read(_magic.length);

    const ack1 = await serial.read(1);
    if (ack1[0] !== CMD_ACK[0]) {
      throw new Error("Radio refused to enter programming mode");
    }

    await serial.write(Buffer.from([0x02]));

    if (this._echo) await serial.read(1);

    const ident = await serial.read(8);

    const matchesFingerprint = this._fingerprint.some((fp) => ident.slice(0, fp.length).equals(fp));

    if (!matchesFingerprint) {
      throw new Error("Radio identification failed.");
    }

    await serial.write(CMD_ACK);
    if (this._echo) await serial.read(CMD_ACK.length);

    const ack2 = await serial.read(1);

    if (ack2[0] !== CMD_ACK[0]) {
      throw new Error("Radio refused to enter programming mode");
    }
  }

  protected async _exitProgrammingMode() {
    await serial.write(this.CMD_EXIT);
    if (this._echo) await serial.read(this.CMD_EXIT.length);
  }

  protected async _readBlock(addr: number, size: number) {
    const cmd = new Buffer(4);
    cmd.write("R", 0);
    cmd.writeInt16BE(addr, 1);
    cmd.writeUInt8(size, 3);

    await serial.write(cmd);
    if (this._echo) await serial.read(cmd.length);

    const res = await serial.read(4 + size);
    const expected = Buffer.concat([Buffer.from("W"), cmd.slice(1)]);
    if (Buffer.compare(expected, res.slice(0, expected.length)) !== 0) {
      throw new Error(`Error riding block 0x${addr.toString(16)}`);
    }

    const data = res.slice(4);

    if (this._ackBlock) {
      await serial.write(CMD_ACK);
      if (this._echo) await serial.read(CMD_ACK.length);

      const ack = await serial.read(1);
      if (!ack.equals(CMD_ACK)) throw new Error(`No ACK reading block 0x${addr.toString(16)}`);
    }

    return data;
  }

  protected async _writeBlock(data: Buffer, addr: number) {
    const cmd = new Buffer(4);
    cmd.write("W", 0);
    cmd.writeInt16BE(addr, 1);
    cmd.writeUInt8(data.length, 3);

    await serial.write(Buffer.concat([cmd, data]));
    if (this._echo) await serial.read(cmd.length + data.length);

    const sck = await serial.read(1);
    if (!sck.equals(CMD_ACK)) throw new Error("No ACK");
  }

  async load(snapshot: Buffer) {
    this._img = snapshot;
    this._mem = this._parse(this._img);
    this.dispatch_ui_change();
  }

  override async upload() {
    if (!this._img) throw new Error("No data");
    return { version: 0, snapshot: Buffer.from(this._img) };
  }

  async read() {
    this.dispatch_progress(0);

    await serial.begin({ baudRate: 9600 });
    await serial.clear();

    this._img = undefined;
    this._mem = undefined;
    this.dispatch_ui_change();

    const { _memSize, _blockSize } = this;

    await this._enterProgrammingMode();

    this.dispatch_progress(0.1);

    const blocks: Buffer[] = [];

    for (let addr = 0; addr < _memSize; addr += _blockSize) {
      const block = await this._readBlock(addr, _blockSize);
      blocks.push(block);

      // console.log(addr, block.toHex());
      this.dispatch_progress(0.1 + 0.8 * ((addr + _blockSize) / _memSize));
    }

    await this._exitProgrammingMode();

    const data = Buffer.concat(blocks);
    await this.load(data);

    this.dispatch_progress(1);
  }

  async write() {
    if (!this._img) throw new Error("No data");
    const img = Buffer.from(this._img);

    this.dispatch_progress(0);

    await serial.begin({ baudRate: 9600 });
    await serial.clear();

    const { _memSize, _blockSize } = this;

    await this._enterProgrammingMode();

    this.dispatch_progress(0.1);

    for (let addr = 0; addr < _memSize; addr += _blockSize) {
      const block = img.slice(addr, addr + _blockSize);

      await this._writeBlock(block, addr);

      this.dispatch_progress(0.1 + 0.8 * ((addr + _blockSize) / _memSize));
    }

    await this._exitProgrammingMode();

    this.dispatch_progress(1);
  }
}

export class T18Radio extends BaseT18ProtocolRadio {
  static Info: RadioInfo = {
    id: "t18",
    vendor: "Radtel",
    model: "T18",
  };

  protected _channels = 16;
  protected _mem?: ReturnType<typeof this._parse>;

  protected _parse(data: Buffer) {
    const m = create_mem_mapper(data, this.dispatch_ui);

    return {
      _m: m,

      ...m.seek(0x0000).skip(0, {}),
      memory: array_of(this._channels, () => ({
        rxfreq: m.lbcd(4),
        txfreq: m.lbcd(4),
        rxtone: m.lbcd(2),
        txtone: m.lbcd(2),
        ...m.bitmap({
          jumpcode: 1,
          _1: 2,
          skip: 1,
          highpower: 1,
          narrow: 1,
          _2: 1,
          bcl: 1,
        }),
        ...m.skip(3, {}),
      })),

      ...m.seek(0x0630).skip(0, {}),
      ...m.bitmap({ _: 7, voice: 1 }),
      ...m.bitmap({ _: 7, language: 1 }),
      ...m.bitmap({ _: 7, scan: 1 }),
      ...m.bitmap({ _: 7, vox: 1 }),
      ...m.bitmap({ _: 5, vox_level: 3 }),
      ...m.skip(1, {}),
      ...m.bitmap({ _: 7, lovoltnotx: 1 }),
      ...m.bitmap({ _: 7, hivoltnotx: 1 }),

      ...m.seek(0x0640).skip(0, {}),
      ...m.bitmap({ _: 5, rogerbeep: 1, batterysaver: 1, beep: 1 }),
      squelchlevel: m.u8(),
      ...m.skip(1, {}),
      timeouttimer: m.u8(),
      ...m.bitmap({ _: 7, tail: 1 }),
      channel: m.u8(),
    };
  }

  ui(): UI.Root {
    const mem = this._mem;

    if (!mem) return { fields: [] };

    const { memory } = mem;

    return {
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
            get: (i) => memory[i].narrow.get(),
            set: (i, val) => memory[i].narrow.set(val),
          },
          squelch_rx: common_ui.channel_squelch_lbcd((i) => memory[i].rxtone),
          squelch_tx: common_ui.channel_squelch_lbcd((i) => memory[i].txtone),
          power: {
            options: [1, 5],
            name: (val) => [t("power_low"), t("power_high")][val] || t("unspecified"),
            get: (i) => memory[i].highpower.get(),
            set: (i, val) => memory[i].highpower.set(val),
          },
          scan: {
            options: ["On", "Off"],
            get: (i) => memory[i].skip.get(),
            set: (i, val) => memory[i].skip.set(val),
          },
        },
        common_ui.beep(mem.beep),
        common_ui.voice_prompt(mem.voice),
        common_ui.voice_language(mem.language, { languages: [t("lang_en"), t("lang_ch")] }),
        common_ui.vox(mem.vox),
        common_ui.vox_level(mem.vox_level, { min: 0, max: 9 }),
        common_ui.roger_beep(mem.rogerbeep),
        common_ui.sql(mem.squelchlevel, { min: 0, max: 9 }),
      ],
    };
  }
}

export class RB18Radio extends T18Radio {
  static Info: RadioInfo = {
    id: "rb18",
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
    id: "rb618",
    vendor: "Retevis",
    model: "RB618",
  };

  protected _channels = 16;
}
