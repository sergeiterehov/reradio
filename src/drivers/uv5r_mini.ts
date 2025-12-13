import { Buffer } from "buffer";
import { Radio, type RadioInfo } from "./radio";
import type { UI } from "@/utils/ui";
import { serial } from "@/utils/serial";
import { array_of, create_mem_mapper, type M } from "@/utils/mem";
import { common_ui, UITab } from "@/utils/common_ui";
import { CTCSS_TONES, DCS_CODES, trim_string } from "@/utils/radio";
import { t } from "i18next";

const DTMF_CHARS = "0123456789ABCD*#";

// Таблица шифрования (массив Buffer'ов)
const tblEncrySymbol: Buffer[] = [
  Buffer.from("BHT ", "ascii"),
  Buffer.from("CO 7", "ascii"),
  Buffer.from("A ES", "ascii"),
  Buffer.from(" EIY", "ascii"),
  Buffer.from("M PQ", "ascii"),
  Buffer.from("XN Y", "ascii"),
  Buffer.from("RVB ", "ascii"),
  Buffer.from(" HQP", "ascii"),
  Buffer.from("W RC", "ascii"),
  Buffer.from("MS N", "ascii"),
  Buffer.from(" SAT", "ascii"),
  Buffer.from("K DH", "ascii"),
  Buffer.from("ZO R", "ascii"),
  Buffer.from("C SL", "ascii"),
  Buffer.from("6RB ", "ascii"),
  Buffer.from(" JCG", "ascii"),
  Buffer.from("PN V", "ascii"),
  Buffer.from("J PK", "ascii"),
  Buffer.from("EK L", "ascii"),
  Buffer.from("I LZ", "ascii"),
];

function _crypto(symbolIndex: number, buffer: Buffer): Buffer {
  const tblEncryptSymbols = tblEncrySymbol[symbolIndex];
  let decBuffer = Buffer.alloc(0); // Изначально пустой буфер
  let index1 = 0;

  for (let index2 = 0; index2 < buffer.length; index2++) {
    const currentByte = buffer[index2];
    const keyByte = tblEncryptSymbols[index1];

    const boolEncryptChar =
      keyByte !== 32 &&
      currentByte !== 0 &&
      currentByte !== 255 &&
      currentByte !== keyByte &&
      currentByte !== (keyByte ^ 255);

    let outByte: number;
    if (boolEncryptChar) {
      outByte = currentByte ^ keyByte;
    } else {
      outByte = currentByte;
    }

    // Добавляем байт к результату
    decBuffer = Buffer.concat([decBuffer, Buffer.from([outByte])]);

    index1 = (index1 + 1) % 4;
  }

  return decBuffer;
}

export class UV5RMiniRadio extends Radio {
  static override Info: RadioInfo = {
    vendor: "Baofeng",
    model: "UV-5R Mini",
  };

  protected readonly _MEM_TOTAL = 0xa1c0;
  protected readonly _BLOCK_SIZE = 0x40;
  protected readonly _MEM_RANGES = [
    { addr: 0x0000, size: 0x8040 },
    { addr: 0x9000, size: 0x0040 },
    { addr: 0xa000, size: 0x01c0 },
  ];
  protected readonly _ANI_ADDR = 0xa000;
  protected readonly _PTT_ID_ADDR = 0xa020;

  protected readonly _PROG_CMD = Buffer.from("PROGRAMCOLORPROU", "ascii");
  protected readonly _PROG_ACK = Buffer.from([0x06]);
  protected readonly _READ_CMD = Buffer.from([0x52]);
  protected readonly _WRITE_CMD = Buffer.from("W", "ascii");
  protected readonly _WRITE_ACK = Buffer.from([0x06]);

  protected readonly _DCS_CODES = [...DCS_CODES, 645].sort((a, b) => a - b);
  protected readonly _CTCSS_TONE = [...CTCSS_TONES];

