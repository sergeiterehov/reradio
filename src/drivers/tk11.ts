import { Buffer } from "buffer";
import { QuanshengBaseRadio } from "./quansheng";
import type { UI } from "@/utils/ui";
import type { RadioInfo } from "./radio";
import { array_of, create_mem_mapper, type M } from "@/utils/mem";
import { common_ui } from "@/utils/common_ui";
import { t } from "i18next";
import { CTCSS_TONES, DCS_CODES, trim_string } from "@/utils/radio";

const PESSIMISTIC_SYNC = false;

const MAX_CHUNK_SIZE = 0x200;
const MEMORY_LIMIT = 0x23000;

const BANDS = [
  [150_000, 1_800_000],
  [1_800_000, 18_000_000],
  [18_000_000, 32_000_000],
  [32_000_000, 76_000_000],
  [108_000_000, 136_000_000],
  [136_000_000, 174_000_000],
  [174_000_000, 350_000_000],
  [350_000_000, 400_000_000],
  [400_000_000, 470_000_000],
  [470_000_000, 580_000_000],
  [580_000_000, 760_000_000],
  [760_000_000, 1_000_000_000],
  [1_000_000_000, 1_160_000_000],
];

const MODE_FM = 0;
const MODE_AM = 1;
const MODE_LSB = 2;
const MODE_USB = 3;
const MODE_CW = 4;

const TONE_NONE = 0;
const TONE_CTCSS = 1;
const TONE_NDCS = 2;
const TONE_IDCS = 3;

const POWER_LEVELS = [1, 5, 10];
const POWER_LEVEL_NAMES = [t("power_low"), t("power_mid"), t("power_high")];

