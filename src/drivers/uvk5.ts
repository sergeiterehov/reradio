import { Buffer } from "buffer";
import type { UI } from "@/utils/ui";
import { QuanshengBaseRadio } from "./quansheng";
import type { RadioInfo } from "./radio";
import { array_of, create_mem_mapper, type M } from "@/utils/mem";
import { CTCSS_TONES, DCS_CODES, trim_string } from "@/utils/radio";
import { common_ui, modify_field, UITab } from "@/utils/common_ui";
import { t } from "i18next";
import { serial } from "@/utils/serial";

const CONFIG_MEM_SIZE = 0x2000;
const CONFIG_PROG_SIZE = 0x1d00;
const CONFIG_BLOCK_SIZE = 0x80;

const SHIFT_NONE = 0x0;
const SHIFT_PLUS = 0x1;
const SHIFT_MINUS = 0x2;

const SUB_TONE_FLAG_NONE = 0x0;
const SUB_TONE_FLAG_CTCSS = 0x1;
const SUB_TONE_FLAG_DCS_N = 0x2;
const SUB_TONE_FLAG_DCS_I = 0x3;

const PTT_ID_ON_OPTIONS: UI.PttIdOn[] = ["Off", "Begin", "End", "BeginAndEnd"];

const VFO_CHANNEL_NAMES = [
  "F1(50M-76M)A",
  "F1(50M-76M)B",
  "F2(108M-136M)A",
  "F2(108M-136M)B",
  "F3(136M-174M)A",
  "F3(136M-174M)B",
  "F4(174M-350M)A",
  "F4(174M-350M)B",
  "F5(350M-400M)A",
  "F5(350M-400M)B",
  "F6(400M-470M)A",
  "F6(400M-470M)B",
  "F7(470M-600M)A",
  "F7(470M-600M)B",
];

const KEY_ACTIONS_LIST = [
  t("off"),
  t("fn_flashlight"),
  t("fn_power_select"),
  t("fn_monitor"),
  t("fn_scan"),
  t("fn_vox"),
  t("fn_alarm"),
  t("fn_fm"),
  t("fn_1750"),
];

const BANDS_NO_LIMITS = [
  [18_000_000, 76_000_000],
  [108_000_000, 137_000_000],
  [137_000_000, 174_000_000],
  [174_000_000, 350_000_000],
  [350_000_000, 400_000_000],
  [400_000_000, 470_000_000],
  [470_000_000, 1_300_000_000],
];

export class UVK5Radio extends QuanshengBaseRadio {
  static Info: RadioInfo = {
    id: "uvk5",
    vendor: "Quansheng",
    model: "UV-K5",
  };

  protected _img?: Buffer;
  protected _mem?: ReturnType<typeof this._parse>;