  protected readonly _encryption = true;
  protected readonly _encryption_index = 1;
  protected readonly _channels = 999;
  protected readonly _am_band = [108_000_000, 136_000_000];
  protected readonly _key_indexes = [
    [0x07, 0],
    [0x1c, 1],
    [0x1d, 2],
    [0x2d, 3],
    [0x0a, 4],
    [0x0c, 5],
    [0x34, 6],
    [0x08, 4],
    [0x03, 5],
  ];

  protected _img?: Buffer;
  protected _mem?: ReturnType<typeof this._parse>;

  protected _parse(img: Buffer) {
    const m = create_mem_mapper(img, this.dispatch_ui);

    return {
      channels: array_of(this._channels, () =>
        m.struct(() => ({
          rxfreq: m.lbcd(4),
          txfreq: m.lbcd(4),
          rxtone: m.u16(),
          txtone: m.u16(),
          scode: m.u8(),
          pttid: m.u8(),
          ...m.bitmap({ _unknown7: 2, scramble: 2, _unknown8: 2, lowpower: 2 }),
          ...m.bitmap({ _unknown1: 1, wide: 1, sqmode: 2, bcl: 1, scan: 1, _unknown2: 1, fhss: 1 }),
          _unknown3: m.u8(),
          _unknown4: m.u8(),
          _unknown5: m.u8(),
          _unknown6: m.u8(),
          name: m.str(12),
        }))
      ),

      ...m.seek(0x8000).skip(0, {}),

      vfo: array_of(2, () =>
        m.struct(() => ({
          freq: m.u8_array(8),
          rxtone: m.u16(),
          txtone: m.u16(),
          _unknown0: m.u8(),
          bcl: m.u8(),
          ...m.bitmap({ sftd: 3, scode: 5 }),
          _unknown1: m.u8(),
          lowpower: m.u8(),
          ...m.bitmap({ _unknown2: 1, wide: 1, _unknown3: 5, fhss: 1 }),
          _unknown4: m.u8(),
          step: m.u8(),
          offset: m.u8_array(6),
          _unknown5: m.u8_array(2),
          sqmode: m.u8(),
          _unknown6: m.u8_array(3),
        }))
      ),

      ...m.seek(0x9000).skip(0, {}),

      settings: m.struct(() => ({
        squelch: m.u8(),
        savemode: m.u8(),
        vox: m.u8(),
        backlight: m.u8(),
        dualstandby: m.u8(),
        tot: m.u8(),
        beep: m.u8(),
        voicesw: m.u8(),
        voice: m.u8(),
        sidetone: m.u8(),
        scanmode: m.u8(),
        pttid: m.u8(),
        pttdly: m.u8(),
        chadistype: m.u8(),
        chbdistype: m.u8(),
        bcl: m.u8(),
        autolock: m.u8(),
        alarmmode: m.u8(),
        alarmtone: m.u8(),
        _unknown1: m.u8(),
        tailclear: m.u8(),
        rpttailclear: m.u8(),
        rpttaildet: m.u8(),
        roger: m.u8(),
        a_or_b_selected: m.u8(),
        fmenable: m.u8(),
        ...m.bitmap({ chbworkmode: 4, chaworkmode: 4 }),
        keylock: m.u8(),
        powerondistype: m.u8(),
        tone: m.u8(),
        _unknown4: m.u8_array(2),
        voxdlytime: m.u8(),
        menuquittime: m.u8(),
        _unknown5: m.u8_array(2),
        dispani: m.u8(),
        _unknown11: m.u8_array(3),
        totalarm: m.u8(),
        _unknown6: m.u8_array(2),
        ctsdcsscantype: m.u8(),
        vfoscanmin: m.u16(),
        vfoscanmax: m.u16(),
        gpsw: m.u8(),
        gpsmode: m.u8(),
        key1short: m.u8(),
        _unknown7: m.u8(),
        key2short: m.u8(),
        _unknown8: m.u8_array(2),
        rstmenu: m.u8(),
        singlewatch: m.u8(),
        hangup: m.u8(),
        voxsw: m.u8(),
        gpstimezone: m.u8(),
        _unknown10: m.u8(),
        inputdtmf: m.u8(),
        gpsunits: m.u8(),
        pontime: m.u8(),
      })),

      ...m.seek(this._ANI_ADDR).skip(0, {}),

      ani: m.struct(() => ({
        code: m.u8_array(5),
        _unknown: m.u8(),
        ...m.bitmap({ _unused1: 6, aniid: 2 }),
        dtmfon: m.u8(),
        dtmfoff: m.u8(),
        separatecode: m.u8(),
        groupcallcode: m.u8(),
      })),

      ...m.seek(this._PTT_ID_ADDR).skip(0, {}),

      pttid: array_of(20, () =>
        m.struct(() => ({
          code: m.u8_array(5),
          name: m.str(10),
          _unused: m.u8(),
        }))
      ),

      upcode: m.struct(() => ({
        _unknown32: m.u8_array(32),
        code: m.u8_array(16),
      })),

      downcode: m.struct(() => ({
        code: m.u8_array(16),
      })),
    };
  }

