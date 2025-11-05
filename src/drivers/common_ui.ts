import type { M } from "./mem";
import type { UI } from "./ui";

type _GetSetNumber = { get(): number; set(val: number): void };

export const UITab = {
  Channels: "Channels",
  Feedback: "Feedback",
  Scanning: "Scanning",
  VOX: "Voice Activation",
  Power: "Power Management",
  System: "System Settings",
};

export const common_ui = {
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

  channel_squelch: (ref_by_channel: (i: number) => M.LBCD): UI.Field.Channels["squelch_rx"] => ({
    options: ["Off", "CTCSS", "DCS"],
    get: (i) => {
      const ref = ref_by_channel(i);

      if (ref.raw.get(0) === 0xff) return { mode: "Off" };

      const tone = ref.get();

      if (tone >= 12_000) return { mode: "DCS", polarity: "I", code: tone - 12_000 };
      if (tone >= 8_000) return { mode: "DCS", polarity: "N", code: tone - 8_000 };

      return { mode: "CTCSS", freq: tone / 10 };
    },
    set: (i, val) => {
      const ref = ref_by_channel(i);

      if (val.mode === "Off") {
        ref.raw.set(0, 0xff);
        ref.raw.set(1, 0xff);
      } else if (val.mode === "CTCSS") {
        ref.set(val.freq * 10);
      } else if (val.mode === "DCS") {
        ref.set(val.code % 1_000);
        ref.setDigit(3, val.polarity === "I" ? 12 : 8);
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

  scan: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "scan",
    name: "Scan",
    description: "Automatically checks channels for activity and stops on active ones.",
    tab: UITab.Scanning,
    get: () => ref.get(),
    set: (val) => ref.set(val ? 1 : 0),
  }),
  scan_mode: (ref: _GetSetNumber): UI.Field.Select => ({
    type: "select",
    id: "scan_mode",
    name: "Scan mode",
    description: "How the radio detects activity during scan.",
    tab: UITab.Scanning,
    options: ["Carrier", "Time"],
    short: true,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  alarm: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "alarm",
    name: "Alarm",
    description: "Loud, repeating alert tone to get attention.",
    tab: UITab.Feedback,
    get: () => ref.get(),
    set: (val) => ref.set(val ? 1 : 0),
  }),

  beep: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "beep",
    name: "Beep",
    description: "Short audible tone when pressing buttons.",
    tab: UITab.Feedback,
    get: () => ref.get(),
    set: (val) => ref.set(val ? 1 : 0),
  }),
  voice_prompt: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "voice_prompt",
    name: "Voice prompt",
    description: "Plays spoken confirmation when changing channels or pressing buttons.",
    tab: UITab.Feedback,
    get: () => ref.get(),
    set: (val) => ref.set(val ? 1 : 0),
  }),
  voice_language: (ref: _GetSetNumber, config: { languages: string[] }): UI.Field.Select => ({
    type: "select",
    id: "lang",
    name: "Voice language",
    description: "Language used for voice prompts.",
    tab: UITab.Feedback,
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
  pow_tot: (ref: _GetSetNumber): UI.Field.Select => ({
    type: "select",
    id: "tot",
    name: "Timeout timer",
    description: "Limits continuous transmit time to prevent overheating or PTT stuck.",
    tab: UITab.Power,
    options: [
      "Off",
      "30 seconds",
      "60 seconds",
      "90 seconds",
      "120 seconds",
      "150 seconds",
      "180 seconds",
      "210 seconds",
      "240 seconds",
      "270 seconds",
      "300 seconds",
    ],
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  fm: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "fm",
    name: "FM function",
    description: "Enables listening to commercial FM broadcast radio.",
    tab: UITab.System,
    get: () => ref.get(),
    set: (val) => ref.set(val ? 1 : 0),
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
  key_side_fn: (ref: _GetSetNumber, config: { functions: string[] }): UI.Field.Select => ({
    type: "select",
    id: "key_fn",
    name: "Side key function",
    tab: UITab.System,
    options: config.functions,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),

  roger_beep: (ref: _GetSetNumber): UI.Field.Switcher => ({
    type: "switcher",
    id: "roger",
    name: "Roger beep",
    description: "A short audible tone sent at the end of a transmission to indicate the speaker has finished talking.",
    tab: UITab.System,
    get: () => ref.get(),
    set: (val) => ref.set(Number(val)),
  }),
};
