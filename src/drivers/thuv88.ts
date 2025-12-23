import type { UI } from "@/utils/ui";
import { Radio, type RadioInfo } from "./_radio";
import { serial } from "@/utils/serial";
import { Buffer } from "buffer";
import { create_mem_mapper, set_string, type M, type MemMapper } from "@/utils/mem";
import { common_ui, UITab } from "@/utils/common_ui";
import { CTCSS_TONES, DCS_CODES, trim_string } from "@/utils/radio";
import { t } from "i18next";

const map_bits_array = (size: number, m: MemMapper) =>
  m
    .array(size, () => m.bitmap({ b0: 1, b1: 1, b2: 1, b3: 1, b4: 1, b5: 1, b6: 1, b7: 1 }))
    .flatMap((x) => Object.values<M.Bits>(x).reverse());

export class THUV88Radio extends Radio {
  static Info: RadioInfo = {
    id: "thuv88",
    vendor: "TYT",
    model: "TH-UV88",
    beta: true,
  };

  protected readonly _MEM_SIZE = 0x22a0;
  protected readonly _BLOCK_SIZE = 0x20;

  protected readonly _FINGERPRINT = Buffer.from("\xFE\xFE\xEF\xEE\xE1UV88", "ascii");

  protected readonly _INDENT_CMD = Buffer.from("\xFE\xFE\xEE\xEF\xE0UV88\xFD", "ascii");
  protected readonly _EN_READ_CMD = Buffer.from("\xFE\xFE\xEE\xEF\xE2UV88\xFD", "ascii");
  protected readonly _EN_READ_CMD_ACK = Buffer.from("\xFE\xFE\xEF\xEE\xE6\x00\xFD", "ascii");
  protected readonly _EN_WRITE_CMD = Buffer.from("\xFE\xFE\xEE\xEF\xE3UV88\xFD", "ascii");
  protected readonly _EN_WRITE_CMD_ACK = Buffer.from("\xFE\xFE\xEF\xEE\xE6\x00\xFD", "ascii");
  protected readonly _EXIT_CMD = Buffer.from("\xFE\xFE\xEE\xEF\xE5UV88\xFD", "ascii");

  protected readonly _READ_CMD = Buffer.from("\xFE\xFE\xEE\xEF\xEB", "ascii");
  protected readonly _READ_ACK = Buffer.from("\xFE\xFE\xEF\xEE\xE4", "ascii");
  protected readonly _WRITE_CMD = Buffer.from("\xFE\xFE\xEE\xEF\xE4", "ascii");
  protected readonly _WRITE_ACK = Buffer.from("\xFE\xFE\xEF\xEE\xE6\x00\xFD", "ascii");

  protected readonly _SIDE_KEY_FUNCTIONS?: string[];

  protected readonly _SETTINGS_FORMAT: "88" | "99" = "88";
  protected readonly _DISPLAY_TIMEOUTS: boolean = false;
  protected readonly _DISPLAY_HELLO_LOGO: boolean = false;
  protected readonly _STE_OPTIONS: string[] = [t("off"), t("frequency")];

  protected _img?: Buffer;
  protected _mem?: ReturnType<typeof this._parse>;