  protected _parse(img: Buffer) {
    const m = create_mem_mapper(img, this.dispatch_ui);

    return {
      channels: array_of(214, () =>
        m.struct(() => ({
          freq: m.u32(),
          offset: m.u32(),

          rxcode: m.u8(),
          txcode: m.u8(),

          ...m.bitmap({
            txcodeflag: 4,
            rxcodeflag: 4,
          }),
          ...m.bitmap({
            flags1_unknown7: 1,
            flags1_unknown6: 1,
            flags1_unknown5: 1,
            enable_am: 1,
            flags1_unknown3: 1,
            is_in_scanlist: 1,
            shift: 2,
          }),
          ...m.bitmap({
            flags2_unknown7: 1,
            flags2_unknown6: 1,
            flags2_unknown5: 1,
            bclo: 1,
            txpower: 2,
            bandwidth: 1,
            freq_reverse: 1,
          }),
          ...m.bitmap({
            dtmf_flags_unknown7: 1,
            dtmf_flags_unknown6: 1,
            dtmf_flags_unknown5: 1,
            dtmf_flags_unknown4: 1,
            dtmf_flags_unknown3: 1,
            dtmf_pttid: 2,
            dtmf_decode: 1,
          }),

          step: m.u8(),
          scrambler: m.u8(),
        }))
      ),

      ...m.seek(0xd60).skip(0, {}),
      channel_attributes: array_of(200, () =>
        m.struct(() => ({
          ...m.bitmap({ is_scanlist1: 1, is_scanlist2: 1, compander: 2, is_free: 1, band: 3 }),
        }))
      ),

      ...m.seek(0xe40).skip(0, {}),
      fmfreq: array_of(20, () => m.u16()),

      ...m.seek(0xe70).skip(0, {}),
      call_channel: m.u8(),
      squelch: m.u8(),
      max_talk_time: m.u8(),
      noaa_autoscan: m.u8(),
      key_lock: m.u8(),
      vox_switch: m.u8(),
      vox_level: m.u8(),
      mic_gain: m.u8(),
      unknown3: m.u8(),
      channel_display_mode: m.u8(),
      crossband: m.u8(),
      battery_save: m.u8(),
      dual_watch: m.u8(),
      backlight_auto_mode: m.u8(),
      tail_note_elimination: m.u8(),
      vfo_open: m.u8(),

      ...m.seek(0xe90).skip(0, {}),
      beep_control: m.u8(),
      key1_shortpress_action: m.u8(),
      key1_longpress_action: m.u8(),
      key2_shortpress_action: m.u8(),
      key2_longpress_action: m.u8(),
      scan_resume_mode: m.u8(),
      auto_keypad_lock: m.u8(),
      power_on_dispmode: m.u8(),
      password: m.u8_array(8),

      ...m.seek(0xea0).skip(0, {}),
      keypad_tone: m.u8(),
      language: m.u8(),

      ...m.seek(0xea8).skip(0, {}),
      alarm_mode: m.u8(),
      reminding_of_end_talk: m.u8(),
      repeater_tail_elimination: m.u8(),

      ...m.seek(0xeb0).skip(0, {}),
      logo_line1: m.str(16),
      logo_line2: m.str(16),

      ...m.seek(0xed0).skip(0, {}),
      dtmf_settings: {
        side_tone: m.u8(),
        separate_code: m.str(1),
        group_call_code: m.str(1),
        decode_response: m.u8(),
        auto_reset_time: m.u8(),
        preload_time: m.u8(),
        first_code_persist_time: m.u8(),
        hash_persist_time: m.u8(),
        code_persist_time: m.u8(),
        code_interval_time: m.u8(),
        permit_remote_kill: m.u8(),
      },

      ...m.seek(0xee0).skip(0, {}),
      dtmf_settings_numbers: {
        dtmf_local_code: m.str(3),
        unused1: m.str(5),
        kill_code: m.str(5),
        unused2: m.str(3),
        revive_code: m.str(5),
        unused3: m.str(3),
        dtmf_up_code: m.str(16),
        dtmf_down_code: m.str(16),
      },

      ...m.seek(0xf18).skip(0, {}),
      scanlist_default: m.u8(),
      scanlist1_priority_scan: m.u8(),
      scanlist1_priority_ch1: m.u8(),
      scanlist1_priority_ch2: m.u8(),
      scanlist2_priority_scan: m.u8(),
      scanlist2_priority_ch1: m.u8(),
      scanlist2_priority_ch2: m.u8(),
      scanlist_unknown_0xff: m.u8(),

      ...m.seek(0xf40).skip(0, {}),
      lock: {
        flock: m.u8(),
        tx350: m.u8(),
        killed: m.u8(),
        tx200: m.u8(),
        tx500: m.u8(),
        en350: m.u8(),
        enscramble: m.u8(),
      },

      ...m.seek(0xf50).skip(0, {}),
      channelname: array_of(200, () => m.struct(() => ({ name: m.str(16) }))),

      ...m.seek(0x1c00).skip(0, {}),
      dtmfcontact: array_of(16, () => ({
        name: m.str(8),
        number: m.str(3),
        unused_00: m.str(5),
      })),

      ...m.seek(0x1ed0).skip(0, {}),
      perbandpowersettings: array_of(7, () => ({
        low: {
          start: m.u8(),
          mid: m.u8(),
          end: m.u8(),
        },
        medium: {
          start: m.u8(),
          mid: m.u8(),
          end: m.u8(),
        },
        high: {
          start: m.u8(),
          mid: m.u8(),
          end: m.u8(),
        },
        unused_00: m.u8_array(7),
      })),

      ...m.seek(0x1f40).skip(0, {}),
      battery_level: array_of(6, () => m.u16()),
    };
  }

