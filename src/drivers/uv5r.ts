import { Buffer } from "buffer";
import { Radio, type RadioInfo } from "./radio";
import type { UI } from "./ui";
import { array_of, create_mem_mapper } from "./mem";
import { common_ui, modify_field, UITab } from "./common_ui";
import { DCS_CODES } from "./utils";

const INDENT_291 = Buffer.from([0x50, 0xbb, 0xff, 0x20, 0x12, 0x07, 0x25]);
const INDENT_5R = Buffer.from([0x50, 0xbb, 0xff, 0x01, 0x25, 0x98, 0x4d]);
const INDENT_UV82 = Buffer.from([0x50, 0xbb, 0xff, 0x20, 0x13, 0x01, 0x05]);
const UV5R_DCS = [...DCS_CODES, 645].sort((a, b) => a - b);
const PTT_ID_ON_OPTIONS: UI.ChannelPTTIdOn[] = ["Off", "Begin", "End", "Begin & End"];

const ACK = Buffer.from([0x06]);

export class UV5RRadio extends Radio {
  static Info: RadioInfo = {
    vendor: "Baofeng",
    model: "UV-5R",
  };

  protected readonly INDENTS = [INDENT_291, INDENT_5R];
  protected readonly MEM_SIZE = 0x1800;
  protected readonly BLOCK_SIZE = 0x40;
  protected readonly POWER_LEVELS = [
    { watt: 5, name: "Hight" },
    { watt: 1, name: "Low" },
  ];

  protected readonly HAS_RTONE: boolean = false;
  protected readonly HAS_DUAL_PTT: boolean = false;

  protected _img?: Buffer;
  protected _mem?: ReturnType<typeof this._parse>;

  protected _parse(img: Buffer) {
    const m = create_mem_mapper(img, this.dispatch_ui);

    return {
      ...m.seek(0x0000).skip(0, {}),
      memory: array_of(128, () =>
        m.struct(() => ({
          rxfreq: m.lbcd(4),
          txfreq: m.lbcd(4),
          rxtone: m.u16(),
          txtone: m.u16(),
          ...m.bitmap({
            unused1: 3,
            isuhf: 1,
            scode: 4,
          }),
          ...m.bitmap({
            unknown1: 7,
            txtoneicon: 1,
          }),
          ...m.bitmap({ mailicon: 3, unknown2: 3, lowpower: 2 }),
          ...m.bitmap({
            unknown3: 1,
            wide: 1,
            unknown4: 2,
            bcl: 1,
            scan: 1,
            pttid: 2,
          }),
        }))
      ),

      ...m.seek(0x0b00).skip(0, {}),
      pttid: array_of(15, () => ({
        code: m.u8_array(5),
        unused: m.u8_array(11),
      })),

      ...m.seek(0x0e20).skip(0, {}),
      settings: {
        squelch: m.u8(),
        step: m.u8(),
        unknown1: m.u8(),
        save: m.u8(),
        vox: m.u8(),
        unknown2: m.u8(),
        abr: m.u8(),
        tdr: m.u8(),
        beep: m.u8(),
        timeout: m.u8(),
        unknown3: m.u8_array(4),
        voice: m.u8(),
        unknown4: m.u8(),
        dtmfst: m.u8(),
        unknown5: m.u8(),
        ...m.bitmap({
          unknown12: 6,
          screv: 2,
        }),
        pttid: m.u8(),
        pttlt: m.u8(),
        mdfa: m.u8(),
        mdfb: m.u8(),
        bcl: m.u8(),
        autolk: m.u8(),
        sftd: m.u8(),
        unknown6: m.u8_array(3),
        wtled: m.u8(),
        rxled: m.u8(),
        txled: m.u8(),
        almod: m.u8(),
        band: m.u8(),
        tdrab: m.u8(),
        ste: m.u8(),
        rpste: m.u8(),
        rptrl: m.u8(),
        ponmsg: m.u8(),
        roger: m.u8(),
        rogerrx: m.u8(),
        rtone: m.u8(),
        ...m.bitmap({ displayab: 1, unknown7: 2, fmradio: 1, alarm: 1, unknown8: 1, reset: 1, menu: 1 }),
        ...m.bitmap({ unknown9: 6, singleptt: 1, vfomrlock: 1 }),
        workmode: m.u8(),
        keylock: m.u8(),
      },

      ...m.seek(0x1000).skip(0, {}),
      names: array_of(128, () => ({
        name: m.str(7),
        unknown2: m.u8_array(9),
      })),
    };
  }