  protected _parse(img: Buffer) {
    const m = create_mem_mapper(img, this.dispatch_ui);

    return {
      ...m.seek(0x0000).skip(0, {}),

      channels: m.array(200, () =>
        m.struct(() => ({
          rxfreq: m.u32(),
          txfreq: m.u32(),
          ...m.bitmap(
            {
              scramble: 4,
              rxtone: 12,
            },
            m.u16()
          ),
          ...m.bitmap(
            {
              decodeDSCI: 1,
              encodeDSCI: 1,
              _: 2,
              txtone: 12,
            },
            m.u16()
          ),
          ...m.bitmap({
            power: 2,
            wide: 2,
            b_lock: 2,
            _: 2,
          }),
          ...m.bitmap({
            _: 3,
            signal: 2,
            displayName: 1,
            _1: 2,
          }),
          ...m.bitmap({
            _: 2,
            pttid: 2,
            _1: 1,
            step: 3,
          }),
          name: m.str(6),
        }))
      ),

      ...m.seek(0x1140).skip(0, {}),

      workmodesettings: {
        ...m.bitmap({
          autoKeylock: 1, // *OFF, On
          _: 1, //
          vfomrmodeb: 1, // *VFO B, MR B
          vfomrmode: 1, // *VFO, MR
          _1: 4,
        }),
        mrAch: m.u8(), // MR A Channel #
        mrBch: m.u8(), // MR B Channel #
        ...m.bitmap({
          _: 5,
          ab: 1, // A, B
          _1: 2,
        }),
      },

      ...m.seek(0x1160).skip(0, {}),

      settings:
        this._SETTINGS_FORMAT === "88"
          ? {
              format: "88",
              introScreen1: m.str(12),
              ...m.bitmap({
                offFreqVoltage: 3,
                _: 1,
                sqlLevel: 4, // *OFF, 1-9
              }),
              ...m.bitmap({
                beep: 1,
                callKind: 2,
                introScreen: 2, // *OFF, Voltage, Char String
                _: 2,
                txChSelect: 1, // *Last CH, Main CH
              }),
              ...m.bitmap({
                autoPowOff: 3, // OFF, 30Min, 1HR, 2HR
                _: 1,
                tot: 4, // *OFF, 30 Second, 60 Second, 90 Second, ... , 270 Second
              }),
              ...m.bitmap({
                _: 1,
                roger: 1,
                dailDef: 1,
                language: 1, // ?Chinese, English
                _1: 1,
                endToneElim: 1, // *OFF, Frequency
                _2: 2,
              }),
              ...m.bitmap({
                scanResumeTime: 2, // 2S, 5S, 10S, 15S (not on screen)
                disMode: 2, // Frequency, Channel, Name
                scanType: 2, // To, Co, Se
                ledMode: 2, // Off, On, Auto
              }),
              ...m.skip(3, {}),
              ...m.bitmap({
                swAudio: 1,
                radioMoni: 1,
                keylock: 1,
                dualWait: 1,
                _: 1,
                light: 3, // 1, 2, 3, 4, 5, 6, 7
              }),
              ...m.bitmap({
                voxSw: 1,
                voxDelay: 4, // 0.5S, 1.0S, 1.5S, 2.0S, 2.5S, 3.0S, 3.5S, 4.0S, 4.5S, 5.0S
                voxLevel: 3, // 1, 2, 3, 4, 5, 6, 7
              }),
              ...m.bitmap({
                _: 4,
                saveMode: 2, // OFF, 1:1, 1:2, 1:4
                keyMode: 2, // ALL, PTT, KEY, Key & Side Key
              }),
              ...m.skip(3, {}),
              name2: m.str(6),
            }
          : {
              format: "99",
              ...m.bitmap({
                sideKey2: 4,
                sideKey1: 4,
              }),
              ...m.bitmap({
                sideKey2_long: 4,
                sideKey1_long: 4,
              }),
              ...m.skip(9, {}),
              ...m.bitmap({
                manDownTm: 4, // 0x116B manDown Tm
                _: 3, //
                manDownSw: 1,
              }),
              ...m.bitmap({
                offFreqVoltage: 3, // 0x116C _unknown referred to in code but not on screen
                _: 1, //
                sqlLevel: 4, // *OFF, 1-9
              }),
              ...m.bitmap({
                beep: 1, // 0x116D [09] *OFF, On
                callKind: 2, //        code says 1750,2100,1000,1450 as options not on screen
                introScreen: 2, //        [20] *OFF, Voltage, Char String
                _: 2, //
                txChSelect: 1, // *Last CH, Main CH
              }),
              ...m.bitmap({
                autoPowOff: 3, // 0x116E not on screen? OFF, 30Min, 1HR, 2HR
                _: 1,
                tot: 4, //        [11] *OFF, 30 Second, 60 Second, 90 Second, ... , 270 Second
              }),
              ...m.bitmap({
                _: 1,
                roger: 1, //        [14] *OFF, On
                dailDef: 1, //        _Unknown - 'Volume, Frequency'
                language: 1, //        English only
                endToneElim: 2, //        *Frequency, 120, 180, 240 (RA89)
                _1: 2,
              }),
              ...m.bitmap({
                scanType: 2, // 0x1170 [17] *Off, On, 5s, 10s, 15s, 20s, 25s, 30s
                disMode: 2, //        [33] *Frequency, Channel, Name
                ledMode: 4, //        [07] *Off, On, 5s, 10s, 15s, 20s, 25s, 30s
              }),
              ...m.skip(3, {}),
              ...m.bitmap({
                swAudio: 1, // 0x1174 [19] *OFF, On
                radioMoni: 1, //        [34] *OFF, On
                keylock: 1, //        [18] *OFF, On
                dualWait: 1, //        [06] *OFF, On
                _: 1, //
                light: 3, //        [08] *1, 2, 3, 4, 5, 6, 7
              }),
              ...m.bitmap({
                voxSw: 1, // 0x1175 [13] *OFF, On
                voxDelay: 4, //        *0.5S, 1.0S, 1.5S, 2.0S, 2.5S, 3.0S, 3.5S,
                //         4.0S, 4.5S, 5.0S
                voxLevel: 3, //        [03] *1, 2, 3, 4, 5, 6, 7
              }),
              ...m.bitmap({
                _: 4, // 0x1176
                saveMode: 2, //        [16] *OFF, 1:1, 1:2, 1:4
                keyMode: 2, //        [32] *ALL, PTT, KEY, Key & Side Key
              }),
              ...m.skip(3, {}),
              name2: m.str(6),
            },

      /** bitmap */
      chan_avail: map_bits_array(26, m),

      ...m.seek(0x11a0).skip(0, {}),

      /** bitmap */
      chan_skip: map_bits_array(26, m),

      ...m.seek(0x191e).skip(0, {}),

      settings2: m.bitmap({
        _: 4,
        /**
         * 0 = Unlocked  TX: 136-174 MHz / 400-480 MHz
         * 2-3 = _Unknown
         * 3 = EU        TX: 144-146 MHz / 430-440 MHz
         * 4 = US        TX: 144-148 MHz / 420-450 MHz
         * 5-15 = _Unknown
         */
        region: 4,
      }),

      ...m.seek(0x1940).skip(0, {}),

      openradioname: {
        name1: m.str(16),
        name2: m.str(16),
      },
      chan_name: m.array(200, () => m.str(10)),

      ...m.seek(0x2180).skip(0, {}),

      fm_stations: m.array(24, () => m.u32()),
      fmmap: map_bits_array(4, m),
      fmfrqs: m.u32(),
    };
  }