  protected _get_ui_squelch(config: {
    flag_ref: (i: number) => M.Bits;
    code_ref: (i: number) => M.U8;
  }): UI.Field.Channels["squelch_rx"] {
    return {
      options: ["Off", "CTCSS", "DCS"],
      codes: DCS_CODES,
      tones: CTCSS_TONES,
      get: (i) => {
        const flag = config.flag_ref(i).get();

        if (flag === SUB_TONE_FLAG_NONE) return { mode: "Off" };

        const code = config.code_ref(i).get();

        if (flag === SUB_TONE_FLAG_CTCSS) return { mode: "CTCSS", freq: CTCSS_TONES[code] };

        return { mode: "DCS", code: DCS_CODES[code], polarity: flag === SUB_TONE_FLAG_DCS_N ? "N" : "I" };
      },
      set: (i, val) => {
        const flag = config.flag_ref(i);
        const code = config.code_ref(i);

        if (val.mode === "Off") {
          flag.set(SUB_TONE_FLAG_NONE);
        } else if (val.mode === "CTCSS") {
          flag.set(SUB_TONE_FLAG_CTCSS);
          code.set(CTCSS_TONES.indexOf(val.freq));
        } else if (val.mode === "DCS") {
          flag.set(val.polarity === "N" ? SUB_TONE_FLAG_DCS_N : SUB_TONE_FLAG_DCS_I);
          code.set(DCS_CODES.indexOf(val.code));
        }
      },
    };
  }

