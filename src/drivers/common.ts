import type { M } from "./mem";
import type { UI } from "./ui";

export function ui_get_lbcd_squelch(getRef: (i: number) => M.LBCD): UI.Field.Channels["squelch_rx"] {
  return {
    options: ["Off", "CTCSS", "DCS"],
    get: (i) => {
      const ref = getRef(i);

      if (ref.raw.get(0) === 0xff) return { mode: "Off" };

      const tone = ref.get();

      if (tone >= 12_000) return { mode: "DCS", polarity: "I", code: tone - 12_000 };
      if (tone >= 8_000) return { mode: "DCS", polarity: "N", code: tone - 8_000 };

      return { mode: "CTCSS", freq: tone / 10 };
    },
    set: (i, val) => {
      const ref = getRef(i);

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
  };
}