  protected _get_squelch(get: (i: number) => { tone: M.Bits; polarity: M.Bits }): UI.Field.Channels["squelch_rx"] {
    return {
      tones: CTCSS_TONES,
      codes: DCS_CODES,
      options: ["Off", "CTCSS", "DCS"],
      get: (i) => {
        const refs = get(i);
        const tone = refs.tone.get();
        const polarity = refs.polarity.get();

        if (tone > 2600) return { mode: "Off" };

        if (tone > 511) return { mode: "CTCSS", freq: tone / 10 };

        return {
          mode: "DCS",
          polarity: polarity ? "N" : "I",
          code: Number.parseInt(tone.toString(8), 10),
        };
      },
      set: (i, val) => {
        const { polarity, tone } = get(i);

        if (val.mode === "Off") {
          tone.set(0xfff);
        } else if (val.mode === "CTCSS") {
          tone.set(val.freq * 10);
        } else {
          tone.set(Number.parseInt(val.code.toString(10), 8));
          polarity.set(val.polarity === "N" ? 1 : 0);
        }
      },
    };
  }

  protected _get_fm_radio_freq(val: number): number {
    if (val < 64_00_000 || val > 108_00_000) return 88_00_000;
    return val;
  }

  override ui(): UI.Root {
    const mem = this._mem;
    if (!mem) return { fields: [] };

    const {
      chan_avail,
      chan_name,
      chan_skip,
      channels,
      settings,
      settings2,
      openradioname,
      fmfrqs,
      fm_stations,
      fmmap,
    } = mem;

    return {
      fields: [
        // MARK: Channels

        {
          ...common_ui.channels({ size: channels.length }),
          channel: {
            get: (i) => trim_string(channels[i].name.get() + chan_name[i].get()) || `CH-${i}`,
            set: (i, val) => {
              set_string(channels[i].name, val.substring(0, 6));
              set_string(chan_name[i], val.substring(6));
            },
          },
          empty: {
            get: (i) => chan_avail[i].get() === 0,
            delete: (i) => chan_avail[i].set(0),
            init: (i) => {
              chan_avail[i].set(1);
              chan_skip[i].set(0);

              const ch = channels[i];
              ch.__raw.fill(0);
              ch.rxfreq.set(446_000_00);
              ch.txfreq.set(446_000_00);
              ch.wide.set(1);
              ch.rxtone.set(0xfff);
              ch.txtone.set(0xfff);
            },
          },
          freq: {
            get: (i) => channels[i].rxfreq.get() * 10,
            set: (i, val) => {
              const { rxfreq, txfreq } = channels[i];
              const offset = txfreq.get() - rxfreq.get();

              rxfreq.set(val / 10);
              txfreq.set(rxfreq.get() + offset);
            },
          },
          offset: {
            get: (i) => {
              const { rxfreq, txfreq } = channels[i];
              return (txfreq.get() - rxfreq.get()) * 10;
            },
            set: (i, val) => {
              const { rxfreq, txfreq } = channels[i];
              txfreq.set(rxfreq.get() + val / 10);
            },
          },
          mode: {
            options: ["WFM", "FM", "NFM"],
            get: (i) => channels[i].wide.get(),
            set: (i, val) => channels[i].wide.set(val),
          },
          squelch_rx: this._get_squelch((i) => ({ tone: channels[i].rxtone, polarity: channels[i].decodeDSCI })),
          squelch_tx: this._get_squelch((i) => ({ tone: channels[i].txtone, polarity: channels[i].encodeDSCI })),
          power: {
            options: [5, 2.5, 0.5],
            name: (val) => [t("power_high"), t("power_mid"), t("power_low")][val],
            get: (i) => channels[i].power.get(),
            set: (i, val) => channels[i].power.set(val),
          },
          scan: {
            options: ["On", "Off"],
            get: (i) => chan_skip[i].get(),
            set: (i, val) => chan_skip[i].set(val),
          },
          bcl: {
            get: (i) => channels[i].b_lock.get() > 0,
            set: (i, val) => channels[i].b_lock.set(val ? 2 : 0),
          },
          ptt_id: {
            id_options: [],
            on_options: ["Off", "Begin", "End", "BeginAndEnd"],
            get: (i) => ({ id: 0, on: channels[i].pttid.get() }),
            set: (i, val) => channels[i].pttid.set(val.on),
          },
        } as UI.Field.Channels,

        // MARK: Settings

        {
          type: "select",
          id: "tx_ch_select",
          name: "Priority transmit",
          tab: UITab.System,
          short: true,
          options: ["Last channel", "Main channel"],
          get: () => settings.txChSelect.get(),
          set: (val) => settings.txChSelect.set(val),
        },
        common_ui.vox(settings.voxSw),
        common_ui.vox_level(settings.voxLevel, { min: 1, max: 7 }),
        common_ui.dual_watch(settings.dualWait),
        common_ui.sql(settings.sqlLevel, { min: 0, max: 9 }),
        this._DISPLAY_TIMEOUTS
          ? common_ui.backlight_timeout(
              {
                get: () => {
                  const val = settings.ledMode.get();
                  if (val === 1) return 7;
                  if (val > 1) return val - 1;
                  return val;
                },
                set: (val) => {
                  let res = val;
                  if (val === 7) {
                    res = 1;
                  } else if (val >= 1) {
                    res = val + 1;
                  }
                  settings.ledMode.set(res);
                },
              },
              {
                min: 0,
                max: 7,
                names: { 0: t("off"), 7: t("always_on") },
                seconds: [0, 5, 10, 15, 20, 25, 30, 999],
              }
            )
          : common_ui.backlight_timeout_select(settings.ledMode, {
              options: [t("off"), t("always_on"), t("auto")],
            }),
        // FIXME: Background Light Color
        common_ui.backlight_brightness(settings.light, { min: 0, max: 6 }),
        common_ui.beep(settings.beep),
        common_ui.pow_tot(settings.tot, { from: 0, to: 270, step: 30 }),
        common_ui.roger_beep(settings.roger),
        common_ui.pow_battery_save_ratio(settings.saveMode, { max: 3, names: { 3: "1:4" } }),
        common_ui.scan_mode(settings.scanType, { options: [t("scan_time"), t("scan_carrier"), t("scan_search")] }),
        common_ui.keypad_lock_auto(settings.keylock),
        common_ui.voice_prompt(settings.swAudio),
        common_ui.hello_mode(settings.introScreen, {
          options: [t("off"), t("hello_voltage"), t("hello_text"), t("hello_picture")].slice(
            0,
            this._DISPLAY_HELLO_LOGO ? undefined : -1
          ),
        }),
        {
          type: "select",
          id: "key_lock_mode",
          name: "Key lock mode",
          tab: UITab.Control,
          short: true,
          options: ["All", "PTT", "Key", "Key & Side Key"],
          get: () => settings.keyMode.get(),
          set: (val) => settings.keyMode.set(val),
        },
        common_ui.channel_display_mode(settings.disMode, { options: [t("frequency"), t("channel"), t("name")] }),
        common_ui.sql_ste_select(settings.endToneElim, { options: this._STE_OPTIONS }),
        common_ui.hello_msg_str_x(
          {
            ...openradioname.name1,
            set: (val) => {
              openradioname.name1.set(val);
              if ("introScreen1" in settings) set_string(settings.introScreen1, val);
            },
          },
          { line: 0, pad: "\x00" }
        ),
        common_ui.hello_msg_str_x(openradioname.name2, { line: 1, pad: "\x00" }),
        common_ui.vox_delay(settings.voxDelay, { from: 0.5, to: 5.0, step: 0.5 }),
        {
          type: "label",
          id: "lock",
          name: t("frequency_lock"),
          tab: UITab.System,
          get: () => {
            const options: { [k in number]?: string } = { 3: "EU", 4: "US" };
            const val = settings2.region.get();
            return options[val] || `Unknown ${val}`;
          },
        },
        ...(this._SIDE_KEY_FUNCTIONS && "sideKey1" in settings
          ? [
              common_ui.key_side_short_x_fn(settings.sideKey1, { key: "1", functions: this._SIDE_KEY_FUNCTIONS }),
              common_ui.key_side_long_x_fn(settings.sideKey1_long, { key: "1", functions: this._SIDE_KEY_FUNCTIONS }),
              common_ui.key_side_short_x_fn(settings.sideKey2, { key: "2", functions: this._SIDE_KEY_FUNCTIONS }),
              common_ui.key_side_long_x_fn(settings.sideKey2_long, { key: "2", functions: this._SIDE_KEY_FUNCTIONS }),
            ]
          : []),

        // MARK: FM

        {
          type: "text",
          id: "fm_freq",
          name: t("frequency"),
          tab: UITab.FMRadio,
          get: () => (this._get_fm_radio_freq(fmfrqs.get()) / 100_000).toFixed(1),
          set: (val) => fmfrqs.set(Math.max(64, Math.min(108, Number.parseFloat(val) || 0)) * 100_000),
        },
        {
          type: "table",
          name: t("fm"),
          id: "fm_presets",
          tab: UITab.FMRadio,
          size: () => 24,
          header: () => ({ freq: { name: t("frequency") } }),
          get: (i) => ({
            freq: fmmap[i].get() ? (this._get_fm_radio_freq(fm_stations[i].get()) / 100_000).toFixed(1) : undefined,
          }),
          set_ui: (i) => [
            {
              type: "switcher",
              id: "status",
              name: t("status"),
              get: () => fmmap[i].get() === 1,
              set: (val) => fmmap[i].set(val ? 1 : 0),
            },
            {
              type: "text",
              id: "freq",
              name: t("frequency"),
              get: () => (this._get_fm_radio_freq(fm_stations[i].get()) / 100_000).toFixed(1),
              set: (val) => fm_stations[i].set(this._get_fm_radio_freq(Number.parseFloat(val) * 100_000 || 0)),
            },
          ],
        },
      ],
    };
  }