  override ui(): UI.Root {
    const mem = this._mem;

    if (!mem) return { fields: [] };

    const { channels, channel_attributes, channelname } = mem;

    return {
      fields: [
        {
          ...common_ui.channels({ size: channels.length }),
          channel: {
            get: (i) => {
              if (i >= channelname.length) return VFO_CHANNEL_NAMES[i - channelname.length];

              return trim_string(channelname.at(i)?.name.get() || "") || `CH-${i + 1}`;
            },
          },
          swap: (a, b) => {
            if (a >= channelname.length || b >= channelname.length) return;
            {
              const t = channels[a].__raw.get();
              channels[a].__raw.set(channels[b].__raw.get());
              channels[b].__raw.set(t);
            }
            {
              const t = channelname[a].__raw.get();
              channelname[a].__raw.set(channelname[b].__raw.get());
              channelname[b].__raw.set(t);
            }
            {
              const t = channel_attributes[a].__raw.get();
              channel_attributes[a].__raw.set(channel_attributes[b].__raw.get());
              channel_attributes[b].__raw.set(t);
            }
          },
          empty: {
            get: (i) => {
              const attributes = channel_attributes.at(i);

              if (attributes?.is_free.get()) return true;

              const freq_val = channels[i].freq.get();
              return freq_val === 0 || freq_val === 0xffffffff;
            },
            delete: (i) => {
              const ch = channels[i];
              ch.__raw.set(Array(ch.__raw.size).fill(0xff));
              if (i < channel_attributes.length) {
                const name = channelname[i].name;
                name.set("".padEnd(name.raw.size, "\x00"));

                const attr = channel_attributes[i];
                attr.band.set(7);
                attr.is_free.set(1);
              }
            },
            init: (i) => {
              const ch = channels[i];
              ch.__raw.set(Array(ch.__raw.size).fill(0x00));
              ch.freq.set(400_000_00);
              if (i < channel_attributes.length) {
                const attr = channel_attributes[i];
                attr.band.set(5);
                attr.is_free.set(0);
              }
            },
          },
          freq: {
            get: (i) => channels[i].freq.get() * 10,
            set: (i, val) => {
              channels[i].freq.set(val / 10);

              if (i < channel_attributes.length) {
                let band = BANDS_NO_LIMITS.findIndex(([a, b]) => a <= val && val < b);

                // CHIRP: currently the hacked firmware sets band=1 below 50 MHz
                if (val < 50_000_000) band = 1;

                channel_attributes[i].band.set(band);
              }
            },
          },
          offset: {
            get: (i) => {
              const shift_val = channels[i].shift.get();

              if (shift_val === SHIFT_NONE) return 0;

              return (shift_val === SHIFT_MINUS ? -1 : 1) * channels[i].offset.get() * 10;
            },
            set: (i, val) => {
              channels[i].offset.set(Math.abs(val / 10));

              if (val === 0) {
                channels[i].shift.set(SHIFT_NONE);
              } else {
                channels[i].shift.set(val < 0 ? SHIFT_MINUS : SHIFT_PLUS);
              }
            },
          },
          mode: {
            options: ["FM", "NFM", "AM", "NAM"],
            get: (i) => (channels[i].enable_am.get() ? 2 : 0) + (channels[i].bandwidth.get() ? 1 : 0),
            set: (i, val) => {
              channels[i].enable_am.set(val >= 2 ? 1 : 0);
              channels[i].bandwidth.set(val % 2);
            },
          },
          squelch_rx: this._get_ui_squelch({
            flag_ref: (i) => channels[i].rxcodeflag,
            code_ref: (i) => channels[i].rxcode,
          }),
          squelch_tx: this._get_ui_squelch({
            flag_ref: (i) => channels[i].txcodeflag,
            code_ref: (i) => channels[i].txcode,
          }),
          power: {
            options: [1.5, 3, 5],
            name: (pow) => [t("power_low"), t("power_mid"), t("power_high")][pow] || t("unspecified"),
            get: (i) => channels[i].txpower.get(),
            set: (i, val) => channels[i].txpower.set(val),
          },
          bcl: {
            get: (i) => channels[i].bclo.get() !== 0,
            set: (i, val) => channels[i].bclo.set(val ? 1 : 0),
          },
          ptt_id: {
            on_options: PTT_ID_ON_OPTIONS,
            id_options: [],
            get: (i) => ({ id: 0, on: channels[i].dtmf_pttid.get() }),
            set: (i, val) => channels[i].dtmf_pttid.set(val.on),
          },
        },

        common_ui.beep(mem.beep_control),
        common_ui.voice_language(mem.keypad_tone, { languages: [t("off"), t("lang_ch"), t("lang_en")] }),
        common_ui.language(mem.language, { languages: [t("lang_ch"), t("lang_en")] }),
        modify_field(
          common_ui.hello_mode(mem.power_on_dispmode, {
            options: [t("hello_blank"), t("hello_text"), t("hello_voltage")],
          }),
          (f): UI.Field.Select => ({
            ...f,
            set: (val) => {
              f.set(val);
              this.dispatch_ui_change();
            },
          })
        ),
        ...(mem.power_on_dispmode.get() === 1
          ? [
              common_ui.hello_msg_str_x(mem.logo_line1, { line: 1, pad: "\x00" }),
              common_ui.hello_msg_str_x(mem.logo_line2, { line: 2, pad: "\x00" }),
            ]
          : []),
        common_ui.keypad_lock_auto(mem.auto_keypad_lock),
        common_ui.key_side_short_x_fn(mem.key1_shortpress_action, { key: "1", functions: KEY_ACTIONS_LIST }),
        common_ui.key_side_long_x_fn(mem.key1_longpress_action, { key: "1", functions: KEY_ACTIONS_LIST }),
        common_ui.key_side_short_x_fn(mem.key2_shortpress_action, { key: "2", functions: KEY_ACTIONS_LIST }),
        common_ui.key_side_long_x_fn(mem.key2_longpress_action, { key: "2", functions: KEY_ACTIONS_LIST }),
        common_ui.mic_gain(mem.mic_gain, { min: 0, max: 4 }),
        common_ui.sql(mem.squelch, { min: 0, max: 9 }),
        common_ui.vox(mem.vox_switch),
        common_ui.vox_level(mem.vox_level, { min: 1, max: 10 }),
        common_ui.pow_battery_save_ratio(mem.battery_save),
        common_ui.pow_tot(mem.max_talk_time, { from: 0, to: 600, step: 60 }),
        common_ui.backlight_timeout(mem.backlight_auto_mode, { min: 0, max: 5 }),
        common_ui.dual_watch_priority_ab(mem.dual_watch),
        common_ui.alarm_mode(mem.alarm_mode, { options: [t("alarm_site"), t("alarm_tone")] }),
        common_ui.roger_beep_select(mem.reminding_of_end_talk, { options: [t("off"), t("roger_beep_roger"), "MDC"] }),

        {
          type: "select",
          id: "flock",
          name: t("frequency_lock"),
          tab: UITab.Unlock,
          options: [
            t("off"),
            t("frequency_lock_fcc"),
            t("frequency_lock_ce"),
            t("frequency_lock_gb"),
            t("frequency_lock_430"),
            t("frequency_lock_438"),
          ],
          get: () => mem.lock.flock.get(),
          set: (val) => mem.lock.flock.set(Number(val)),
        },
        common_ui.unlock_tx350(mem.lock.tx350),
        common_ui.unlock_en350(mem.lock.en350),
        common_ui.unlock_tx200(mem.lock.tx200),
        common_ui.unlock_tx500(mem.lock.tx500),
        common_ui.unlock_scramble(mem.lock.enscramble),
      ],
    };
  }

