import type { M } from "./mem";
import type { UI } from "./ui";
import { DCS_CODES, range } from "./utils";

type _GetSetNumber = { get(): number; set(val: number): void };

export const UITab = {
  Channels: "Channels",
  Interface: "Interface",
  Scanning: "Scanning",
  VOX: "Voice Activation",
  Power: "Power Management",
  System: "System Settings",
  Control: "Control",
  Exchange: "Exchange",
  DTMF: "DTMF",
};

export const modify_field = <F extends UI.Field.Any, R extends UI.Field.Any>(field: F, modifier: (field: F) => R): R =>
  modifier(field);

export const common_ui = {
  none: (): UI.Field.None => ({
    type: "none",
    id: "none",
    name: "None",
    get: () => null,
    set: () => null,
  }),

  channels: (config: { size: number }): UI.Field.Channels => ({
    type: "channels",
    id: "channels",
    name: "Channels",
    tab: UITab.Channels,
    size: config.size,
    channel: { get: (i) => `CH${i + 1}` },
    get: () => null,
    set: () => null,
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
    name: "VOX",
    description: "Voice-activated transmit: microphone turns on automatically when you speak (no PTT needed).",
    tab: UITab.VOX,
    get: () => ref.get(),
    set: (val) => ref.set(val ? 1 : 0),
  }),
  vox_inhibit: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "vox_inhibit",
    name: "Inhibit VOX on receive",
    description: "Disables VOX while receiving to prevent false activation from incoming audio.",
    tab: UITab.VOX,
    get: () => ref.get(),
    set: (val) => ref.set(val ? 1 : 0),
  }),
  vox_level: (ref: _GetSetNumber, config: { min: number; max: number }): UI.Field.Slider => ({
    type: "slider",
    id: "vox_level",
    name: "VOX level",
    description: "Voice activation sensitivity: lower values = easier to trigger transmit with your voice.",
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
    name: "VOX sensitivity",
    label: (val) => (val ? String(val) : "Off"),
  }),

  scan: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "scan",
    name: "Scan",
    description: "Automatically checks channels for activity and stops on active ones.",
    tab: UITab.Scanning,
    get: () => ref.get(),
    set: (val) => ref.set(val ? 1 : 0),
  }),
  scan_mode: (ref: _GetSetNumber, config: { options: string[] }): UI.Field.Select => ({
    type: "select",
    id: "scan_mode",
    name: "Scan mode",
    description: "Defines the scanning method used when searching for active signals across channels or frequencies.",
    tab: UITab.Scanning,
    options: config.options,
    short: true,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  alarm: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "alarm",
    name: "Alarm",
    description: "Loud, repeating alert tone to get attention.",
    tab: UITab.Control,
    get: () => ref.get(),
    set: (val) => ref.set(val ? 1 : 0),
  }),

  alarm_mode: (ref: _GetSetNumber, config: { options: string[] }): UI.Field.Select => ({
    type: "select",
    id: "alarm_mode",
    name: "Alarm mode",
    description: "Loud, repeating alert tone to get attention.",
    tab: UITab.Control,
    options: config.options,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  beep: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "beep",
    name: "Beep",
    description: "Short audible tone when pressing buttons.",
    tab: UITab.Interface,
    get: () => ref.get(),
    set: (val) => ref.set(val ? 1 : 0),
  }),
  voice_prompt: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "voice_prompt",
    name: "Voice prompt",
    description: "Plays spoken confirmation when changing channels or pressing buttons.",
    tab: UITab.Interface,
    get: () => ref.get(),
    set: (val) => ref.set(val ? 1 : 0),
  }),
  voice_language: (ref: _GetSetNumber, config: { languages: string[] }): UI.Field.Select => ({
    type: "select",
    id: "lang",
    name: "Voice language",
    description: "Language used for voice prompts.",
    tab: UITab.Interface,
    options: config.languages,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  pow_battery_save: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "bat_save",
    name: "Battery saver",
    description: "Reduces power consumption during standby by periodically turning off the receiver.",
    tab: UITab.Power,
    get: () => ref.get(),
    set: (val) => ref.set(val ? 1 : 0),
  }),
  pow_battery_save_ratio: (ref: _GetSetNumber): UI.Field.Select => ({
    type: "select",
    id: "bat_save_ratio",
    name: "Battery saver",
    description:
      "Controls how aggressively the radio reduces power consumption during receive mode by cycling the receiver on and off, trading slight responsiveness for extended battery life.",
    tab: UITab.Power,
    options: ["Off", "1:1", "1:2", "1:3", "1:4"],
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),
  pow_low_no_tx: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "low_no_tx",
    name: "Low voltage inhibit transmit",
    description: "Blocks transmission when battery voltage is too low (protects battery).",
    tab: UITab.Power,
    get: () => ref.get(),
    set: (val) => ref.set(val ? 1 : 0),
  }),
  pow_high_no_tx: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "hight_no_tx",
    name: "High voltage inhibit transmit",
    description: "Blocks transmission if battery voltage is abnormally high (rarely used).",
    tab: UITab.Power,
    get: () => ref.get(),
    set: (val) => ref.set(val ? 1 : 0),
  }),
  pow_tot: (ref: _GetSetNumber, config: { from: number; to: number; step: number }): UI.Field.Slider => ({
    type: "slider",
    id: "tot",
    name: "Timeout timer",
    description: "Limits continuous transmit time to prevent overheating or PTT stuck.",
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
    name: "FM Radio",
    description: "Enables listening to commercial FM broadcast radio.",
    tab: UITab.System,
    get: () => ref.get(),
    set: (val) => ref.set(val ? 1 : 0),
  }),

  rtone: (ref: _GetSetNumber, config: { frequencies: number[] }): UI.Field.Select => ({
    type: "select",
    id: "rtone",
    name: "Repeater Tone",
    tab: UITab.System,
    description:
      "Tone Burst Frequency. Sets the frequency of the short audio tone sent at the start of a transmission to activate certain older repeaters that require a specific tone burst for access.",
    options: config.frequencies.map((f) => `${f} Hz`),
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  sql: (ref: _GetSetNumber, config: { min: number; max: number }): UI.Field.Slider => ({
    type: "slider",
    id: "sql",
    name: "Squelch level",
    description: "Noise suppression threshold: higher = quieter background, but weak signals may be blocked.",
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
    name: "Squelch Tail Eliminator",
    description:
      "Introduces a short delay before the transmitter fully turns off, ensuring the repeater properly recognizes the end of transmission and resets correctly.",
    tab: UITab.System,
    min: 0,
    max: (config.to - config.from) / config.step,
    label: (val) => (val ? `${config.from + val * config.step} ms` : "Off"),
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  key_side_fn: (ref: _GetSetNumber, config: { functions: string[] }): UI.Field.Select => ({
    type: "select",
    id: "key_fn",
    name: "Side key function",
    tab: UITab.Control,
    options: config.functions,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),
  keypad_lock: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "keypad_lock",
    name: "Keypad auto-lock",
    description:
      "Prevents accidental changes to settings or unintended transmissions by disabling the keypad except for essential functions like PTT or emergency keys.",
    tab: UITab.Control,
    get: () => ref.get(),
    set: (val) => ref.set(val ? 1 : 0),
  }),

  roger_beep: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "roger",
    name: "Roger beep",
    description: "A short audible tone sent at the end of a transmission to indicate the speaker has finished talking.",
    tab: UITab.Exchange,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  roger_beep_select: (ref: _GetSetNumber, config: { options: string[] }): UI.Field.Select => ({
    type: "select",
    id: "roger_list",
    name: "Roger beep",
    description: "A short audible tone sent at the end of a transmission to indicate the speaker has finished talking.",
    tab: UITab.Exchange,
    options: config.options,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  bcl: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "bcl",
    name: "Busy channel lockout",
    description: "Prevents transmission when the channel is already in use, helping to avoid interference.",
    tab: UITab.Exchange,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  backlight_timeout: (ref: _GetSetNumber, config: { min: number; max: number }): UI.Field.Slider => ({
    type: "slider",
    id: "backlight_timeout",
    name: "Backlight Timeout",
    description:
      "Sets how long the display backlight remains on after the last user interaction before automatically turning off to save battery.",
    tab: UITab.Interface,
    min: config.min,
    max: config.max,
    label: (val) => (val ? `${val} sec` : "Off"),
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  hello_msg_str_x: (str_ref: M.Str, config: { line: number }): UI.Field.Text => ({
    type: "text",
    id: `poweron_msg_${config.line}`,
    name: `Hello text, line ${config.line}`,
    description: "Text displayed on the screen when the radio is turned on.",
    tab: UITab.Interface,
    get: () => str_ref.get(),
    set: (val) => str_ref.set(String(val).substring(0, str_ref.raw.size).padEnd(str_ref.raw.size, " ")),
  }),

  dw: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "dw",
    name: "Dual Watch",
    description:
      "Enables monitoring of two channels simultaneously, automatically switching to the active one when a signal is detected.",
    tab: UITab.System,
    get: () => ref.get(),
    set: (val) => ref.set(val ? 1 : 0),
  }),

  dw_priority_ab: (ref: _GetSetNumber): UI.Field.Select => ({
    type: "select",
    id: "dw_priority_ab",
    name: "Dual Watch Priority",
    description:
      "Specifies which receiver (A or B) remains active after a signal is received in dual-watch mode. When set to OFF, the receiver that last received a signal stays active; when set to A or B, the selected receiver always resumes after any transmission ends.",
    tab: UITab.System,
    short: true,
    options: ["Off", "A", "B"],
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),
};