  protected async _indent() {
    await serial.write(this._INDENT_CMD);

    const ack = await serial.read(36);
    if (!ack.slice(0, this._FINGERPRINT.length).equals(this._FINGERPRINT)) {
      throw new Error("Unexpected identification");
    }
    if (ack.at(-1) !== 0xfd) throw new Error("Unexpected footer");
  }

  protected async _read_block(offset: number, size: number) {
    const cmd = Buffer.alloc(this._READ_CMD.length + 4 + 2 + 1);
    this._READ_CMD.copy(cmd, 0);
    cmd.writeUInt32BE(offset, this._READ_CMD.length);
    cmd.writeUInt16BE(size, this._READ_CMD.length + 4);
    cmd.writeUInt8(0xfd, this._READ_CMD.length + 4 + 2);

    await serial.write(cmd);

    const res = await serial.read(size + 13);

    if (!res.slice(0, this._READ_ACK.length).equals(this._READ_ACK)) throw new Error("Unexpected header");
    if (res.at(-1) !== 0xfd) throw new Error("Unexpected footer");

    return res.slice(11, -2);
  }

  protected async _write_block(offset: number, data: Buffer) {
    let checksum = 0;
    for (let i = 0; i < data.length; i++) checksum = (checksum + data[i]) % 256;
    if (checksum !== 0) checksum = 256 - checksum;

    const cmd = Buffer.alloc(this._WRITE_CMD.length + 4 + 2 + data.length + 1 + 1);
    this._WRITE_CMD.copy(cmd, 0);
    cmd.writeUInt32BE(offset, this._WRITE_CMD.length);
    cmd.writeUInt16BE(data.length, this._WRITE_CMD.length + 4);
    data.copy(cmd, this._WRITE_CMD.length + 4 + 2);
    cmd.writeUInt8(checksum, this._WRITE_CMD.length + 4 + 2 + data.length);
    cmd.writeUInt8(0xfd, this._WRITE_CMD.length + 4 + 2 + data.length + 1);

    await serial.write(cmd);

    const ack = await serial.read(7);
    if (!ack.equals(this._WRITE_ACK)) throw new Error("Unexpected write ack");
  }