  override async load(snapshot: Buffer) {
    const mem = this._parse(snapshot);

    this._img = snapshot;
    this._mem = mem;
    this.dispatch_ui_change();
  }

  override async upload() {
    if (!this._img) throw new Error("No data");
    return { version: 0, snapshot: Buffer.from(this._img) };
  }

  override async read() {
    this.dispatch_progress(0);

    this._mem = undefined;
    this._img = undefined;
    this.dispatch_ui_change();

    await serial.begin({ baudRate: this._baudRate });
    await serial.clear({ timeout: 1_000 });

    const info = await this._hello();

    console.log(info);

    this.dispatch_progress(0.1);

    const img = Buffer.alloc(CONFIG_MEM_SIZE);

    for (let addr = 0; addr < CONFIG_MEM_SIZE; addr += CONFIG_BLOCK_SIZE) {
      const block = await this._read_block(addr, CONFIG_BLOCK_SIZE);

      block.copy(img, addr);

      this.dispatch_progress(0.1 + 0.8 * (addr / CONFIG_MEM_SIZE));
    }

    this.dispatch_progress(0.9);

    await this.load(img);

    this.dispatch_progress(1);
  }

  override async write() {
    if (!this._img) throw new Error("No data");
    const img = Buffer.from(this._img);

    this.dispatch_progress(0);

    await serial.begin({ baudRate: this._baudRate });
    await serial.clear({ timeout: 1_000 });

    const info = await this._hello();

    console.log(info);

    this.dispatch_progress(0.1);

    for (let addr = 0; addr < CONFIG_PROG_SIZE; addr += CONFIG_BLOCK_SIZE) {
      const block = img.slice(addr, addr + CONFIG_BLOCK_SIZE);

      await this._write_block(addr, block);

      this.dispatch_progress(0.1 + 0.9 * (addr / CONFIG_PROG_SIZE));
    }

    this.dispatch_progress(1);
  }
}

const MAX_FLASH_SIZE = 0x10000;

export class UVK5ProgRadio extends QuanshengBaseRadio {
  static Info: RadioInfo = {
    id: "uvk5_prog",
    vendor: "Quansheng",
    model: "UV-K5 Firmware",
  };

  private _file?: File;
  private _firmware?: {
    data: Buffer;
    firmware_version: Buffer;
  };
  private _bootloader_version?: Buffer;

  ui(): UI.Root {
    return {
      fields: [
        {
          type: "label",
          id: "disclaimer",
          name: t("warning"),
          tab: UITab.Firmware,
          get: () => t("k5_firmware_versions_disclaimer"),
        },
        this._bootloader_version
          ? {
              type: "label",
              id: "bootloader_version",
              name: t("bootloader_version"),
              tab: UITab.Firmware,
              get: () => {
                if (!this._bootloader_version) return t("unspecified");

                const version = trim_string(this._bootloader_version.toString("ascii"));

                if (version.startsWith("2.")) return `${version} - UV-K5 Rev 1 (MT6250DA).`;
                if (version.startsWith("1.")) return `${version} - UV-K5 Rev 2 (BK4000 + PA/LNA)`;
                if (version.startsWith("3.")) return `${version} - UV-K5 Rev 2 (BK4000 + PA/LNA)`;

                return version;
              },
            }
          : common_ui.none(),
        {
          type: "file",
          id: "new_firmware_file",
          name: t("new_firmware_file"),
          tab: UITab.Firmware,
          get: () => this._file,
          set: async (val) => {
            if (!val) {
              this._file = undefined;
              this._firmware = undefined;
              this.dispatch_ui_change();
              return;
            }

            await this._handle_file(val);

            this._file = val;
            this.dispatch_ui();
          },
        },
        this._firmware
          ? {
              type: "label",
              id: "firmware_version",
              name: t("firmware_version"),
              tab: UITab.Firmware,
              get: () => trim_string(this._firmware?.firmware_version.toString("ascii") || "") || t("unspecified"),
            }
          : common_ui.none(),
      ],
    };
  }

