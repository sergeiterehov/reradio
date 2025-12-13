import { Buffer } from "buffer";
import { Radio, type RadioInfo } from "./radio";
import type { UI } from "@/utils/ui";
import { array_of, create_mem_mapper } from "@/utils/mem";
import { common_ui, modify_field, UITab } from "@/utils/common_ui";
import { DCS_CODES } from "@/utils/radio";
import { t } from "i18next";
import { serial } from "@/utils/serial";

const INDENT_291 = Buffer.from([0x50, 0xbb, 0xff, 0x20, 0x12, 0x07, 0x25]);
const INDENT_A58 = Buffer.from([0x50, 0xbb, 0xff, 0x20, 0x14, 0x04, 0x13]);
const INDENT_5R = Buffer.from([0x50, 0xbb, 0xff, 0x01, 0x25, 0x98, 0x4d]);
const INDENT_UV82 = Buffer.from([0x50, 0xbb, 0xff, 0x20, 0x13, 0x01, 0x05]);
const UV5R_DCS = [...DCS_CODES, 645].sort((a, b) => a - b);
const PTT_ID_ON_OPTIONS: UI.PttIdOn[] = ["Off", "Begin", "End", "BeginAndEnd"];

const ACK = Buffer.from([0x06]);

export class UV5RRadio extends Radio {
  static Info: RadioInfo = {
    vendor: "Baofeng",
    model: "UV-5R",
  };