  protected async _exit_program_mode() {
    await serial.write(this._EXIT_CMD);
    await serial.clear();
  }

  override async upload() {
    if (!this._img) throw new Error("No data");
    return { snapshot: this._img, version: 0 };
  }

  override async load(snapshot: Buffer) {
    this._img = snapshot;
    this._mem = this._parse(snapshot);
    this.dispatch_ui_change();
  }

  override async read() {
    this.dispatch_progress(0);

    await serial.begin({ baudRate: 57_600 });
    await serial.clear();

    this._img = undefined;
    this._mem = undefined;
    this.dispatch_ui_change();

    await this._indent();

    await serial.write(this._EN_READ_CMD);

    const ack = await serial.read(7);
    if (!ack.equals(this._EN_READ_CMD_ACK)) throw new Error("Program reading is not accepted");

    this.dispatch_progress(0.1);

    const img = Buffer.alloc(this._MEM_SIZE);

    for (let i = 0; i < this._MEM_SIZE; i += this._BLOCK_SIZE) {
      const block = await this._read_block(i, this._BLOCK_SIZE);
      block.copy(img, i);

      this.dispatch_progress(0.1 + 0.8 * ((i + this._BLOCK_SIZE) / this._MEM_SIZE));
    }

    await this._exit_program_mode();

    await this.load(img);

    this.dispatch_progress(1);
  }