  private async _handle_file(file: File) {
    let data = Buffer.from(await file.arrayBuffer());

    if (data.length < 2_000) throw new Error("File appears to be to small to be a firmware file");

    const firmware_version = Buffer.alloc(17);
    let encrypted = true;

    const crc1 = QuanshengBaseRadio.Utils.crc16(data.slice(0, -2));
    const crc2 = data.readUInt16LE(data.length - 2);

    const is_data_not_encrypted = () =>
      data[2] == 0x00 && data[3] == 0x20 && data[6] == 0x00 && data[10] == 0x00 && data[14] == 0x00;

    if (is_data_not_encrypted()) encrypted = false;

    if (encrypted && crc1 == crc2) {
      data = data.slice(0, -2);

      QuanshengBaseRadio.Utils.xor_firmware_arr_mut(data);

      if (is_data_not_encrypted()) encrypted = false;

      if (!encrypted) console.log("Firmware de-obfuscated");

      const p_version = 0x2000;
      const p_rest = p_version + 16;

      if (!encrypted && data.length >= p_rest) {
        data.copy(firmware_version, 0, p_version, p_rest);

        console.log(`Firmware version: ${firmware_version.toString("ascii")}`);

        data = Buffer.concat([data.slice(0, p_version), data.slice(p_rest)]);
      }
    }

    if (encrypted) throw new Error("File doesn't appear to be valid for uploading");

    if (data.length > MAX_FLASH_SIZE) throw new Error("File is to large to be a firmware file");

    if (data.length > this._FLASH_SIZE) throw new Error("File runs into bootloader area ");

    this._firmware = {
      data,
      firmware_version,
    };

    this.dispatch_ui_change();
  }

  override async read() {
    this.dispatch_progress(0);

    await serial.begin({ baudRate: this._baudRate });
    await serial.clear();

    this.dispatch_progress(0.3);

    const bootloader_version = await this._read_bootloader_version();

    this._bootloader_version = bootloader_version;
    this.dispatch_ui_change();

    this.dispatch_progress(1);
  }

  override async write() {
    this.dispatch_progress(0);

    const firmware = this._firmware;
    if (!firmware) throw new Error("Firmware not selected");

    const { data, firmware_version } = firmware;

    if (data.length > this._FLASH_SIZE) throw new Error("Firmware size is too large");

    this.dispatch_progress(0.03);

    await serial.begin({ baudRate: this._baudRate });
    await serial.clear();

    const bootloader_version = await this._read_bootloader_version();

    const bootloader_ver_str = trim_string(bootloader_version.toString("ascii"));
    let firmware_ver_str = trim_string(firmware_version.toString("ascii"));

    if (firmware_ver_str.length >= 2 && bootloader_ver_str.length >= 2) {
      if (firmware_ver_str[0] >= "0" && firmware_ver_str[0] <= "9") {
        if (firmware_ver_str[1] === "." && bootloader_ver_str[1] === ".") {
          if (firmware_ver_str[0] !== bootloader_ver_str[0]) {
            firmware_ver_str = "*" + firmware_ver_str.substring(1);
          }
        }
      }
    } else {
      firmware_ver_str = "*";
    }

    this.dispatch_progress(0.07);

    await this._send_firmware_message(Buffer.from(firmware_ver_str, "ascii"));

    this.dispatch_progress(0.1);

    for (let i = 0; i < data.length; i += this._FLASH_BLOCK_SIZE) {
      await this._write_flash(i, data);
      this.dispatch_progress(0.1 + 0.85 * (i / data.length));
    }

    await this._reboot();

    this.dispatch_progress(1);
  }
}
