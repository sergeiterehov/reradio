import { t } from "i18next";
import type { M } from "./mem";
import type { UI } from "./ui";
import { DCS_CODES, trim_string } from "./radio";

type _GetSetNumber = { get(): number; set(val: number): void };

export const UITab = {
  Misc: t("uitab_misc"),
  Channels: t("uitab_channels"),
  Interface: t("uitab_interface"),
  Scanning: t("uitab_scanning"),
  VOX: t("uitab_vox"),
  Power: t("uitab_power"),
  System: t("uitab_system"),
  Control: t("uitab_control"),
  Exchange: t("uitab_exchange"),
  DTMF: t("uitab_dtmf"),
  Unlock: t("uitab_unlock"),
  Firmware: t("uitab_firmware"),
};

export const modify_field = <F extends UI.Field.Any, R extends UI.Field.Any>(field: F, modifier: (field: F) => R): R =>
  modifier(field);

export const common_ui = {
  none: (): UI.Field.None => ({
    type: "none",
    id: "none",
    name: "None",
  }),

  channels: (config: { size: number }): UI.Field.Channels => ({
    type: "channels",
    id: "channels",
    name: "Channels",
    tab: UITab.Channels,
    size: config.size,
    channel: { get: (i) => `CH${i + 1}` },
  }),

  channel_squelch_lbcd: (ref_by_channel: (i: number) => M.LBCD): UI.Field.Channels["squelch_rx"] => ({
    options: ["Off", "CTCSS", "DCS"],
    get: (i) => {
      const ref = ref_by_channel(i);

      if (ref.raw.get()[0] === 0xff) return { mode: "Off" };

      const tone = ref.get();

      if (tone >= 12_000) return { mode: "DCS", polarity: "I", code: tone - 12_000 };
      if (tone >= 8_000) return { mode: "DCS", polarity: "N", code: tone - 8_000 };

      return { mode: "CTCSS", freq: tone / 10 };
    },
    set: (i, val) => {
      const ref = ref_by_channel(i);

      if (val.mode === "Off") {
        ref.raw.set([0xff, 0xff]);
      } else if (val.mode === "CTCSS") {
        ref.set(val.freq * 10);
      } else if (val.mode === "DCS") {
        ref.set(val.code % 1_000);
        ref.setDigit(3, val.polarity === "I" ? 12 : 8);
      }
    },
  }),

  channel_squelch_u16: (
    ref_by_channel: (i: number) => M.U16,
    codes: number[] = DCS_CODES
  ): UI.Field.Channels["squelch_rx"] => ({
    options: ["Off", "CTCSS", "DCS"],
    codes,
    get: (i) => {
      const ref = ref_by_channel(i);
      const tone = ref.get();

      if (tone === 0x00 || tone === 0xffff) return { mode: "Off" };

      if (tone <= 0x0258) {
        if (tone > 0x69) return { mode: "DCS", polarity: "I", code: codes[tone - 0x6a] };

        return { mode: "DCS", polarity: "N", code: codes[tone - 1] };
      }

      return { mode: "CTCSS", freq: tone / 10 };
    },
    set: (i, val) => {
      const ref = ref_by_channel(i);

      if (val.mode === "Off") {
        ref.set(0);
      } else if (val.mode === "CTCSS") {
        ref.set(Math.max(0x0259, val.freq * 10));
      } else if (val.mode === "DCS") {
        ref.set(codes.indexOf(val.code) + 1 + (val.polarity === "I" ? 0x69 : 0));
      }
    },
  }),

  vox: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "vox",
    name: t("vox"),
    description: t("vox_tooltip"),
    tab: UITab.VOX,
    get: () => Boolean(ref.get()),
    set: (val) => ref.set(val ? 1 : 0),
  }),
  vox_inhibit: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "vox_inhibit",
    name: t("vox_inhibit"),
    description: t("vox_inhibit_tooltip"),
    tab: UITab.VOX,
    get: () => Boolean(ref.get()),
    set: (val) => ref.set(val ? 1 : 0),
  }),
  vox_level: (ref: _GetSetNumber, config: { min: number; max: number }): UI.Field.Slider => ({
    type: "slider",
    id: "vox_level",
    name: t("vox_level"),
    description: t("vox_level_tooltip"),
    tab: UITab.VOX,
    min: config.min,
    max: config.max,
    label: (val) => String(val + 1),
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),
  vox_sens: (ref: _GetSetNumber, config: { max: number }): UI.Field.Slider => ({
    ...common_ui.vox_level(ref, { ...config, min: 0 }),
    id: "vox_sens",
    name: t("vox_sens"),
    label: (val) => (val ? String(val) : t("off")),
  }),

  denoise_level: (ref: _GetSetNumber, config: { min: number; max: number }): UI.Field.Slider => ({
    type: "slider",
    id: "denoise_level",
    name: t("denoise_level"),
    description: t("denoise_level_tooltip"),
    tab: UITab.Exchange,
    min: config.min,
    max: config.max,
    label: (val) => (val === 0 ? t("off") : String(val)),
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  channel_x_volume_options: (
    ref: _GetSetNumber,
    config: { x: "A" | "B" | "C" | "D"; percents: number[] }
  ): UI.Field.Slider => ({
    type: "slider",
    id: `channel_volume_${config.x}`,
    name: t("channel_volume_x", { replace: { x: config.x } }),
    description: config.x === "A" ? t("channel_volume_tooltip") : undefined,
    tab: UITab.Exchange,
    min: 0,
    max: config.percents.length - 1,
    label: (val) => `${config.percents[val]}%`,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  channel_display_mode: (ref: _GetSetNumber, config: { options: string[] }): UI.Field.Select => ({
    type: "select",
    id: "channel_display_mode",
    name: t("channel_display_mode"),
    description: t("channel_display_mode_tooltip"),
    tab: UITab.Interface,
    options: config.options,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  scan: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "scan",
    name: t("scan"),
    description: t("scan_tooltip"),
    tab: UITab.Scanning,
    get: () => Boolean(ref.get()),
    set: (val) => ref.set(val ? 1 : 0),
  }),
  scan_mode: (ref: _GetSetNumber, config: { options: string[] }): UI.Field.Select => ({
    type: "select",
    id: "scan_mode",
    name: t("scan_mode"),
    description: t("scan_mode_tooltip"),
    tab: UITab.Scanning,
    options: config.options,
    short: true,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  alarm: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "alarm",
    name: t("alarm"),
    description: t("alarm_tooltip"),
    tab: UITab.Control,
    get: () => Boolean(ref.get()),
    set: (val) => ref.set(val ? 1 : 0),
  }),

  alarm_mode: (ref: _GetSetNumber, config: { options: string[] }): UI.Field.Select => ({
    type: "select",
    id: "alarm_mode",
    name: t("alarm_mode"),
    description: t("alarm_tooltip"),
    tab: UITab.Exchange,
    options: config.options,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  cw_pitch_freq: (ref: _GetSetNumber, config: { min: number; max: number; step: number }): UI.Field.Slider => ({
    type: "slider",
    id: "cw_pitch_freq",
    name: t("cw_pitch_freq"),
    description: t("cw_pitch_freq_tooltip"),
    tab: UITab.Exchange,
    min: config.min,
    max: config.max,
    label: (val) => `${val} ${t("hz")}`,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  beep: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "beep",
    name: t("beep"),
    description: t("beep_tooltip"),
    tab: UITab.Interface,
    get: () => Boolean(ref.get()),
    set: (val) => ref.set(val ? 1 : 0),
  }),
  voice_prompt: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "voice_prompt",
    name: t("voice_prompt"),
    description: t("voice_prompt_tooltip"),
    tab: UITab.Interface,
    get: () => Boolean(ref.get()),
    set: (val) => ref.set(val ? 1 : 0),
  }),
  voice_language: (ref: _GetSetNumber, config: { languages: string[] }): UI.Field.Select => ({
    type: "select",
    id: "voice_lang",
    name: t("voice_language"),
    description: t("voice_language_tooltip"),
    tab: UITab.Interface,
    options: config.languages,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),
  language: (ref: _GetSetNumber, config: { languages: string[] }): UI.Field.Select => ({
    type: "select",
    id: "lang",
    name: t("language"),
    description: t("language_tooltip"),
    tab: UITab.Interface,
    options: config.languages,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  pow_battery_save: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "bat_save",
    name: t("bat_save"),
    description: t("bat_save_tooltip"),
    tab: UITab.Power,
    get: () => Boolean(ref.get()),
    set: (val) => ref.set(val ? 1 : 0),
  }),
  pow_battery_save_ratio: (ref: _GetSetNumber): UI.Field.Select => ({
    type: "select",
    id: "bat_save_ratio",
    name: t("bat_save"),
    description: t("bat_save_ratio_tooltip"),
    tab: UITab.Power,
    options: [t("off"), "1:1", "1:2", "1:3", "1:4"],
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),
  pow_low_no_tx: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "low_no_tx",
    name: t("low_no_tx"),
    description: t("low_no_tx_tooltip"),
    tab: UITab.Power,
    get: () => Boolean(ref.get()),
    set: (val) => ref.set(val ? 1 : 0),
  }),
  pow_high_no_tx: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "hight_no_tx",
    name: t("high_no_tx"),
    description: t("high_no_tx_tooltip"),
    tab: UITab.Power,
    get: () => Boolean(ref.get()),
    set: (val) => ref.set(val ? 1 : 0),
  }),
  pow_tot: (ref: _GetSetNumber, config: { from: number; to: number; step: number }): UI.Field.Slider => ({
    type: "slider",
    id: "tot",
    name: t("tot"),
    description: t("tot_tooltip"),
    tab: UITab.Power,
    min: 0,
    max: (config.to - config.from) / config.step,
    label: (val) => (val ? `${config.from + val * config.step} sec` : "Off"),
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  fm: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "fm",
    name: t("fm"),
    description: t("fm_tooltip"),
    tab: UITab.System,
    get: () => Boolean(ref.get()),
    set: (val) => ref.set(val ? 1 : 0),
  }),

  rtone: (ref: _GetSetNumber, config: { frequencies: number[] }): UI.Field.Select => ({
    type: "select",
    id: "rtone",
    name: t("rtone"),
    description: t("rtone_tooltip"),
    tab: UITab.System,
    options: config.frequencies.map((f) => (f === 0 ? t("off") : `${f} ${t("hz")}`)),
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  sql: (ref: _GetSetNumber, config: { min: number; max: number }): UI.Field.Slider => ({
    type: "slider",
    id: "sql",
    name: t("sql"),
    description: t("sql_tooltip"),
    tab: UITab.System,
    min: config.min,
    max: config.max,
    label: (val) => String(val),
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),
  sql_ste: (ref: _GetSetNumber, config: { from: number; to: number; step: number }): UI.Field.Slider => ({
    type: "slider",
    id: "sql_ste",
    name: t("sql_ste"),
    description: t("sql_ste_tooltip"),
    tab: UITab.System,
    min: 0,
    max: (config.to - config.from) / config.step,
    label: (val) => (val ? `${config.from + val * config.step} ms` : "Off"),
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  key_side_fn: (ref: _GetSetNumber, config: { functions: string[] }): UI.Field.Select => ({
    type: "select",
    id: "side_key_fn",
    name: t("side_key_fn"),
    tab: UITab.Control,
    options: config.functions,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),
  key_side_short_x_fn: (ref: _GetSetNumber, config: { functions: string[]; key: string }): UI.Field.Select => ({
    type: "select",
    id: `key_side_short_${config.key}_fn`,
    name: t("key_side_short_x_fn", { replace: { key: config.key } }),
    tab: UITab.Control,
    options: config.functions,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),
  key_side_long_x_fn: (ref: _GetSetNumber, config: { functions: string[]; key: string }): UI.Field.Select => ({
    type: "select",
    id: `key_fn_long_${config.key}`,
    name: t("key_side_long_x_fn", { replace: { key: config.key } }),
    tab: UITab.Control,
    options: config.functions,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),
  keypad_lock_auto: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "keypad_lock_auto",
    name: t("keypad_lock_auto"),
    description: t("keypad_lock_auto_tooltip"),
    tab: UITab.Control,
    get: () => Boolean(ref.get()),
    set: (val) => ref.set(val ? 1 : 0),
  }),

  mic_gain: (ref: _GetSetNumber, config: { min: number; max: number }): UI.Field.Slider => ({
    type: "slider",
    id: "mic_gain",
    name: t("mic_gain"),
    description: t("mic_gain_tooltip"),
    tab: UITab.Exchange,
    min: config.min,
    max: config.max,
    label: (val) => String(val + 1),
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  roger_beep: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "roger_beep",
    name: t("roger_beep"),
    description: t("roger_beep_tooltip"),
    tab: UITab.Exchange,
    get: () => Boolean(ref.get()),
    set: (val) => ref.set(Number(val)),
  }),

  roger_beep_select: (ref: _GetSetNumber, config: { options: string[] }): UI.Field.Select => ({
    type: "select",
    id: "roger_beep_select",
    name: t("roger_beep_select"),
    description: t("roger_beep_select_tooltip"),
    tab: UITab.Exchange,
    options: config.options,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  bcl: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "bcl",
    name: t("bcl"),
    description: t("bcl_tooltip"),
    tab: UITab.Exchange,
    get: () => Boolean(ref.get()),
    set: (val) => ref.set(Number(val)),
  }),

  backlight_timeout: (
    ref: _GetSetNumber,
    config: { min: number; max: number; seconds?: number[]; names?: Record<number, string> }
  ): UI.Field.Slider => ({
    type: "slider",
    id: "backlight_timeout",
    name: t("backlight_timeout"),
    description: t("backlight_timeout_tooltip"),
    tab: UITab.Power,
    min: config.min,
    max: config.max,
    label: (rawVal) => {
      if (config.names && rawVal in config.names) return config.names[rawVal];

      const val = config.seconds?.[rawVal] ?? rawVal;
      return val ? t("seconds_value", { replace: { value: val } }) : t("off");
    },
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  backlight_brightness: (ref: _GetSetNumber, config: { min: number; max: number }): UI.Field.Slider => ({
    type: "slider",
    id: "backlight_brightness",
    name: t("backlight_brightness"),
    description: t("backlight_brightness_tooltip"),
    tab: UITab.Power,
    min: config.min,
    max: config.max,
    label: (val) => `${((100 * (val - config.min)) / (config.max - config.min)).toFixed(0)}%`,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  device_name: (ref: M.Str, config: { pad?: string }): UI.Field.Text => ({
    type: "text",
    id: "device_name",
    name: t("device_name"),
    description: t("device_name_tooltip"),
    tab: UITab.Interface,
    get: () => trim_string(ref.get()),
    set: (val) =>
      ref.set(
        String(val)
          .substring(0, ref.raw.size)
          .padEnd(ref.raw.size, config.pad || " ")
      ),
  }),

  hello_msg_str_x: (str_ref: M.Str, config: { line: number; pad?: string }): UI.Field.Text => ({
    type: "text",
    id: `hello_msg_str_${config.line}`,
    name: t("hello_msg_str_x", { replace: { line: config.line + 1 } }),
    description: config.line === 0 ? t("hello_msg_str_x_tooltip") : undefined,
    tab: UITab.Interface,
    get: () => trim_string(str_ref.get()),
    set: (val) =>
      str_ref.set(
        String(val)
          .substring(0, str_ref.raw.size)
          .padEnd(str_ref.raw.size, config.pad || " ")
      ),
  }),

  hello_mode: (ref: _GetSetNumber, config: { options: string[] }): UI.Field.Select => ({
    type: "select",
    id: "hello_mode",
    options: config.options,
    name: t("hello_mode"),
    tab: UITab.Interface,
    description: t("hello_mode_tooltip"),
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  dual_watch: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "dual_watch",
    name: t("dual_watch"),
    description: t("dual_watch_tooltip"),
    tab: UITab.System,
    get: () => Boolean(ref.get()),
    set: (val) => ref.set(val ? 1 : 0),
  }),

  dual_watch_priority_ab: (ref: _GetSetNumber): UI.Field.Select => ({
    type: "select",
    id: "dual_watch_priority_ab",
    name: t("dual_watch_priority_ab"),
    description: t("dual_watch_priority_ab_tooltip"),
    tab: UITab.System,
    short: true,
    options: ["Off", "A", "B"],
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  unlock_tx350: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "unlock_tx350",
    name: t("unlock_tx350"),
    tab: UITab.Unlock,
    description: t("unlock_tx350_tooltip"),
    get: () => Boolean(ref.get()),
    set: (val) => ref.set(Number(val)),
  }),
  unlock_en350: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "unlock_en350",
    name: t("unlock_en350"),
    tab: UITab.Unlock,
    description: t("unlock_en350_tooltip"),
    get: () => Boolean(ref.get()),
    set: (val) => ref.set(Number(val)),
  }),
  unlock_tx200: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "unlock_tx200",
    name: t("unlock_tx200"),
    tab: UITab.Unlock,
    description: t("unlock_tx200_tooltip"),
    get: () => Boolean(ref.get()),
    set: (val) => ref.set(Number(val)),
  }),
  unlock_tx500: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "unlock_tx500",
    name: t("unlock_tx500"),
    tab: UITab.Unlock,
    description: t("unlock_tx500_tooltip"),
    get: () => Boolean(ref.get()),
    set: (val) => ref.set(Number(val)),
  }),
  unlock_scramble: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "unlock_scramble",
    name: t("unlock_scramble"),
    tab: UITab.Unlock,
    description: t("unlock_scramble_tooltip"),
    get: () => Boolean(ref.get()),
    set: (val) => ref.set(Number(val)),
  }),
};