  protected _get_squelch_ui(get_ref: (i: number) => M.U16): UI.Field.Channels["squelch_rx"] {
    return {
      options: ["Off", "CTCSS", "DCS"],
      codes: this._DCS_CODES,
      tones: this._CTCSS_TONE,
      get: (i) => {
        const val = get_ref(i).get();

        if (val === 0x0000 || val === 0xffff) return { mode: "Off" };

        if (val >= 0x0258) return { mode: "CTCSS", freq: val / 10 };

        if (val > 0x69) return { mode: "DCS", polarity: "I", code: this._DCS_CODES[val - 0x69 - 1] };

        return { mode: "DCS", polarity: "N", code: this._DCS_CODES[val - 1] };
      },
      set: (i, val) => {
        let raw = 0x0000;

        if (val.mode === "CTCSS") {
          raw = val.freq * 10;
        } else if (val.mode === "DCS") {
          raw = this._DCS_CODES.indexOf(val.code) + 1;
          if (val.polarity === "I") raw += 0x69;
        }

        get_ref(i).set(raw);
      },
    };
  }

  ui(): UI.Root {
    const mem = this._mem;
    if (!mem) return { fields: [] };

    const { channels, pttid, settings } = mem;

    return {
      fields: [
        {
          ...common_ui.channels({ size: channels.length }),
          channel: {
            get: (i) => trim_string(channels[i].name.get()) || `CH-${(i + 1).toString().padStart(3, "0")}`,
            set: (i, val) => {
              const name = channels[i].name;
              const size = name.raw.size;
              name.set(val.substring(0, size).padEnd(size, "\xFF"));
            },
          },
          swap: (a, b) => {
            const t = channels[a].__raw.get();
            channels[a].__raw.set(channels[b].__raw.get());
            channels[b].__raw.set(t);
          },
          empty: {
            get: (i) => channels[i].__raw.get()[0] === 0xff,
            delete: (i) => channels[i].__raw.set(new Array(channels[i].__raw.size).fill(0xff)),
            init: (i) => {
              const ch = channels[i];
              ch.__raw.set(new Array(channels[i].__raw.size).fill(0x00));
              ch.rxfreq.set(446_006_25);
              ch.txfreq.set(ch.rxfreq.get());
              ch.name.set("".padEnd(ch.name.raw.size, "\xFF"));
            },
          },
          freq: {
            min: 108_000_000,
            max: 519_999_999,
            get: (i) => channels[i].rxfreq.get() * 10,
            set: (i, val) => {
              const offset = channels[i].txfreq.get() - channels[i].rxfreq.get();

              channels[i].rxfreq.set(val / 10);
              channels[i].txfreq.set(channels[i].rxfreq.get() + offset);
            },
          },
          offset: {
            get: (i) => {
              const rx = channels[i].rxfreq.get();
              const tx = channels[i].txfreq.get();

              return (tx - rx) * 10;
            },
            set: (i, val) => {
              const rx = channels[i].rxfreq.get();
              channels[i].txfreq.set(rx + val / 10);
            },
          },
          mode: {
            options: ["NFM", "FM", "AM"],
            get: (i) => {
              const freq = channels[i].rxfreq.get() * 10;
              if (freq >= this._am_band[0] && freq < this._am_band[1]) return 2;
              if (channels[i].wide.get()) return 0;

              return 1;
            },
            set: (i, val) => channels[i].wide.set(val === 0 ? 1 : 0),
          },
          squelch_rx: this._get_squelch_ui((i) => channels[i].rxtone),
          squelch_tx: this._get_squelch_ui((i) => channels[i].txtone),
          power: {
            options: [5, 1],
            name: (val) => [t("power_high"), t("power_low")][val] || "?",
            get: (i) => (channels[i].lowpower.get() === 1 ? 1 : 0),
            set: (i, val) => channels[i].lowpower.set(val),
          },
          ptt_id: {
            on_options: ["Off", "Begin", "End", "BeginAndEnd"],
            id_options: pttid.map((id) => {
              const code = id.code
                .get()
                .map((c) => DTMF_CHARS[c] || "")
                .join("");
              if (!code) return t("off");

              const name = trim_string(id.name.get());
              if (name) return `${name} (${code})`;

              return code;
            }),
            get: (i) => ({ on: channels[i].pttid.get(), id: channels[i].scode.get() }),
            set: (i, val) => {
              channels[i].pttid.set(val.on);
              channels[i].scode.set(val.id);
            },
          },
          scan: {
            options: ["Off", "On"],
            get: (i) => channels[i].scan.get(),
            set: (i, val) => channels[i].scan.set(val),
          },
          bcl: {
            get: (i) => channels[i].bcl.get() === 1,
            set: (i, val) => channels[i].bcl.set(val ? 1 : 0),
          },
        },
        common_ui.beep(settings.beep),
        common_ui.sql(settings.squelch, { min: 0, max: 9 }),
        common_ui.pow_tot(settings.tot, { from: 0, to: 180, step: 15 }),
        common_ui.dual_watch(settings.dualstandby),
        common_ui.voice_prompt(settings.voicesw),
        common_ui.voice_language(settings.voice, { languages: [t("lang_en"), t("lang_ch")] }),
        common_ui.hello_mode(settings.powerondistype, { options: [t("hello_picture"), t("hello_voltage")] }),
        common_ui.backlight_timeout(settings.backlight, {
          min: 0,
          max: 4,
          seconds: [0, 5, 10, 15, 20],
          names: { 0: t("always_on") },
        }),
        common_ui.keypad_lock_auto(settings.autolock),
        common_ui.roger_beep(settings.roger),
        common_ui.pow_battery_save(settings.savemode),
        common_ui.rtone(settings.tone, { frequencies: [1000, 1450, 1750, 2100] }),
        common_ui.scan_mode(settings.scanmode, { options: [t("scan_time"), t("scan_carrier"), t("scan_search")] }),
        common_ui.alarm_mode(settings.alarmmode, { options: [t("alarm_site"), t("alarm_tone"), t("alarm_code")] }),
        common_ui.timeout_alarm(settings.totalarm, { from: 0, to: 10, step: 1 }),
        common_ui.key_side_fn(
          {
            get: () => {
              const code = settings.key1short.get();
              for (const [key, index] of this._key_indexes) {
                if (code === key) return index;
              }
              return 0;
            },
            set: (val) => {
              const [key] = this._key_indexes[val] || this._key_indexes[0];
              settings.key1short.set(key);
            },
          },
          { functions: [t("fn_fm"), t("fn_scan"), t("fn_search"), t("fn_vox"), t("fn_sos")] }
        ),
        common_ui.vox(settings.voxsw),
        common_ui.vox_level(settings.vox, { min: 0, max: 8 }),
        common_ui.vox_delay(settings.voxdlytime, { from: 0.5, to: 2, step: 0.1 }),

        ...pttid.flatMap((id, i): [UI.Field.Chars, UI.Field.Text] => [
          {
            type: "chars",
            id: `ptt_id_${i}`,
            name: `PTT ID ${i + 1}`,
            tab: UITab.DTMF,
            abc: DTMF_CHARS,
            pad: "\xff",
            uppercase: true,
            length: id.code.size,
            get: () => id.code.get(),
            set: (val) => {
              id.code.set(val);
              this.dispatch_ui_change();
            },
          },
          {
            type: "text",
            id: `ptt_name_${i}`,
            name: `Name ${i + 1}`,
            tab: UITab.DTMF,
            get: () => trim_string(id.name.get()),
            set: (val) => {
              id.name.set(val.substring(0, id.name.raw.size).padEnd(id.name.raw.size, "\xFF"));
              this.dispatch_ui_change();
            },
          },
        ]),
      ],
    };
  }

