import { Buffer } from "buffer";
import { Radio, type RadioInfo } from "./radio";
import { array_of, create_mem_mapper, dup } from "./mem";
import type { UI } from "./ui";
import { common_ui } from "./common_ui";

const CMD_ACK = Buffer.from([0x06]);
const PROGRAM_CMD = Buffer.from("PROGRAM", "ascii");
const IDENT = [Buffer.from("P3107", "ascii")];
const BLOCK_SIZE = 0x08;
const MEM_SIZE = 0x03e0;

export class BF888Radio extends Radio {
  static override Info: RadioInfo = {
    vendor: "Baofeng",
    model: "BF-888",
  };

  override baudRate = 9600;

  protected _parse(data: Buffer) {
    const m = create_mem_mapper(data, this.dispatch_ui);

    return {
      ...m.seek(0x0010).skip(0, {}),
      memory: array_of(16, () => ({
        rxfreq: m.lbcd(4),
        txfreq: m.lbcd(4),
        rxtone: m.lbcd(2),
        txtone: m.lbcd(2),
        ...m.bits("unknown3", "unknown2", "unknown1", "skip", "highpower", "narrow", "beatshift", "bcl"),
        unknown4: m.u8_array(3),
      })),
      ...m.seek(0x02b0).skip(0, {}),
      settings: {
        voiceprompt: m.u8(),
        voicelanguage: m.u8(),
        scan: m.u8(),
        vox: m.u8(),
        voxlevel: m.u8(),
        voxinhibitonrx: m.u8(),
        lowvolinhibittx: m.u8(),
        highvolinhibittx: m.u8(),
        alarm: m.u8(),
        fmradio: m.u8(),
      },
      ...m.seek(0x03c0).skip(0, {}),
      settings2: {
        ...m.bits(...dup(6, "unused"), "batterysaver", "beep"),
        squelchlevel: m.u8(),
        sidekeyfunction: m.u8(),
        timeouttimer: m.u8(),
        unused2: m.u8_array(3),
        ...m.bits(...dup(7, "unused3"), "scanmode"),
      },
    };
  }

  override ui(): UI.Root {
    if (!this._mem) return { fields: [] };

    const { memory, settings, settings2 } = this._mem;

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
            get: (i) => (memory[i].narrow.get() ? "NFM" : "FM"),
            set: (i, val) => memory[i].narrow.set(val === "NFM" ? 1 : 0),
          },
          squelch_rx: common_ui.channel_squelch((i) => memory[i].rxtone),
          squelch_tx: common_ui.channel_squelch((i) => memory[i].txtone),
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

        common_ui.alarm(settings.alarm),
        common_ui.beep(settings2.beep),
        common_ui.voice_prompt(settings.voiceprompt),
        common_ui.voice_language(settings.voicelanguage, { languages: ["English", "Chinese"] }),
        common_ui.scan(settings.scan),
        common_ui.scan_mode(settings2.scanmode),
        common_ui.vox(settings.vox),
        common_ui.vox_inhibit(settings.voxinhibitonrx),
        common_ui.vox_level(settings.voxlevel, { min: 0, max: 4 }),
        common_ui.pow_battery_save(settings2.batterysaver),
        common_ui.pow_low_no_tx(settings.lowvolinhibittx),
        common_ui.pow_high_no_tx(settings.highvolinhibittx),
        common_ui.pow_tot(settings2.timeouttimer),
        common_ui.fm(settings.fmradio),
        common_ui.sql(settings2.squelchlevel, { min: 0, max: 9 }),
        common_ui.key_side_fn(settings2.sidekeyfunction, { functions: ["Off", "Monitor", "Transmit Power", "Alarm"] }),
      ],
    };
  }

  protected _img?: Buffer;
  protected _mem?: ReturnType<typeof this._parse>;

  override async load(snapshot: Buffer) {
    this._img = snapshot;
    this._mem = this._parse(this._img);
    this.dispatch_ui();
  }

  protected async _enter_programming_mode() {
    await this._serial_write(Buffer.from([0x02]));
    // await new Promise((r) => setTimeout(r, 100));
    await this._serial_write(PROGRAM_CMD);

    const ack = await this._serial_read(1);
    if (!ack.equals(CMD_ACK)) throw new Error("Radio refused to enter programming mode");

    // Эта команда должна быть отправлена с минимальной задержкой! Можно отправить с командой prog
    await this._serial_write(Buffer.from([0x02]));

    const ident = await this._serial_read(8);
    await this._serial_write(CMD_ACK);

    const ack2 = await this._serial_read(1);
    if (!ack2.equals(CMD_ACK)) throw new Error("Bad ACK after reading ident");

    if (!IDENT.some((id) => ident.slice(0, id.length).equals(id))) throw new Error("Incorrect model");
  }

  protected async _exit_programming_mode() {
    await this._serial_write(Buffer.from("E", "ascii"));
    await this._serial_read(1);
  }

  protected async _read_block(addr: number, size: number) {
    const cmd = new Buffer(4);
    cmd.write("R", 0);
    cmd.writeInt16BE(addr, 1);
    cmd.writeUInt8(size, 3);
    await this._serial_write(cmd);

    const res = await this._serial_read(4 + size);

    const res_expected = Buffer.concat([Buffer.from("W"), cmd.slice(1)]);
    if (Buffer.compare(res_expected, res.slice(0, res_expected.length)) !== 0) {
      throw new Error(`Error riding block 0x${addr.toString(16)}`);
    }

    const data = res.slice(4);

    await this._serial_write(CMD_ACK);

    const ack = await this._serial_read(1);
    if (!ack.equals(CMD_ACK)) throw new Error(`No ACK reading block 0x${addr.toString(16)}`);

    return data;
  }

  protected async _write_block(addr: number, data: Buffer) {
    const cmd = new Buffer(4);
    cmd.write("W", 0);
    cmd.writeInt16BE(addr, 1);
    cmd.writeUInt8(data.length, 3);

    await this._serial_write(Buffer.concat([cmd, data]));

    const sck = await this._serial_read(1);
    if (!sck.equals(CMD_ACK)) throw new Error("No ACK");
  }

  override async read(onProgress: (k: number) => void) {
    onProgress(0);

    await this._serial_read(128, { timeout: 100 }).catch(() => null);

    this._img = undefined;
    this._mem = undefined;
    this.dispatch_ui();

    await this._enter_programming_mode();
    onProgress(0.1);

    const blocks: Buffer[] = [];

    for (let addr = 0; addr < MEM_SIZE; addr += BLOCK_SIZE) {
      const block = await this._read_block(addr, BLOCK_SIZE);
      blocks.push(block);

      onProgress(0.1 + 0.8 * (addr / MEM_SIZE));
    }

    await this._exit_programming_mode();
    onProgress(0.95);

    const img = Buffer.concat(blocks);
    this.load(img);

    onProgress(1);
  }

  override async write(onProgress: (k: number) => void) {
    if (!this._img) throw new Error("No data");

    onProgress(0);

    await this._serial_read(128, { timeout: 100 }).catch(() => null);

    await this._enter_programming_mode();
    onProgress(0.1);

    for (let addr = 0; addr < MEM_SIZE; addr += BLOCK_SIZE) {
      await this._write_block(addr, this._img.slice(addr, addr + BLOCK_SIZE));
      onProgress(0.1 + 0.8 * (addr / MEM_SIZE));
    }

    await this._exit_programming_mode();

    onProgress(1);
  }
}
