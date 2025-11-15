import { Buffer } from "buffer";
import type { RadioInfo } from "./radio";
import { common_ui } from "./common_ui";
import { create_mem_mapper, array_of } from "./mem";
import { BaseT18ProtocolRadio } from "./radtel_t18";
import type { UI } from "./ui";
import { t } from "i18next";

export class BFC50Radio extends BaseT18ProtocolRadio {
  static Info: RadioInfo = {
    vendor: "Baofeng",
    model: "BF-C50",
  };

  protected _magic = Buffer.from("PROGRAL", "ascii");
  protected _fingerprint = [Buffer.from("P3107\xF7", "ascii")];
  protected _memSize = 0x0645;
  protected _blockSize = 0x10;
  protected CMD_EXIT = Buffer.from("E", "ascii");

  protected _mem?: ReturnType<typeof this._parse>;

  protected _parse(data: Buffer) {
    const m = create_mem_mapper(data, this.dispatch_ui);

    return {
      _m: m,

      ...m.seek(0x0000).skip(0, {}),
      memory: array_of(16, () => ({
        rxfreq: m.lbcd(4),
        txfreq: m.lbcd(4),
        rxtone: m.lbcd(2),
        txtone: m.lbcd(2),
        ...m.bitmap({
          jumpcode: 1,
          _1: 2,
          skip: 1,
          highpower: 1,
          narrow: 1,
          _2: 1,
          bcl: 1,
        }),
        ...m.skip(3, {}),
      })),

      ...m.seek(0x0630).skip(0, {}),
      ...m.bitmap({ _: 7, voice: 1 }),
      ...m.bitmap({ _: 7, language: 1 }),
      ...m.bitmap({ _: 7, scan: 1 }),
      ...m.bitmap({ _: 7, vox: 1 }),
      ...m.bitmap({ _: 5, vox_level: 3 }),
      ...m.skip(1, {}),
      ...m.bitmap({ _: 7, lovoltnotx: 1 }),
      ...m.bitmap({ _: 7, hivoltnotx: 1 }),

      ...m.seek(0x0640).skip(0, {}),
      ...m.bitmap({ channel: 4, _: 1, batterysaver: 1, beep: 1 }),
      squelchlevel: m.u8(),
      ...m.bitmap({ _: 7, alarm: 1 }),
      ...m.skip(1, {}),
      ...m.bitmap({ timeouttimer: 7, tail: 1 }),
    };
  }

  ui(): UI.Root {
    const mem = this._mem;

    if (!mem) return { fields: [] };

    const { memory } = mem;

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
            get: (i) => memory[i].narrow.get(),
            set: (i, val) => memory[i].narrow.set(val),
          },
          squelch_rx: common_ui.channel_squelch_lbcd((i) => memory[i].rxtone),
          squelch_tx: common_ui.channel_squelch_lbcd((i) => memory[i].txtone),
          power: {
            options: [3, 5],
            name: (val) => [t("power_low"), t("power_high")][val] || "?",
            get: (i) => memory[i].highpower.get(),
            set: (i, val) => memory[i].highpower.set(val),
          },
          scan: {
            options: [t("on"), t("off")],
            get: (i) => memory[i].skip.get(),
            set: (i, val) => memory[i].skip.set(val),
          },
          bcl: {
            get: (i) => memory[i].bcl.get() !== 0,
            set: (i, val) => memory[i].bcl.set(val ? 1 : 0),
          },
        },
        common_ui.beep(mem.beep),
        common_ui.alarm(mem.alarm),
        common_ui.pow_battery_save(mem.batterysaver),
        common_ui.voice_prompt(mem.voice),
        common_ui.voice_language(mem.language, { languages: [t("lang_en"), t("lang_ch")] }),
        common_ui.vox(mem.vox),
        common_ui.vox_level(mem.vox_level, { min: 0, max: 9 }),
        common_ui.scan(mem.scan),
        common_ui.sql(mem.squelchlevel, { min: 0, max: 9 }),
        common_ui.pow_low_no_tx(mem.lovoltnotx),
        common_ui.pow_high_no_tx(mem.hivoltnotx),
      ],
    };
  }
}