  override ui(): UI.Root {
    const mem = this._mem;

    if (!mem) return { fields: [] };

    const { memory, names, pttid, settings } = mem;

    const dtmf_chars = "0123456789ABCD*#";
    const ptt_id_code_options: string[] = pttid.map((id) =>
      id.code
        .get()
        .map((c) => dtmf_chars[c])
        .join("")
    );

    return {
      fields: [
        {
          ...common_ui.channels({ size: memory.length }),
          channel: { get: (i) => names[i].name.get().replaceAll("\xFF", "").trimEnd() || `CH-${i}` },
          empty: {
            get: (i) => memory[i].rxfreq.raw.get()[0] === 0xff,
            delete: (i) => {
              const raw = memory[i].__raw;
              raw.set(Array(raw.size).fill(0xff));
            },
            init: (i) => {
              const ch = memory[i];
              ch.__raw.set([...Array(12).fill(0xff), 0x00, 0x00, 0x00, 0x00]);
              ch.rxfreq.set(130_000_00);
              ch.txfreq.set(130_000_00);
            },
          },
          freq: {
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
            get: (i) => (memory[i].wide.get() ? "FM" : "NFM"),
            set: (i, val) => memory[i].wide.set(val === "FM" ? 1 : 0),
          },
          squelch_rx: common_ui.channel_squelch_u16((i) => memory[i].rxtone, UV5R_DCS),
          squelch_tx: common_ui.channel_squelch_u16((i) => memory[i].txtone, UV5R_DCS),
          scan: {
            options: ["Off", "On"],
            get: (i) => (memory[i].scan.get() ? "On" : "Off"),
            set: (i, val) => memory[i].scan.set(val === "On" ? 1 : 0),
          },
          power: {
            options: this.POWER_LEVELS.map((lv) => lv.watt),
            name: (val) => this.POWER_LEVELS[val]?.name || "unspecified",
            get: (i) => memory[i].lowpower.get(),
            set: (i, val) => memory[i].lowpower.set(val),
          },
          bcl: {
            get: (i) => memory[i].bcl.get() === 1,
            set: (i, val) => memory[i].bcl.set(val ? 1 : 0),
          },
          ptt_id: {
            on_options: PTT_ID_ON_OPTIONS,
            id_options: ptt_id_code_options,
            get: (i) => ({
              on: PTT_ID_ON_OPTIONS[memory[i].pttid.get()],
              id: ptt_id_code_options[memory[i].scode.get()],
            }),
            set: (i, val) => {
              memory[i].pttid.set(PTT_ID_ON_OPTIONS.indexOf(val.on));
              memory[i].scode.set(ptt_id_code_options.indexOf(val.id));
            },
          },
        },

        modify_field(common_ui.dw(settings.tdr), (f) => ({
          ...f,
          set: (...args) => {
            f.set(...args);
            this.dispatch_ui_change();
          },
        })),
        settings.tdr.get() ? common_ui.dw_priority_ab(settings.tdrab) : common_ui.none(),
        common_ui.fm(settings.fmradio),
        common_ui.sql(settings.squelch, { min: 0, max: 9 }),
        common_ui.sql_ste(settings.ste, { from: 100, to: 1000, step: 100 }),
        common_ui.keypad_lock(settings.keylock),
        modify_field(
          common_ui.alarm_mode(settings.almod, {
            options: ["Site - only speaker", "Tone - transmit", "Code - transmit"],
          }),
          (f) => ({
            ...f,
            get: () => {
              const val = f.get() as number;
              return val > 0x02 ? 0x01 : val;
            },
          })
        ),
        common_ui.scan_mode(settings.screv, { options: ["Time", "Carrier", "Search"] }),
        common_ui.pow_battery_save_ratio(settings.save),
        common_ui.beep(settings.beep),
        common_ui.bcl(settings.bcl),
        common_ui.roger_beep_select(settings.roger, { options: ["Off", "Beep", "TO-1200"] }),
        this.HAS_RTONE ? common_ui.rtone(settings.rtone, { frequencies: [1000, 1450, 1750, 2100] }) : common_ui.none(),
        this.HAS_DUAL_PTT
          ? {
              type: "switcher",
              id: "single_ptt",
              name: "Single PTT",
              tab: UITab.Control,
              get: () => settings.singleptt.get(),
              set: (val) => settings.singleptt.set(val ? 1 : 0),
            }
          : common_ui.none(),
        common_ui.pow_tot(settings.timeout, { from: 15, to: 600, step: 15 }),
        common_ui.voice_language(settings.voice, { languages: ["Off", "English", "Chinese"] }),
        common_ui.backlight_timeout(settings.abr, { min: 0, max: 24 }),
        common_ui.vox_sens(settings.vox, { max: 10 }),

        ...pttid.map(
          (id, i): UI.Field.Any => ({
            type: "chars",
            id: `ptt_id_${i}`,
            name: `PTT ID ${i + 1}`,
            tab: UITab.DTMF,
            abc: dtmf_chars,
            pad: "0",
            uppercase: true,
            length: id.code.size,
            get: () => id.code.get(),
            set: (val) => {
              id.code.set(val as number[]);
              // update ptt_id_code_options
              this.dispatch_ui_change();
            },
          })
        ),
      ],
    };
  }