  protected readonly INDENTS = [INDENT_291, INDENT_5R];
  protected readonly MEM_SIZE = 0x2000;
  protected readonly WRITE_BLOCK_SIZE = 0x10;
  /** [start, end, block_size] */
  protected readonly MEM_RANGES: [number, number, number][] = [
    [0x0000, 0x1800, 0x40],
    [0x1ec0, 0x1ef0, 0x40],
  ];
  protected readonly POWER_LEVELS = [
    { watt: 5, name: t("power_high") },
    { watt: 1, name: t("power_low") },
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

      ...m.seek(0x1ee0).skip(0, {}),
      poweron_msg: {
        line1: m.str(7),
        line2: m.str(7),
      },
    };
  }

  override ui(): UI.Root {
    const mem = this._mem;

    if (!mem) return { fields: [] };

    const { memory, names, pttid, settings, poweron_msg } = mem;

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
          swap: (a, b) => {
            const t = memory[a].__raw.get();
            memory[a].__raw.set(memory[b].__raw.get());
            memory[b].__raw.set(t);
          },
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
            options: ["NFM", "FM"],
            get: (i) => memory[i].wide.get(),
            set: (i, val) => memory[i].wide.set(val),
          },
          squelch_rx: common_ui.channel_squelch_u16((i) => memory[i].rxtone, UV5R_DCS),
          squelch_tx: common_ui.channel_squelch_u16((i) => memory[i].txtone, UV5R_DCS),
          scan: {
            options: ["Off", "On"],
            get: (i) => memory[i].scan.get(),
            set: (i, val) => memory[i].scan.set(val),
          },
          power: {
            options: this.POWER_LEVELS.map((lv) => lv.watt),
            name: (val) => this.POWER_LEVELS[val]?.name || t("unspecified"),
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
              on: memory[i].pttid.get(),
              id: memory[i].scode.get(),
            }),
            set: (i, val) => {
              memory[i].pttid.set(val.on);
              memory[i].scode.set(val.id);
            },
          },
        },

        modify_field(
          common_ui.dual_watch(settings.tdr),
          (f): UI.Field.Switcher => ({
            ...f,
            set: (...args) => {
              f.set(...args);
              this.dispatch_ui_change();
            },
          })
        ),
        settings.tdr.get() ? common_ui.dual_watch_priority_ab(settings.tdrab) : common_ui.none(),
        common_ui.fm(settings.fmradio),
        common_ui.sql(settings.squelch, { min: 0, max: 9 }),
        common_ui.sql_ste(settings.ste, { from: 100, to: 1000, step: 100 }),
        common_ui.keypad_lock_auto(settings.keylock),
        common_ui.bcl(settings.bcl),
        modify_field(
          common_ui.alarm_mode(settings.almod, {
            options: [t("alarm_site"), t("alarm_tone"), t("alarm_code")],
          }),
          (f) => ({
            ...f,
            get: () => {
              const val = f.get() as number;
              return val > 0x02 ? 0x01 : val;
            },
          })
        ),
        common_ui.scan_mode(settings.screv, { options: [t("scan_time"), t("scan_carrier"), t("scan_search")] }),
        common_ui.pow_battery_save_ratio(settings.save),
        common_ui.beep(settings.beep),
        common_ui.roger_beep_select(settings.roger, { options: [t("off"), t("beep"), "TO-1200"] }),
        this.HAS_RTONE ? common_ui.rtone(settings.rtone, { frequencies: [1000, 1450, 1750, 2100] }) : common_ui.none(),
        this.HAS_DUAL_PTT
          ? {
              type: "switcher",
              id: "single_ptt",
              name: "Single PTT",
              tab: UITab.Control,
              get: () => Boolean(settings.singleptt.get()),
              set: (val) => settings.singleptt.set(val ? 1 : 0),
            }
          : common_ui.none(),
        common_ui.pow_tot(settings.timeout, { from: 15, to: 600, step: 15 }),
        common_ui.voice_language(settings.voice, { languages: [t("off"), t("lang_en"), t("lang_ch")] }),
        common_ui.backlight_timeout(settings.abr, { min: 0, max: 24 }),
        common_ui.vox_sens(settings.vox, { max: 10 }),
        common_ui.hello_msg_str_x(poweron_msg.line1, { line: 1 }),
        common_ui.hello_msg_str_x(poweron_msg.line2, { line: 2 }),

        ...pttid.map(
          (id, i): UI.Field.Chars => ({
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
        await serial.write(indent.slice(i, i + 1));
        await new Promise((r) => setTimeout(r, 10));
      }

      const ack = await serial.read(1);
      if (!ack.equals(ACK)) throw new Error("Identification rejected");

      await serial.write(Buffer.from([0x02]));

      const response = await serial.read(8);

      console.log("Response:", response.toString("hex"));

      await serial.write(ACK);
      const ack2 = await serial.read(1);
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

    await serial.write(cmd);

    if (!first) {
      const ack = await serial.read(1);
      if (!ack.equals(ACK)) throw new Error("Refused NOT first block reading");
    }

    const expect_answer = Buffer.from(cmd);
    expect_answer.write("X", 0);

    const answer = await serial.read(4);
    if (!answer.equals(expect_answer)) throw new Error("Invalid answer when reading");

    const data = await serial.read(size);

    await serial.write(Buffer.from([0x06]));
    await new Promise((r) => setTimeout(r, 50));

    return data;
  }

  protected async _write_block(addr: number, data: Buffer) {
    const cmd = Buffer.alloc(4);
    cmd.write("X", 0);
    cmd.writeUInt16BE(addr, 1);
    cmd.writeUInt8(data.length, 3);

    await serial.write(Buffer.concat([cmd, data]));

    await new Promise((r) => setTimeout(r, 50));

    const ack = await serial.read(1);
    if (!ack.equals(ACK)) throw new Error(`Refused to access block 0x${addr.toString(16)}`);
  }

  override async load(snapshot: Buffer) {
    const mem = this._parse(snapshot);

    this._img = snapshot;
    this._mem = mem;
    this.dispatch_ui_change();
  }

  override async read() {
    this.dispatch_progress(0);

    this._img = undefined;
    this._mem = undefined;
    this.dispatch_ui_change();

    await serial.begin({ baudRate: 9600 });
    await serial.clear();

    const ident = await this._read_ident();

    const block0 = await this._read_block(0x1e80, 0x40, true);
    const block1 = await this._read_block(0x1ec0, 0x40);
    const block2 = await this._read_block(0x1fc0, 0x40);

    const version = block1.slice(48, 62);
    console.log("Firmware:", version.toString("ascii"));

    const img = Buffer.alloc(this.MEM_SIZE);

    this.dispatch_progress(0.1);

    for (const [start, end, block_size] of this.MEM_RANGES) {
      for (let i = start; i < end; i += block_size) {
        const block = await this._read_block(i, block_size);
        block.copy(img, i);

        this.dispatch_progress(0.1 + 0.8 * (i / this.MEM_SIZE));
      }
    }

    this.load(img);

    this.dispatch_progress(1);
  }

  override async write() {
    this.dispatch_progress(0);

    const img = this._img;
    if (!img) throw new Error("No data");

    await serial.begin({ baudRate: 9600 });
    await serial.clear();

    const ident = await this._read_ident();

    for (const [start, end] of this.MEM_RANGES) {
      for (let i = start; i < end; i += this.WRITE_BLOCK_SIZE) {
        if (i >= 0x0cf0 && i <= 0x0d00) continue;
        if (i >= 0x0df0 && i <= 0x0e00) continue;

        await this._write_block(i, img.slice(i, i + this.WRITE_BLOCK_SIZE));

        this.dispatch_progress(0.1 + 0.9 * (i / this.MEM_SIZE));
      }
    }

    this.dispatch_progress(1);
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
    { watt: 8, name: t("power_high") },
    { watt: 5, name: t("power_mid") },
    { watt: 1, name: t("power_low") },
  ];
}

export class UV16ProRadio extends UV5RRadio {
  static override Info: RadioInfo = {
    vendor: "Baofeng",
    model: "UV-16 Pro",
  };

  protected override readonly INDENTS: Buffer[] = [INDENT_291, INDENT_A58];
  protected readonly HAS_RTONE = true;
}

export class UV16Pro8Radio extends UV16ProRadio {
  static override Info: RadioInfo = {
    vendor: "Baofeng",
    model: "UV-16 Pro (8 watt)",
  };

  protected readonly POWER_LEVELS = [
    { watt: 8, name: t("power_high") },
    { watt: 5, name: t("power_mid") },
    { watt: 1, name: t("power_low") },
  ];
}
