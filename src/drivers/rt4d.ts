import type { UI } from "@/utils/ui";
import { Radio, type RadioInfo } from "./radio";
import { serial } from "@/utils/serial";
import { Buffer } from "buffer";
import { common_ui, UITab } from "@/utils/common_ui";
import { array_of, create_mem_mapper, to_js, type M } from "@/utils/mem";
import { CTCSS_TONES, DCS_CODES, DMR_ALL_CALL_ID, download_buffer, trim_string } from "@/utils/radio";
import { t } from "i18next";

const TYPE_DIGITAL = 0;
const TYPE_ANALOG = 1;

const MODE_SINGLE_SLOT = 0;
const MODE_DIRECT_DUAL = 1;

const SLOT_1 = 0;
const SLOT_2 = 1;

const ID_SELECT_RADIO = 0;
const ID_SELECT_CHANNEL = 1;

const CONTACT_INDIVIDUAL = 0;
const CONTACT_GROUP = 1;
const CONTACT_CALL_ALL = 2;

const ENCRYPT_ARC = 0;
const ENCRYPT_AES_128 = 1;
const ENCRYPT_AES_256 = 2;

const TIMER = [
  0, 5, 10, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345,
  360, 375, 390, 405, 420, 435, 450, 465, 480, 495, 510, 525, 540, 555, 570, 585, 600,
];

const DELAY = [
  0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000,
];

const ENC_TYPE: UI.DMREncryptionType[] = ["ARC", "AES-128", "AES-256"];

const STEP = ["0.25K", "1.25K", "2.5K", "5K", "6.25K", "10K", "12.5K", "20K", "25K", "50K", "100K", "500K", "1M", "5M"];

const RANGE = [
  "18-64MHz",
  "64-136MHz",
  "136-174MHz",
  "174-240MHz",
  "240-320MHz",
  "320-400MHz",
  "400-480MHz",
  "480-560MHz",
  "560-640MHz",
  "840-920MHz",
  "920-1000MHz",
];

const KEY_FN = [
  "None",
  "Analog CH Monitor",
  "Power Switch",
  "Dual Standby",
  "TX Priority",
  "Scanning",
  "Backlight",
  "Analog Roger Beep",
  "FM Radio",
  "Talkaround",
  "Emergency Alarm",
  "Freq Detect",
  "Remote CTC/DCS Decode",
  "Send Tone",
  "Query State",
  "Remote Monit",
  "Color Code Detect",
  "DMR Remote Stun",
  "DMR Remote Kill",
  "DMR Remote Wakeup",
  "Online Detect",
  "Group call ID Show",
  "AM/FM Switch(RX)",
  "Analog Spectrum",
  "SQ",
  "Freq Step",
  "Analg/DMR Switch Of VFO CH",
  "NOAA Weather CH",
  "Save CH",
  "New SMS",
  "SMS Menu",
  "LCD Brightness",
  "Analog VOX",
  "Zone Selection",
  "Promiscuos Mode",
  "Dual Slot On-off",
  "Time Slot Switch",
  "Color Code Switch",
  "DMR Encrypt On-off",
  "RX Group List Selection",
];

function checksum(buf: Buffer, offset: number = 0, length: number = buf.length) {
  let sum = 0;
  for (let i = 0; i < length; i += 1) sum = (sum + buf[offset + i]) % 256;
  return sum;
}

export class RT4DRadio extends Radio {
  static override Info: RadioInfo = {
    vendor: "Radtel",
    model: "RT-4D V3",
  };

  protected readonly _PROG_CMD = Buffer.from([0x34, 0x52, 0x05, 0x10, 0x9b]);
  protected readonly _PROG_ACK = Buffer.from([0x06]);
  protected readonly _END_CMD = Buffer.from([0x34, 0x52, 0x05, 0xee, 0x79]);