  protected async _indent() {
    await serial.write(this._PROG_CMD);

    const ack = await serial.read(this._PROG_ACK.length);
    if (!ack.equals(this._PROG_ACK)) throw new Error("Unexpected indent ACK");

    await serial.write(Buffer.from([0x46]));
    await serial.read(16);

    await serial.write(Buffer.from([0x4d]));
    await serial.read(15);

    await serial.write(
      Buffer.from([
        0x53, 0x45, 0x4e, 0x44, 0x21, 0x05, 0x0d, 0x01, 0x01, 0x01, 0x04, 0x11, 0x08, 0x05, 0x0d, 0x0d, 0x01, 0x11,
        0x0f, 0x09, 0x12, 0x09, 0x10, 0x04, 0x00,
      ])
    );
    await serial.read(1);
  }

  private _optional_crypto(data: Buffer) {
    if (!this._encryption) return data;

    return _crypto(this._encryption_index, data);
  }

  protected async _read_block(addr: number, size: number) {
    const cmd = Buffer.alloc(4);
    this._READ_CMD.copy(cmd, 0);
    cmd.writeUInt16BE(addr, 1);
    cmd.writeUInt8(size, 3);

    await serial.write(cmd);

    const res = await serial.read(4 + size);
    if (!res.slice(0, cmd.length).equals(cmd)) throw new Error("Unexpected response header");

    const data = this._optional_crypto(res.slice(4));

    return data;
  }