  override async write() {
    const img = this._img;
    if (!img) throw new Error("No data");

    this.dispatch_progress(0);

    await serial.begin({ baudRate: 57_600 });
    await serial.clear();

    await this._indent();

    await serial.write(this._EN_WRITE_CMD);

    const ack = await serial.read(7);
    if (!ack.equals(this._EN_WRITE_CMD_ACK)) throw new Error("Program writing is not accepted");

    this.dispatch_progress(0.1);

    for (let i = 0; i < this._MEM_SIZE; i += this._BLOCK_SIZE) {
      // Official programmer skips writing these memory locations
      if (i >= 0x1680 && i < 0x1940) continue;

      await this._write_block(i, img.slice(i, i + this._BLOCK_SIZE));

      this.dispatch_progress(0.1 + 0.8 * ((i + this._BLOCK_SIZE) / this._MEM_SIZE));
    }

    await this._exit_program_mode();

    this.dispatch_progress(1);
  }
}

export class THUV98Radio extends THUV88Radio {
  static Info: RadioInfo = {
    id: "thuv98",
    vendor: "TYT",
    model: "TH-UV98",
    beta: true,
  };

  protected readonly _FINGERPRINT = Buffer.from("\xFE\xFE\xEF\xEE\xE1UV98", "ascii");