  protected readonly _RANGES = [
    { start: 8, end: 8 },
    { start: 16, end: 63 },
    { start: 112, end: 112 },
    { start: 120, end: 147 },
    { start: 376, end: 583 },
    { start: 792, end: 811 },
    { start: 831, end: 843 },
    { start: 856, end: 955 },
    { start: 960, end: 963 },
  ];
  protected readonly _MEM_SIZE = 1024 * 1024;

  protected _img?: Buffer;
  protected _mem?: ReturnType<typeof this._parse_v3>;

  protected _parse_v3(img: Buffer) {
    const m = create_mem_mapper(img, this.dispatch_ui);

    return {
      ...m.seek(0x4000).skip(0, {}),

      channels: array_of(1024, () =>
        m.struct(() => ({
          ...m.bitmap({
            type: 2, // 0=digital, 1=analog, empty
            rxtx: 2, // 0=rx+tx, 1=rx, 2=tx, #0
            id_select: 1, // 0=radio, 1=channel
            dmr_mode: 1, // 0=single-slot, 1=dual-slot
            dmr_slot: 1, // 0=1, 1=2
            dmr_monit: 1, // 0=off, 1=on
          }),
          ...m.bitmap({
            color_code: 4,
            scramble: 4, // 0=off, [1..8], #0
          }),
          ...m.bitmap({
            power: 2, // 0=low, 1=hight, #0
            tot: 6, // TIMER[], #0
          }),
          ...m.bitmap({
            scan_skip: 1,
            call_priority: 2, // 0=allow-tx, 1=channel-free, 2=color-code-idle
            tx_priority: 2, // 0=allow-tx, 1=channel-free, 2=subtone-free
            tail_tone: 3, //  0=off, 1=55hz, 2=120-deg-shift, 3=180-deg-shift, 4=240-deg-shift, #0
          }),
          ...m.bitmap({
            band: 2, // 0=wide, 1=narrow, #0
            amfm: 2, // 0=fm, 1=am, 2=ssb, #0
            ctdc: 3, // 0=normal, 1=enc1, 2=enc2, 3=mute-code, #0
            _unknown7: 1,
          }),
          rx_freq: m.u32(),
          tx_freq: m.u32(),
          rx_tone: m.u16(),
          tx_tone: m.u16(),
          contact: m.u16(), // index, #0
          rx_tg_list: m.u8(), // 0=none, number[], #0
          encryption: m.u16(), // 0=none, number[], #0
          ch_dmr_id: m.u32(),
          mute_code: m.u32(),
          _unknown30: m.buf(2),
          name: m.str(16),
        }))
      ),

      ...m.seek(0x1c000).skip(0, {}),
      // TODO: VFO A,B like channel

      ...m.seek(0x5e000).skip(0, {}),

      contacts: array_of(10_000, () =>
        m.struct(() => ({
          type: m.u8(), // 0=individual, 1=group, 2=all-call, empty
          id: m.u32(), // hex id
          name: m.str(16),
        }))
      ),

      ...m.seek(0xc6000).skip(0, {}),

      tg_lists: array_of(250, () =>
        m.struct(() => ({
          name: m.str(16),
          contacts: array_of(32, () => m.u16()),
        }))
      ),

      ...m.seek(0xd0000).skip(0, {}),

      keys: array_of(256, () =>
        m.struct(() => ({
          _unknown0: m.buf(1),
          type: m.u8(), // 0=ARC, 1=AES128, 2=AES256, 3=?, 4=?, empty
          name: m.str(14),
          key: m.buf(32),
        }))
      ),

      ...m.seek(0x1e000).skip(0, {}),

      zones: array_of(250, () =>
        m.struct(() => ({
          ab_channels: array_of(2, () => m.u16()), // TODO: really AB (original name - bufZoneCH)?
          name: m.str(16),
          channels: array_of(250, () => m.u16()),
        }))
      ),

      ...m.seek(0xf0000).skip(0, {}),

      fm: array_of(80, () =>
        m.struct(() => ({
          range: m.u8(),
          freq: m.u16(), // mhz * 10
          sw_mode: m.u8(), // 0=am, 1=lsb, 2=usb, 3=cw, #0
          sw_step: m.u8(), // 0=1k, 1=5k, 2=9k, 3=10k, #0
          sw_bw: m.u8(), // 0=0.5k, 1=1k, 2=1.2k, 3=2.2k, 4=3k, 5=4k, #0
          sw_agc: m.u8(), // 0=AGC, [0...-37], #0
          _unknown7: m.buf(2),
          _unknown9_: m.u16(), // 000.000 WTF?
          _unknown11: m.buf(1),
          mw_mode: m.u8(), // 0=am, 1=lsb, 2=usb, 3=cw, #0
          mw_step: m.u8(), // 0=1k, 1=5k, 2=9k, 3=10k, #0
          mw_bw: m.u8(), // 0=0.5k, 1=1k, 2=1.2k, 3=2.2k, 4=3k, 5=4k, #0
          mw_agc: m.u8(), // 0=AGC, [0...-37], #0
          _unknown16: m.u16(), // val-32768
          _unknown18: m.u16(),
          _unknown20: m.buf(1),
          lw_mode: m.u8(), // 0=am, 1=lsb, 2=usb, 3=cw, #0
          lw_step: m.u8(), // 0=1k, 1=5k, 2=9k, 3=10k, #0
          lw_bw: m.u8(), // 0=0.5k, 1=1k, 2=1.2k, 3=2.2k, 4=3k, 5=4k, #0
          lw_agc: m.u8(), // 0=AGC, [0...-37], #0
          _unknown25: m.u16(), // val-32768
          _unknown27: m.buf(3),
          name: m.str(16),
          _unknown46: m.buf(2),
        }))
      ),

      ...m.seek(0x2000).skip(0, {}),

      settings: {
        _unknown0: m.buf(16),
        start_pic: m.u8(), // 0=off, on
        screen_save_timer: m.u8(), // TIMER[]
        _unknown18: m.u8(),
        start_beep: m.u8(), // 0=off, on
        startup_lab: m.u8(), // 0=off, on
        _unknown21: m.buf(2),
        start_line: m.u16(),
        start_column: m.u16(),
        password_sw: m.u8(), // 0=off, on
        password: m.str(16),
        start_text: m.str(32),
        name: m.str(16),
        voice_prompt: m.u8(), // 0=off, 1=on
        key_beep: m.u8(), // 0=off, 1=on
        key_lock: m.u8(), // 0=off, 1=on
        lock_timer: m.u8(), // TIMER[]
        backlight_sw: m.u8(), // 0=off, 1=on
        backlight_brightness: m.u8(), // 0..4
        backlight_timer: m.u8(), // TIMER[]
        save_mode: m.u8(), // 0=off, 1=1:1, 2=1:2, 3=1:3
        save_start_timer: m.u8(), // TIMER[]
        menu_timer: m.u8(), // TIMER[]
        dw: m.u8(), // 0=off, 1=on
        talkaround: m.u8(), // 0=off, 1=talkaround, 2=inverse
        alarm: m.u8(), // 0=local, 1=remote, 2=both
        apo: m.u8(), // auto power off: 0=off, 1=on
        apo_seconds: m.u32(),
        alarms: array_of(4, () => ({
          mode: m.u8(), // 0=off, 1=once, 2=everyday
          hour: m.u8(),
          minute: m.u8(),
        })),
        _unknown122: m.buf(4),
        tx_priority: m.u8(), // 0=edit, 1=busy
        main_ptt: m.u8(), // 0=ch-a, 1=ch-main
        step: m.u8(), // STEP[]
        _unknown129: m.buf(2),
        main_range: m.u8(), // 0=a, 1=b
        ranges: array_of(2, () => ({
          mode: m.u8(), // 0=freq, 1=ch, 2=zone
          display: m.u8(), // 0=ch, 1=freq, 2=alias
          zone: m.u8(), // index: 0-249
          ch: m.u16(), // index: 0-1999
        })),
        lock_ranges: array_of(4, () => ({
          type: m.u8(), // 0=rx-tx, 1=rx, 2=lock
          start: m.u16(),
          end: m.u16(),
        })),
        scan_direction: m.u8(), // 0=up, 1=down
        scan_mode: m.u8(), // 0=to, 1=co, 2=se
        scan_return: m.u8(), // 0=original-ch, 1=current-ch
        scan_dwell: m.u8(), // 0-30
        _unknown166: m.buf(4),
        keys: {
          fs1_short: m.u8(), // KEY_FN[]
          fs1_long: m.u8(),
          fs2_short: m.u8(),
          fs2_long: m.u8(),
          alarm_short: m.u8(),
          alarm_long: m.u8(),
          pad_0: m.u8(),
          pad_1: m.u8(),
          pad_2: m.u8(),
          pad_3: m.u8(),
          pad_4: m.u8(),
          pad_5: m.u8(),
          pad_6: m.u8(),
          pad_7: m.u8(),
          pad_8: m.u8(),
          pad_9: m.u8(),
        },
        gps_sw: m.u8(), // 0=off, 1=on
        gps_baud: m.u8(), // 4800,9600,14400,19200,38400,56000,57600,115200,128000,256000
        utc: m.u8(), // "UTC 0", "UTC+1", "UTC+2", "UTC+3", "UTC+3.5", "UTC+4", "UTC+5", "UTC+5.5", "UTC+6", "UTC+7", "UTC+8", "UTC+9", "UTC+10", "UTC+11", "UTC+12", "UTC-1", "UTC-2", "UTC-3", "UTC-4", "UTC-5", "UTC-6", "UTC-7", "UTC-8", "UTC-9", "UTC-10", "UTC-11", "UTC-12"
        auto_gps_time: m.u8(), // 0=off, 1=on
        gps_record_sw: m.u8(), // 0=off, 1=on
        gps_record: m.u16(),
        bt_sw: m.u8(), // 0=off, 1=on
        bt_name: m.str(16),
        bt_pin: m.str(16),
        bt_pin_sw: m.u8(), // 0=off, on
        bt_mode: m.u8(), // 0=audio, 1=programming
        bt_mic: m.u8(), // 0=off, on
        bt_spk: m.u8(), // 0=off, on
        bt_mic_gain: m.u8(),
        bt_spk_gain: m.u8(),
        second_ptt: m.u8(), // 0=off, on
        contrast: m.u8(), // 5..25
        freq_input: m.u8(), // 0=xxx_xxx, xxx_xxx.xx
        dual_display: m.u8(), // 0=dual, single
        _unknown236: m.buf(20),

        // Analog +256
        tone: m.u16(), // 110-20_000
        sql: m.u8(), // 0-10
        _unknown259: m.buf(2),
        mic_gain: m.u8(), // 0-31
        spk_gain: m.u8(), // 0-63
        _unknown263: m.buf(4),
        tx_beep_start: m.u8(), // 0=off, 1=on
        tx_beep_end: m.u8(), // 0=off, 1=1, 2=2, 3=mdc1200, 4=gps
        _unknown269: m.buf(3),
        detect_range: m.u8(), // RANGE[]
        detect_delay: m.u16(), // DELAY[]
        _unknown275: m.buf(1),
        glitch: m.u8(), // 0-10, 0
        _unknown277: m.buf(107),

        // Digital +384
        radio_id: m.u32(),
        remote_control: m.u8(), // 0=off, 1=on
        _unknown389: m.buf(2),
        mic_gain_dig: m.u8(), // 0-24
        spk_gain_dig: m.u8(), // 0-24
        _unknown393: m.buf(4),
        tx_beep_start_dig: m.u8(), // 0=off, 1=on
        tx_beep_end_dig: m.u8(), // 0=off, 1=on, 2=on
        group_call_timer: m.u16(), // 0-9999
        single_call_timer: m.u16(), // 0-9999
        sql_dig: m.u8(), // 0-10
        group_display: m.u8(), // 0=caller, 1=group
        _unknown405: m.buf(107),

        // DTMF +512
        dtmf: {
          send_delay: m.u8(), // DELAY[]
          send_duration: m.u8(), // [30,40,...,200]
          send_interval: m.u8(), // [30,40,...,200]
          send_mode: m.u8(), // 0=off, 1=begin, 2=end, 3=both
          send_select: m.u8(), // code index: 0-15
          display: m.u8(), // 0=off, 1=on
          encode_gain: m.u8(), // 0-127
          decode_th: m.u8(), // 0-63
          remote_control: m.u8(), // 0=off, 1=on
          calibrate: m.u8(), // 0=off, 1=on
          // 1-16, stun, wake, kill, monitor
          list: array_of(20, () =>
            m.struct(() => ({
              code: m.str(14),
              _unknown1: m.buf(1),
              length: m.u8(), // >14=off
            }))
          ),
        },

        freq_scan_direction: m.u8(), // 0=up, 1=down
        sms_beep: m.u8(), // 0=off, 1=on
        freq_scan_start: m.u32(), // 18_00_000-999_999_999
        freq_scan_end: m.u32(), // 18_00_000-999_999_999
      },

      ...m.seek(0xd6000).skip(0, {}),

      // preset, draft, received, sent
      sms: array_of(16 + 128 + 128 + 128, () =>
        m.struct(() => ({
          box: m.u8(), // 0=preset, 1=draft, 2=received, 3=sent
          type: m.u8(), // 0=individual, 1=group, 2=all, unknown
          id: m.u32(),
          time: m.struct(() => ({
            year2: m.u8(),
            month: m.u8(),
            day: m.u8(),
            hour: m.u8(),
            minute: m.u8(),
            second: m.u8(),
          })),
          _unknown12: m.buf(44),
          text: m.str(200), // v1=200, v2=160 but next mem is unused
        }))
      ),
    };
  }