  protected async _write_block(addr: number, data: Buffer) {
    const cmd = Buffer.alloc(4 + data.length);
    this._WRITE_CMD.copy(cmd, 0);
    cmd.writeUInt16BE(addr, 1);
    cmd.writeUInt8(data.length, 3);
    this._optional_crypto(data).copy(cmd, 4);

    await serial.write(cmd);

    const ack = await serial.read(1);
    if (!ack.equals(this._WRITE_ACK)) throw new Error("Unexpected write ack");
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

    await serial.begin({ baudRate: 115_200 });
    await serial.clear();

    await this._indent();

    this.dispatch_progress(0.1);

    const img = Buffer.alloc(this._MEM_TOTAL);

    for (const range of this._MEM_RANGES) {
      for (let i = range.addr; i < range.addr + range.size; i += this._BLOCK_SIZE) {
        const block = await this._read_block(i, this._BLOCK_SIZE);
        block.copy(img, i);

        this.dispatch_progress(0.1 + 0.8 * (i / img.length));
      }
    }

    const mem = this._parse(img);

    this._img = img;
    this._mem = mem;
    this.dispatch_ui_change();

    this.dispatch_progress(1);
  }

  override async write() {
    if (!this._img) throw new Error("No data");
    const img = Buffer.from(this._img);

    this.dispatch_progress(0);

    await serial.begin({ baudRate: 115_200 });
    await serial.clear();

    await this._indent();

    this.dispatch_progress(0.1);

    for (const range of this._MEM_RANGES) {
      for (let i = range.addr; i < range.addr + range.size; i += this._BLOCK_SIZE) {
        const block = img.slice(i, i + this._BLOCK_SIZE);
        await this._write_block(i, block);

        this.dispatch_progress(0.1 + 0.8 * (i / img.length));
      }
    }

    this.dispatch_progress(1);
  }
}