const KEY_FUNCTIONS = [
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

export class TK11Radio extends QuanshengBaseRadio {
  static Info: RadioInfo = {
    vendor: "Quansheng",
    model: "TK11",
  };

  protected readonly _REBOOT_CMD: Buffer = Buffer.from([0xdd, 0x05]);

  protected readonly _HELLO_CMD: Buffer = Buffer.from([0xf4, 0x01]);
  protected readonly _HELLO_CONFIG_ACK: Buffer = Buffer.from([0xf5, 0x01]);

  protected readonly _READ_CMD: Buffer = Buffer.from([0xfb, 0x01]);
  protected readonly _READ_ACK: Buffer = Buffer.from([0xfc, 0x01]);

  protected readonly _WRITE_CMD: Buffer = Buffer.from([0xfd, 0x01]);
  protected readonly _WRITE_ACK: Buffer = Buffer.from([0xfe, 0x01]);

  protected readonly _SESSION_ID: Buffer = Buffer.from([0x40, 0x67, 0x5a, 0x5a]);

  protected readonly _ADDRESS_OFFSET = 0x080000;

  protected _img?: Buffer;
  protected _mem?: ReturnType<typeof this._parse>;

  protected _parse(img: Buffer) {
    const m = create_mem_mapper(img, this.dispatch_ui);

    return {
      ...m.seek(0x00000).skip(0, {}),

      channels: array_of(999, () =>
        m.struct(() => ({
          rx_freq: m.u32(),
          freq_diff: m.u32(),
          tx_non_standard_1: m.u8(),
          tx_non_standard_2: m.u8(),
          rx_qt_type: m.u8(),
          tx_qt_type: m.u8(),
          freq_dir: m.u8(),
          ...m.bitmap({ msw: 4, band: 4 }),
          step: m.u8(),
          encrypt: m.u8(),
          power: m.u8(),
          busy: m.u8(),
          reverse: m.u8(),
          dtmf_decode_flag: m.u8(),
          ptt_id: m.u8(),
          mode: m.u8(),
          scan_list: m.u8(),
          sq: m.u8(),
          name: m.str(16),
          rx_qt: m.u32(),
          tx_qt: m.u32(),
          unknown: m.u8_array(8),
          tx_qt2: m.u32(),
          signal: m.u8(),
          unknown_2: m.u8_array(3),
        }))
      ),

      ...m.seek(0x11000).skip(0, {}),

      channels_usage: array_of(1011, () =>
        m.struct(() => ({
          flag: m.u8(),
        }))
      ),

      ...m.seek(0x12000).skip(0, {}),

      fm: m.struct(() => ({
        vfo_frequency: m.u16(),
        channel_id: m.u8(),
        memory_vfo_flag: m.u8(),
        unknown: m.u8_array(4),
        frequencies: array_of(32, () => m.u16()),
      })),

      ...m.seek(0x13000).skip(0, {}),

      general: m.struct(() => ({
        channel_ab: m.u8(),
        noaa_sq: m.u8(),
        tx_tot: m.u8(),
        noaa_scan: m.u8(),
        keylock: m.u8(),
        vox_sw: m.u8(),
        vox_lvl: m.u8(),
        mic: m.u8(),
        freq_mode: m.u8(),
        channel_display_mode: m.u8(),
        mw_sw_agc: m.u8(),
        power_save: m.u8(),
        dual_watch: m.u8(),
        backlight: m.u8(),
        call_ch: m.u16(),
        beep: m.u8(),
        key_short1: m.u8(),
        key_long1: m.u8(),
        key_short2: m.u8(),
        key_long2: m.u8(),
        scan_mode: m.u8(),
        auto_lock: m.u8(),
        power_on_screen_mode: m.u8(),
        alarm_mode: m.u8(),
        roger_tone: m.u8(),
        repeater_tail: m.u8(),
        tail_tone: m.u8(),
        denoise_sw: m.u8(),
        denoise_lvl: m.u8(),
        transpositional_sw: m.u8(),
        transpositional_lvl: m.u8(),
        chn_A_volume: m.u8(),
        chn_B_volume: m.u8(),
        key_tone_flag: m.u8(),
        language: m.u8(),
        noaa_same_decode: m.u8(),
        noaa_same_event: m.u8(),
        noaa_same_address: m.u8(),
        unknown: m.u8(),
        sbar: m.u8(),
        brightness: m.u8(),
        kill_code: m.u8(),
        dtmf_side_tone: m.u8(),
        dtmf_decode_rspn: m.u8(),
        match_tot: m.u8(),
        match_qt_mode: m.u8(),
        match_dcs_bit: m.u8(),
        match_threshold: m.u8(),
        unknown_2: m.u8(),
        cw_pitch_freq: m.u16(),
        unknown_3: m.u8_array(4),
        dtmf_separator: m.u16(),
        dtmf_group_code: m.u16(),
        dtmf_reset_time: m.u8(),
        dtmf_resv4: m.u8(),
        dtmf_carry_time: m.u16(),
        dtmf_first_code_time: m.u16(),
        dtmf_d_code_time: m.u16(),
        dtmf_continue_time: m.u16(),
        dtmf_interval_time: m.u16(),
        dtmf_id: m.u8_array(8),
        dtmf_up_code: m.u8_array(16),
        dtmf_down_code: m.u8_array(16),
        unknown_4: m.u8_array(16),
        tone5_separator: m.u16(),
        tone5_group_code: m.u16(),
        tone5_reset_time: m.u8(),
        tone5_resv4: m.u8(),
        tone5_carry_time: m.u16(),
        tone5_first_code_time: m.u16(),
        tone5_protocol: m.u8(),
        tone5_resv1: m.u8(),
        tone5_single_continue_time: m.u16(),
        tone5_single_interval_time: m.u16(),
        tone5_id: m.u8_array(8),
        tone5_up_code: m.u8_array(16),
        tone5_down_code: m.u8_array(16),
        tone5_user_freq: array_of(15, () => m.u16()),
        tone5_revs5: m.u8_array(2),
        logo_string1: m.str(16),
        logo_string2: m.str(16),
      })),

      ...m.seek(0x14000).skip(0, {}),

      general2: m.struct(() => ({
        unknown_5: m.u8_array(48),
        dtmf_kill: m.u8_array(8),
        dtmf_wakeup: m.u8_array(8),
        tone5_kill: m.u8_array(8),
        tone5_wakeup: m.u8_array(8),
        unknown_6: m.u8_array(16),
        device_name: m.str(16),
      })),

      ...m.seek(0x15000).skip(0, {}),

      channels_idx: m.struct(() => ({
        a_id: m.u16(),
        b_id: m.u16(),
        freq_a_id: m.u16(),
        freq_b_id: m.u16(),
        channel_a_id: m.u16(),
        channel_b_id: m.u16(),
        noaa_a_id: m.u16(),
        noaa_b_id: m.u16(),
      })),

      ...m.seek(0x16000).skip(0, {}),

      scan_list: array_of(32, () =>
        m.struct(() => ({
          name: m.str(16),
          prio_1: m.u16(),
          prio_2: m.u16(),
          unknown: m.u8_array(4),
          channels: array_of(48, () => m.u16()),
          unknown_2: m.u8_array(8),
        }))
      ),

      ...m.seek(0x1a000).skip(0, {}),

      dtmf_contacts: array_of(16, () =>
        m.struct(() => ({
          name: m.str(16),
          code_id: m.u8_array(8),
        }))
      ),

      ...m.seek(0x1a800).skip(0, {}),

      tone5_contacts: array_of(16, () =>
        m.struct(() => ({
          name: m.str(16),
          code_id: m.u8_array(8),
        }))
      ),

      ...m.seek(0x22000).skip(0, {}),

      noaa_decode_addresses: array_of(16, () =>
        m.struct(() => ({
          address: m.u8_array(8),
          info: m.u8_array(32),
        }))
      ),

      ...m.seek(0x22280).skip(0, {}),

      noaa_same_events_control: m.u8_array(128),
    };
  }

  override ui(): UI.Root {
    const mem = this._mem;
    if (!mem) return { fields: [] };

    const get_squelch_ui = (
      get_refs: (i: number) => { type_ref: M.U8; tone_ref: M.U32 }
    ): UI.Field.Channels["squelch_rx"] => ({
      options: ["Off", "CTCSS", "DCS"],
      tones: CTCSS_TONES,
      codes: DCS_CODES,
      get: (i) => {
        const { tone_ref, type_ref } = get_refs(i);
        const type = type_ref.get();
        const tone = tone_ref.get();

        if (type === TONE_NONE) return { mode: "Off" };

        if (type === TONE_CTCSS) return { mode: "CTCSS", freq: tone / 10 };

        if (type === TONE_NDCS || type === TONE_IDCS)
          return {
            mode: "DCS",
            polarity: type === TONE_NDCS ? "N" : "I",
            code: Number.parseInt(tone.toString(8), 10),
          };

        return { mode: "Off" };
      },
      set: (i, val) => {
        const { tone_ref, type_ref } = get_refs(i);

        if (val.mode === "Off") {
          type_ref.set(TONE_NONE);
          tone_ref.set(0);
        } else if (val.mode === "CTCSS") {
          type_ref.set(TONE_CTCSS);
          tone_ref.set(val.freq * 10);
        } else if (val.mode === "DCS") {
          type_ref.set(val.polarity === "I" ? TONE_IDCS : TONE_NDCS);
          tone_ref.set(Number.parseInt(val.code.toString(10), 8));
        }
      },
    });

    return {
      fields: [
        {
          ...common_ui.channels({ size: mem.channels.length }),
          channel: {
            get: (i) => trim_string(mem.channels[i].name.get()),
            set: (i, val) => mem.channels[i].name.set(val.substring(0, 16).padEnd(16, "\x00")),
          },
          empty: {
            get: (i) => mem.channels_usage[i].flag.get() === 0xff || mem.channels[i].rx_freq.get() === 0,
            delete: (i) => mem.channels_usage[i].flag.set(0xff),
            init: (i) => {
              mem.channels_usage[i].flag.set(8);
              const ch = mem.channels[i];
              ch.__raw.set(Array(ch.__raw.size).fill(0));
              ch.rx_freq.set(446_006_25);
              ch.mode.set(MODE_FM);
              ch.power.set(1);
              ch.name.set(`CH-${String(i + 1).padStart(3, "0")}`.padEnd(ch.name.raw.size, "\x00"));
            },
          },
          freq: {
            min: 1_000,
            get: (i) => mem.channels[i].rx_freq.get() * 10,
            set: (i, val) => {
              mem.channels[i].rx_freq.set(val / 10);
              mem.channels_usage[i].flag.set(BANDS.findIndex(([a, b]) => a <= val && val < b));
            },
          },
          offset: {
            get: (i) => {
              const dir = mem.channels[i].freq_dir.get();
              const sign = dir === 2 ? -1 : dir === 1 ? 1 : 0;
              return sign * mem.channels[i].freq_diff.get() * 10;
            },
            set: (i, val) => {
              mem.channels[i].freq_dir.set(val < 0 ? 2 : val > 0 ? 1 : 0);
              mem.channels[i].freq_diff.set(val / 10);
            },
          },
          mode: {
            // mode = 0 (12.5K), 0 (25K), 1, 2, ...
            options: ["NFM", "FM", "AM", "LSB", "USB", "CW"],
            get: (i) => {
              const ch = mem.channels[i];
              const mode = ch.mode.get();
              const band = ch.band.get();

              // band = 0 (FM 25K), 1 (FM 12.5K)
              if (mode === MODE_FM) return band === 1 ? 0 : 1;

              return mode + 1;
            },
            set: (i, val) => {
              const ch = mem.channels[i];

              if (val === 0) {
                ch.mode.set(MODE_FM);
                ch.band.set(1);
              } else {
                ch.mode.set(val - 1);
                ch.band.set(0);
              }
            },
          },
          squelch_rx: get_squelch_ui((i) => ({
            type_ref: mem.channels[i].rx_qt_type,
            tone_ref: mem.channels[i].rx_qt,
          })),
          squelch_tx: get_squelch_ui((i) => ({
            type_ref: mem.channels[i].tx_qt_type,
            tone_ref: mem.channels[i].tx_qt,
          })),
          power: {
            options: POWER_LEVELS,
            name: (val) => POWER_LEVEL_NAMES[val],
            get: (i) => mem.channels[i].power.get(),
            set: (i, val) => mem.channels[i].power.set(val),
          },
          ptt_id: {
            on_options: ["Off", "Begin", "End", "BeginAndEnd"],
            id_options: [],
            get: (i) => ({ id: 0, on: mem.channels[i].ptt_id.get() }),
            set: (i, val) => mem.channels[i].ptt_id.set(val.on),
          },
          bcl: {
            get: (i) => mem.channels[i].busy.get() !== 0,
            set: (i, val) => mem.channels[i].busy.set(val ? 1 : 0),
          },
        } as UI.Field.Channels,

        common_ui.beep(mem.general.beep),
        common_ui.voice_prompt(mem.general.key_tone_flag),
        common_ui.channel_display_mode(mem.general.channel_display_mode, {
          options: [t("frequency"), "ID", t("name")],
        }),
        common_ui.hello_mode(mem.general.power_on_screen_mode, {
          options: ["Fullscreen", t("hello_text"), t("hello_voltage"), t("hello_picture"), t("hello_blank")],
        }),
        common_ui.device_name(mem.general2.device_name, { pad: "\x00" }),
        common_ui.hello_msg_str_x(mem.general.logo_string1, { line: 0, pad: "\x00" }),
        common_ui.hello_msg_str_x(mem.general.logo_string2, { line: 1, pad: "\x00" }),

        common_ui.keypad_lock_auto(mem.general.auto_lock),
        common_ui.key_side_short_x_fn(mem.general.key_short1, { key: "1", functions: KEY_FUNCTIONS }),
        common_ui.key_side_long_x_fn(mem.general.key_long1, { key: "1", functions: KEY_FUNCTIONS }),
        common_ui.key_side_short_x_fn(mem.general.key_short2, { key: "2", functions: KEY_FUNCTIONS }),
        common_ui.key_side_long_x_fn(mem.general.key_long2, { key: "2", functions: KEY_FUNCTIONS }),

        common_ui.pow_battery_save_ratio(mem.general.power_save),
        common_ui.backlight_timeout(mem.general.backlight, {
          min: 0,
          max: 11,
          seconds: [0, 1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 999],
          names: { [11]: t("always_on") },
        }),
        common_ui.backlight_brightness(mem.general.brightness, { min: 8, max: 200 }),
        common_ui.pow_tot(mem.general.tx_tot, { from: 0, to: 10 * 60, step: 60 }),

        common_ui.vox_sens(
          {
            get: () => (mem.general.vox_sw.get() ? mem.general.vox_lvl.get() : 0),
            set: (val) => {
              mem.general.vox_sw.set(val > 0 ? 1 : 0);
              mem.general.vox_lvl.set(val);
            },
          },
          { max: 9 }
        ),

        common_ui.scan_mode(mem.general.scan_mode, { options: [t("scan_time"), t("scan_carrier"), t("scan_search")] }),

        common_ui.roger_beep_select(mem.general.roger_tone, {
          options: [t("off"), t("roger_beep"), t("roger_beep_mdc"), "User 1", "User 2", "User 3", "User 4", "User 5"],
        }),
        common_ui.alarm_mode(mem.general.alarm_mode, { options: [t("alarm_site"), t("alarm_tone")] }),
        common_ui.rtone(mem.general.repeater_tail, {
          frequencies: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
        }),
        common_ui.cw_pitch_freq(mem.general.cw_pitch_freq, { min: 400, max: 1500, step: 10 }),
        common_ui.denoise_level(
          {
            get: () => (mem.general.denoise_sw.get() ? mem.general.denoise_lvl.get() : 0),
            set: (val) => {
              mem.general.denoise_sw.set(val > 0 ? 1 : 0);
              mem.general.denoise_lvl.set(val);
            },
          },
          { min: 0, max: 6 }
        ),
        common_ui.mic_gain(mem.general.mic, { min: 0, max: 4 }),
        common_ui.channel_x_volume_options(mem.general.chn_A_volume, { x: "A", percents: [0, 33, 66, 100] }),
        common_ui.channel_x_volume_options(mem.general.chn_B_volume, { x: "B", percents: [0, 33, 66, 100] }),

        common_ui.dual_watch(mem.general.dual_watch),
      ],
    };
  }

  protected async _read_block(addr: number, size: number) {
    const cmd = Buffer.alloc(2 + 2 + 2 + 2 + 2 + 2 + 4);
    this._READ_CMD.copy(cmd, 0);
    cmd.writeUInt16LE(12, 2);
    cmd.writeUInt32LE(this._ADDRESS_OFFSET + addr, 4);
    cmd.writeUInt16LE(size, 8);
    cmd.writeUInt16LE(0, 10);
    this._SESSION_ID.copy(cmd, 12);

    await this._send_buf(cmd);
    const res = await this._recv_buf();

    const ack = res.slice(0, this._READ_ACK.length);
    if (!this._READ_ACK.equals(ack)) throw new Error("Unexpected ACK");

    if (res.readUInt16LE(8) !== size) throw new Error("Unexpected length confirmation");

    const data = res.slice(12, 12 + size);

    return data;
  }

  protected async _write_block(addr: number, data: Buffer) {
    const cmd = Buffer.alloc(2 + 2 + 4 + 2 + 1 + 1 + 4 + data.length);
    this._WRITE_CMD.copy(cmd, 0);
    cmd.writeUInt16LE(12, 2);
    cmd.writeUInt32LE(this._ADDRESS_OFFSET + addr, 4);
    cmd.writeUInt16LE(data.length, 8);
    cmd.writeUInt8(0, 10);
    cmd.writeUInt8(0, 11);
    this._SESSION_ID.copy(cmd, 12);
    data.copy(cmd, 16);

    await this._send_buf(cmd);
    const res = await this._recv_buf();

    const ack = res.slice(0, this._WRITE_ACK.length);
    if (!this._WRITE_ACK.equals(ack)) throw new Error("Unexpected ACK");

    if (res.readUInt32LE(4) !== this._ADDRESS_OFFSET + addr) throw new Error("Unexpected addr confirmation");
  }

  private async _optimistic_sync(
    mem: NonNullable<typeof this._mem>,
    sync: (addr: number, size: number, preflight: boolean) => Promise<void>
  ) {
    const ranges = [
      [mem.fm.__raw.addr, mem.fm.__raw.size, 1],
      [mem.general.__raw.addr, mem.general.__raw.size, 1],
      [mem.general2.__raw.addr, mem.general2.__raw.size, 1],
      [mem.channels_idx.__raw.addr, mem.channels_idx.__raw.size, 1],
      [mem.scan_list[0].__raw.addr, mem.scan_list[0].__raw.size, mem.scan_list.length],
      [mem.dtmf_contacts[0].__raw.addr, mem.dtmf_contacts[0].__raw.size, mem.dtmf_contacts.length],
      [mem.tone5_contacts[0].__raw.addr, mem.tone5_contacts[0].__raw.size, mem.tone5_contacts.length],
      [
        mem.noaa_decode_addresses[0].__raw.addr,
        mem.noaa_decode_addresses[0].__raw.size,
        mem.noaa_decode_addresses.length,
      ],
      [mem.noaa_same_events_control.addr, mem.noaa_same_events_control.size, 1],
    ];

    const USAGE_ADDR_START = mem.channels_usage[0].__raw.addr;
    const USAGE_ADDR_END = USAGE_ADDR_START + mem.channels_usage[0].__raw.size * mem.channels_usage.length;

    for (let i = USAGE_ADDR_START; i < USAGE_ADDR_END; i += MAX_CHUNK_SIZE) {
      await sync(i, MAX_CHUNK_SIZE, true);
    }

    const CHANNEL_SIZE = mem.channels[0].__raw.size;
    for (let index = 0; index < mem.channels.length; index += 1) {
      const flag = mem.channels_usage[index].flag.get();
      if (flag === 0xff) continue;

      const addr = mem.channels[index].__raw.addr;
      await sync(addr, CHANNEL_SIZE, false);
    }

    for (const [start, size, count] of ranges) {
      for (let i = start; i < start + size * count; i += size) {
        await sync(i, size, false);
      }
    }
  }

  override async load(snapshot: Buffer) {
    const mem = this._parse(snapshot);

    this._img = snapshot;
    this._mem = mem;
    this.dispatch_ui_change();
  }

  override async read() {
    this.dispatch_progress(0);

    this._mem = undefined;
    this._img = undefined;
    this.dispatch_ui_change();

    await this._serial_clear({ timeout: 1_000 });

    const info = await this._hello();

    console.log(info);

    this.dispatch_progress(0.05);

    const img = Buffer.alloc(MEMORY_LIMIT);
    const mem = this._parse(img);

    if (PESSIMISTIC_SYNC) {
      for (let i = 0; i < MEMORY_LIMIT; i += MAX_CHUNK_SIZE) {
        const chunk = await this._read_block(i, MAX_CHUNK_SIZE);
        chunk.copy(img, i);

        this.dispatch_progress(0.1 + 0.8 * (i / MEMORY_LIMIT));
      }
    } else {
      await this._optimistic_sync(mem, async (addr, size, preflight) => {
        const chunk = await this._read_block(addr, size);
        chunk.copy(img, addr);

        this.dispatch_progress(preflight ? 0.1 : 0.1 + 0.9 * (addr / MEMORY_LIMIT));
      });
    }

    this.dispatch_progress(1);

    this._img = img;
    this._mem = mem;
    this.dispatch_ui_change();
  }

  override async write() {
    const img = this._img;
    if (!img) throw new Error("No image");

    const mem = this._mem;
    if (!mem) throw new Error("No memory map");

    this.dispatch_progress(0);

    await this._serial_clear({ timeout: 1_000 });

    const info = await this._hello();

    console.log(info);

    this.dispatch_progress(0.05);

    if (PESSIMISTIC_SYNC) {
      for (let i = 0; i < MEMORY_LIMIT; i += MAX_CHUNK_SIZE) {
        const block = img.slice(i, i + MAX_CHUNK_SIZE);
        await this._write_block(i, block);

        this.dispatch_progress(0.1 + 0.85 * (i / MEMORY_LIMIT));
      }
    } else {
      await this._optimistic_sync(mem, async (addr, size, preflight) => {
        const block = img.slice(addr, addr + size);
        await this._write_block(addr, block);

        this.dispatch_progress(preflight ? 0.1 : 0.1 + 0.85 * (addr / MEMORY_LIMIT));
      });
    }

    await this._reboot();

    this.dispatch_progress(1);
  }
}