  protected _get_squelch_ui(ref: (i: number) => M.U16): UI.Field.Channels["squelch_rx"] {
    return {
      options: ["Off", "CTCSS", "DCS"],
      tones: CTCSS_TONES,
      codes: DCS_CODES,
      get: (i) => {
        const val = ref(i).get();
        const num = val & 0x0fff;

        if ((val & 0xf000) == 0x1000) return { mode: "CTCSS", freq: num / 10 };

        if ((val & 0xf000) == 0x2000) return { mode: "DCS", polarity: "N", code: Number.parseInt(num.toString(8), 10) };
        if ((val & 0x3000) == 0x3000) return { mode: "DCS", polarity: "I", code: Number.parseInt(num.toString(8), 10) };

        return { mode: "Off" };
      },
      set: (i, val) => {
        if (val.mode === "CTCSS") {
          const num = val.freq * 10;
          ref(i).set(0x1000 + (num & 0x0fff));
        } else if (val.mode === "DCS") {
          const num = Number.parseInt(val.code.toString(10), 8);
          ref(i).set((val.polarity === "N" ? 0x2000 : 0x3000) + (num & 0x0fff));
        } else {
          ref(i).set(0x0000);
        }
      },
    };
  }

  ui(): UI.Root {
    const mem = this._mem;
    if (!mem) return { fields: [] };

    const { channels, contacts, tg_lists, keys } = mem;

    return {
      fields: [
        {
          ...common_ui.channels({ size: channels.length }),
          empty: {
            get: (i) => channels[i].type.get() > 1,
            delete: (i) => channels[i].type.set(0xff),
            init: (i) => {
              const ch = channels[i];
              ch.__raw.set(new Array(ch.__raw.size).fill(0x00));
              ch.rx_freq.set(446_000_00);
              ch.tx_freq.set(ch.rx_freq.get());
              ch.type.set(TYPE_ANALOG);
            },
          },
          digital: {
            get: (i) => channels[i].type.get() === TYPE_DIGITAL,
            set: (i, val) => channels[i].type.set(val ? TYPE_DIGITAL : TYPE_ANALOG),
          },
          channel: {
            get: (i) => trim_string(channels[i].name.get()) || `CH-${i + 1}`,
            set: (i, val) => {
              const name = channels[i].name;
              name.set(val.slice(0, name.raw.size).padEnd(name.raw.size, "\x00"));
            },
          },
          freq: {
            min: 18_000_000,
            max: 999_000_000,
            get: (i) => channels[i].rx_freq.get() * 10,
            set: (i, val) => {
              const offset = channels[i].tx_freq.get() - channels[i].rx_freq.get();

              channels[i].rx_freq.set(val / 10);
              channels[i].tx_freq.set(channels[i].rx_freq.get() + offset);
            },
          },
          offset: {
            get: (i) => (channels[i].tx_freq.get() - channels[i].rx_freq.get()) * 10,
            set: (i, val) => channels[i].tx_freq.set(channels[i].rx_freq.get() + val / 10),
          },
          power: {
            options: [1, 5],
            name: (val) => [t("power_low"), t("power_high")][val] || "?",
            get: (i) => channels[i].power.get(),
            set: (i, val) => channels[i].power.set(val),
          },
          scan: {
            options: ["On", "Off"],
            get: (i) => channels[i].scan_skip.get(),
            set: (i, val) => channels[i].scan_skip.set(val),
          },
          bcl: {
            get: (i) => {
              const ch = channels[i];
              return Boolean((ch.type.get() === TYPE_ANALOG ? ch.tx_priority : ch.call_priority).get());
            },
            set: (i, val) => {
              const ch = channels[i];
              (ch.type.get() === TYPE_ANALOG ? ch.tx_priority : ch.call_priority).set(val ? 1 : 0);
            },
          },

          mode: {
            options: ["NFM", "FM", "AM", "SSB"],
            get: (i) => {
              const mode = channels[i].amfm.get();
              const band = channels[i].amfm.get();

              if (mode === 0 && band === 1) return 0;

              return mode + 1;
            },
            set: (i, val) => {
              if (val === 0) {
                channels[i].amfm.set(0);
                channels[i].band.set(1);
              } else {
                channels[i].amfm.set(val - 1);
                channels[i].band.set(0);
              }
            },
          },
          squelch_rx: this._get_squelch_ui((i) => channels[i].rx_tone),
          squelch_tx: this._get_squelch_ui((i) => channels[i].tx_tone),

          dmr_encryption: {
            keys: () => [
              { name: "", type: "Off" },
              ...(() => {
                const list: UI.DMREncryption[] = [];
                for (const key of keys) {
                  const type = key.type.get();
                  if (type > 4) break;
                  if (type === ENCRYPT_ARC) list.push({ type: "ARC", name: trim_string(key.name.get()) });
                  if (type === ENCRYPT_AES_128) list.push({ type: "AES-128", name: trim_string(key.name.get()) });
                  if (type === ENCRYPT_AES_256) list.push({ type: "AES-256", name: trim_string(key.name.get()) });
                }
                return list;
              })(),
            ],
            get: (i) => ({ key_index: channels[i].encryption.get() }),
            set: (i, val) => channels[i].encryption.set(val.key_index),
          },
          dmr_slot: {
            options: ["Slot-1", "Slot-2", "DualSlot"],
            get: (i) => {
              if (channels[i].dmr_mode.get() === MODE_DIRECT_DUAL) return 2;
              return channels[i].dmr_slot.get() === SLOT_2 ? 1 : 0;
            },
            set: (i, val) => {
              if (val === 2) {
                channels[i].dmr_mode.set(MODE_DIRECT_DUAL);
              } else {
                channels[i].dmr_mode.set(MODE_SINGLE_SLOT);
                channels[i].dmr_slot.set(val === 0 ? SLOT_1 : SLOT_2);
              }
            },
          },
          dmr_color_code: {
            get: (i) => channels[i].color_code.get(),
            set: (i, val) => channels[i].color_code.set(val),
          },
          dmr_contact: {
            contacts: () => {
              const list: UI.DMRContact[] = [];
              for (const c of contacts) {
                const type = c.type.get();
                if (type === CONTACT_CALL_ALL) {
                  list.push({ type: "Group", id: 16_777_215, name: "" });
                } else if (type === CONTACT_GROUP) {
                  list.push({ type: "Group", id: c.id.get(), name: trim_string(c.name.get()) });
                } else if (type === CONTACT_INDIVIDUAL) {
                  list.push({ type: "Individual", id: c.id.get(), name: trim_string(c.name.get()) });
                } else {
                  break;
                }
              }
              return list;
            },
            get: (i) => channels[i].contact.get(),
            set: (i, val) => channels[i].contact.set(val),
          },
          dmr_rx_list: {
            lists: [
              t("off"),
              ...(() => {
                const list: string[] = [];
                for (const rx of tg_lists) {
                  const name = trim_string(rx.name.get());
                  if (name) list.push(name);
                }
                return list;
              })(),
            ],
            get: (i) => channels[i].rx_tg_list.get(),
            set: (i, val) => channels[i].rx_tg_list.set(val),
          },
          dmr_id: {
            from: ["Radio", "Channel"],
            get: (i) => {
              if (channels[i].id_select.get() !== ID_SELECT_CHANNEL) return { from: "Radio" };
              return { from: "Channel", id: channels[i].ch_dmr_id.get() };
            },
            set: (i, val) => {
              if (val.from === "Radio") {
                channels[i].id_select.set(ID_SELECT_RADIO);
              } else {
                channels[i].id_select.set(ID_SELECT_CHANNEL);
                channels[i].ch_dmr_id.set(val.id);
              }
            },
          },

          extra: (i) => {
            const extra: UI.Field.Any[] = [];

            // TODO: all fields
            if (channels[i].type.get() === TYPE_DIGITAL) {
              extra.push({
                type: "switcher",
                id: "dmr_monit",
                name: "Monitoring",
                get: () => channels[i].dmr_monit.get() === 1,
                set: (val) => channels[i].dmr_monit.set(val ? 1 : 0),
              });
            }

            extra.push(common_ui.tot_list(channels[i].tot, { seconds: TIMER }));

            return extra;
          },
        },

        {
          ...common_ui.contacts({ size: contacts.length }),
          get: (i) => {
            if (i === 0) return { type: "Group", id: DMR_ALL_CALL_ID, name: "" };

            const c = contacts[i];

            const type = c.type.get();
            if (type > 2) return;

            return {
              type: type === CONTACT_GROUP ? "Group" : "Individual",
              id: c.id.get(),
              name: trim_string(c.name.get()),
            };
          },
          set: (i, val) => {
            if (i === 0) throw new Error("Protected contact");
            const c = contacts[i];

            c.type.set(val.type === "Group" ? CONTACT_GROUP : CONTACT_INDIVIDUAL);
            c.id.set(val.id);
            c.name.set(val.name.substring(0, c.name.raw.size).padEnd(c.name.raw.size, "\xFF"));
          },
          delete: (i) => {
            if (i === 0) throw new Error("Protected contact");
            const c = contacts[i];

            c.__raw.set(new Array(c.__raw.size).fill(0xff));
            for (let ri = i; ri < contacts.length - 1; ri += 1) {
              contacts[ri].__raw.set(contacts[ri + 1].__raw.get());
              if (contacts[ri + 1].type.get() > 2) break;
            }
          },
        } as UI.Field.Contacts,

        {
          type: "table",
          id: "keys",
          name: "Encryption keys",
          tab: UITab.Encryption,
          size: () => keys.length,
          header: () => ({
            name: { name: t("name") },
            type: { name: t("encryption_type") },
            key: { name: t("encryption_key") },
          }),
          get: (i) => {
            const key = keys[i];
            const type = key.type.get();
            if (type > 4) return;

            return {
              name: trim_string(key.name.get()),
              type: ENC_TYPE[type],
              key: key.key
                .get()
                .slice(0, type === 0 ? 5 : type === 1 ? 16 : type === 2 ? 32 : 0)
                .toString("hex"),
            };
          },
          set_ui: (i) => [
            {
              type: "text",
              id: "name",
              name: t("name"),
              get: () => trim_string(keys[i].name.get()),
              set: (val) => {
                const name = keys[i].name;
                name.set(val.substring(0, name.raw.size).padEnd(name.raw.size, "\xff"));
              },
            },
            {
              type: "select",
              id: "type",
              name: t("encryption_type"),
              short: true,
              options: ENC_TYPE,
              get: () => keys[i].type.get(),
              set: (val) => keys[i].type.set(val),
            },
            {
              type: "text",
              id: "key",
              name: t("encryption_key"),
              get: () => {
                const key = keys[i];
                const type = key.type.get();
                return key.key
                  .get()
                  .slice(0, type === 0 ? 5 : type === 1 ? 16 : type === 2 ? 32 : 0)
                  .toString("hex");
              },
              set: (val) => {
                const key = keys[i];
                const type = key.type.get();
                const length = type === 0 ? 5 : type === 1 ? 16 : type === 2 ? 32 : 0;

                const buf = Buffer.alloc(key.key.size, 0xff);
                Buffer.from(val.replaceAll(/[^0-9a-f]+/g, "").padStart(length * 2, "0"), "hex")
                  .slice(0, length)
                  .copy(buf);
                key.key.set(buf);
              },
            },
          ],
        },
      ],
    };
  }