  protected readonly _INDENT_CMD = Buffer.from("\xFE\xFE\xEE\xEF\xE0UV98\xFD", "ascii");
  protected readonly _EN_READ_CMD = Buffer.from("\xFE\xFE\xEE\xEF\xE2UV98\xFD", "ascii");
  protected readonly _EN_WRITE_CMD = Buffer.from("\xFE\xFE\xEE\xEF\xE3UV98\xFD", "ascii");
  protected readonly _EXIT_CMD = Buffer.from("\xFE\xFE\xEE\xEF\xE5UV98\xFD", "ascii");
}

export class THUV99Radio extends THUV88Radio {
  static Info: RadioInfo = {
    id: "thuv99",
    vendor: "TYT",
    model: "TH-UV99",
    beta: true,
  };

  protected readonly _FINGERPRINT = Buffer.from("\xFE\xFE\xEF\xEE\xE1UV99", "ascii");

  protected readonly _INDENT_CMD = Buffer.from("\xFE\xFE\xEE\xEF\xE0UV99\xFD", "ascii");
  protected readonly _EN_READ_CMD = Buffer.from("\xFE\xFE\xEE\xEF\xE2UV99\xFD", "ascii");
  protected readonly _EN_WRITE_CMD = Buffer.from("\xFE\xFE\xEE\xEF\xE3UV99\xFD", "ascii");
  protected readonly _EXIT_CMD = Buffer.from("\xFE\xFE\xEE\xEF\xE5UV99\xFD", "ascii");

  protected readonly _SETTINGS_FORMAT = "99";
  protected readonly _DISPLAY_TIMEOUTS = true;
  protected readonly _DISPLAY_HELLO_LOGO = true;

  protected _STE_OPTIONS = [t("frequency"), "120°", "180°", "240°"];

  protected readonly _SIDE_KEY_FUNCTIONS = [
    "None",
    "VOX",
    "Dual Wait",
    "Scan",
    "Moni",
    "1750 Tone",
    "Flashlight",
    "Power Level",
    "Alarm",
    "Noise Cancelaton",
    "Temp Monitor",
    "FM Radio",
    "Talk Around",
    "Frequency Reverse",
  ];
}