  protected async _read_ident() {
    for (const indent of this.INDENTS) {
      console.log("Try ident:", indent.toString("hex"));

      for (let i = 0; i < indent.length; i += 1) {
        await this._serial_write(indent.slice(i, i + 1));
        await new Promise((r) => setTimeout(r, 10));
      }

      const ack = await this._serial_read(1);
      if (!ack.equals(ACK)) throw new Error("Identification rejected");

      await this._serial_write(Buffer.from([0x02]));

      const response = await this._serial_read(8);

      console.log("Response:", response.toString("hex"));

      await this._serial_write(ACK);
      const ack2 = await this._serial_read(1);
      if (!ack2.equals(ACK)) throw new Error("Identification ACK rejected");

      return response;
    }

    throw new Error("Radio is undefined");
  }

  protected async _read_block(addr: number, size: number, first = false) {
    const cmd = Buffer.alloc(4);
    cmd.write("S", 0);
    cmd.writeUInt16BE(addr, 1);
    cmd.writeUInt8(size, 3);

    await this._serial_write(cmd);

    if (!first) {
      const ack = await this._serial_read(1);
      if (!ack.equals(ACK)) throw new Error("Refused NOT first block reading");
    }

    const expect_answer = Buffer.from(cmd);
    expect_answer.write("X", 0);

    const answer = await this._serial_read(4);
    if (!answer.equals(expect_answer)) throw new Error("Invalid answer when reading");

    const data = await this._serial_read(size);

    await this._serial_write(Buffer.from([0x06]));
    await new Promise((r) => setTimeout(r, 50));

    return data;
  }

  protected async _write_block(addr: number, data: Buffer) {
    const cmd = Buffer.alloc(4);
    cmd.write("X", 0);
    cmd.writeUInt16BE(addr, 1);
    cmd.writeUInt8(data.length, 3);

    await this._serial_write(Buffer.concat([cmd, data]));

    await new Promise((r) => setTimeout(r, 50));

    const ack = await this._serial_read(1);
    if (!ack.equals(ACK)) throw new Error(`Refused to access block 0x${addr.toString(16)}`);
  }

  override async load(snapshot: Buffer) {
    const mem = this._parse(snapshot);

    this._img = snapshot;
    this._mem = mem;
    this.dispatch_ui_change();
  }

  override async read(onProgress: (k: number) => void) {
    onProgress(0);

    this._img = undefined;
    this._mem = undefined;
    this.dispatch_ui_change();

    await this._serial_clear();

    const ident = await this._read_ident();

    const block0 = await this._read_block(0x1e80, this.BLOCK_SIZE, true);
    const block1 = await this._read_block(0x1ec0, this.BLOCK_SIZE);
    const block2 = await this._read_block(0x1fc0, this.BLOCK_SIZE);

    const version = block1.slice(48, 62);
    console.log("Firmware:", version.toString("ascii"));

    const chunks: Buffer[] = [];

    onProgress(0.1);

    for (let i = 0; i < this.MEM_SIZE; i += this.BLOCK_SIZE) {
      const chunk = await this._read_block(i, this.BLOCK_SIZE);
      chunks.push(chunk);

      onProgress(0.1 + 0.8 * (i / this.MEM_SIZE));
    }

    const img = Buffer.concat(chunks);
    this.load(img);

    onProgress(1);
  }

  override async write(onProgress: (k: number) => void) {
    onProgress(0);

    const img = this._img;
    if (!img) throw new Error("No data");

    await this._serial_clear();

    const ident = await this._read_ident();

    const block_size = 0x10;

    for (let i = 0; i < this.MEM_SIZE; i += block_size) {
      if (i >= 0x0cf0 && i <= 0x0d00) continue;
      if (i >= 0x0df0 && i <= 0x0e00) continue;

      await this._write_block(i, img.slice(i, i + block_size));

      onProgress(i / this.MEM_SIZE);
    }

    onProgress(1);
  }
}

export class UV82Radio extends UV5RRadio {
  static override Info: RadioInfo = {
    vendor: "Baofeng",
    model: "UV-82 (5 watt)",
  };

  protected readonly INDENTS: Buffer[] = [INDENT_UV82];
  protected readonly HAS_RTONE = true;
}

export class UV82HPRadio extends UV82Radio {
  static override Info: RadioInfo = {
    vendor: "Baofeng",
    model: "UV-82HP (8 watt)",
  };

  protected readonly POWER_LEVELS = [
    { watt: 8, name: "Hight" },
    { watt: 5, name: "Medium" },
    { watt: 1, name: "Low" },
  ];
}