  protected async _read_block(addr: number) {
    const cmd = Buffer.alloc(4);
    cmd.writeUInt8(0x52, 0);
    cmd.writeUInt16BE(addr, 1);
    cmd.writeUInt8(checksum(cmd.slice(0, 3)), 3);

    await serial.write(cmd);

    const res = await serial.read(1028);
    if (!res.slice(0, 3).equals(cmd.slice(0, 3))) throw new Error("Unexpected header");
    if (res[1027] !== checksum(res.slice(0, -1))) throw new Error("Checksum error");

    const data = res.slice(3, 3 + 1024);

    return data;
  }

  async load(snapshot: Buffer) {
    const mem = this._parse_v3(snapshot);

    this._img = snapshot;
    this._mem = mem;

    console.log(to_js(mem)); // FIXME: remove

    this.dispatch_ui_change();
  }

  async read() {
    this.dispatch_progress(0);

    await serial.begin({ baudRate: 115_200 });
    await serial.clear();

    await serial.write(this._PROG_CMD);

    const prog_ack = await serial.read(1);
    if (!prog_ack.equals(this._PROG_ACK)) throw new Error("Prog mode not ack");

    this.dispatch_progress(0.1);

    const img = Buffer.alloc(this._MEM_SIZE);

    for (const range of this._RANGES) {
      for (let i = range.start; i <= range.end; i += 1) {
        const block = await this._read_block(i);

        const addr = i * 1024;
        block.copy(img, addr);

        this.dispatch_progress(0.1 + 0.8 * ((addr + 1024) / this._MEM_SIZE));
      }
    }

    await serial.write(this._END_CMD);

    download_buffer(img);

    this.dispatch_progress(1);
  }
}
