import type { UI } from "@/utils/ui";
import { Radio, type RadioInfo } from "./radio";
import { serial } from "@/utils/serial";
import { Buffer } from "buffer";
import { common_ui, modify_field, UITab } from "@/utils/common_ui";
import { array_of, create_mem_mapper, set_string, to_js, type M } from "@/utils/mem";
import { CTCSS_TONES, DCS_CODES, DMR_ALL_CALL_ID, trim_string } from "@/utils/radio";
import { t } from "i18next";

/*
MARK: TODO:
- При изменении канала, группы, контакта, зоны, ключа... нужно разрешать зависимости
*/

const TIMEOUT_WRITE = 5_000;

const PROG_CMD = Buffer.from([0x34, 0x52, 0x05, 0x10, 0x9b]);
const PROG_ACK = Buffer.from([0x06]);
const END_CMD = Buffer.from([0x34, 0x52, 0x05, 0xee, 0x79]);

const ADDR_CFG = 0x2000;
const ADDR_CH = 0x4000;
const ADDR_VFO = 0x1c000;
const ADDR_CFG_2 = 0x1c060;
const ADDR_ZONE = 0x1e000;
const ADDR_CONTACT = 0x5e000;
const ADDR_TGLIST = 0xc6000;
const ADDR_ENCRYPT = 0xd0000;
const ADDR_SMS_PRESET = 0xd6000;
const ADDR_SMS_DRAFT = 0xd7000;
const ADDR_SMS_INBOX = 0xde000;
const ADDR_SMS_OUTBOX = 0xe7000;
const ADDR_FM = 0xf0000;

const READ = [
  { offset: ADDR_CFG, size: 1 },
  { offset: ADDR_CH, size: 48 },
  { offset: ADDR_VFO, size: 1 },
  { offset: ADDR_ZONE, size: 128 },
  { offset: ADDR_CONTACT, size: 208 },
  { offset: ADDR_TGLIST, size: 20 },
  { offset: ADDR_ENCRYPT, size: 12 },
  { offset: ADDR_SMS_PRESET, size: 100 },
  { offset: ADDR_FM, size: 4 },
];
const WRITE = [
  { cmd: 144, offset: ADDR_CFG, size: 1 },
  { cmd: 145, offset: ADDR_CH, size: 48 },
  { cmd: 146, offset: ADDR_VFO, size: 1 },
  { cmd: 147, offset: ADDR_ZONE, size: 128 },
  { cmd: 148, offset: ADDR_CONTACT, size: 208 },
  { cmd: 149, offset: ADDR_TGLIST, size: 20 },
  { cmd: 150, offset: ADDR_ENCRYPT, size: 12 },
  { cmd: 151, offset: ADDR_SMS_PRESET, size: 4 }, // only drafts is editable
  { cmd: 152, offset: ADDR_FM, size: 4 },
];
const MEM_SIZE = 1024 * 1024;

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

const DTMF = [
  "DTMF-1",
  "DTMF-2",
  "DTMF-3",
  "DTMF-4",
  "DTMF-5",
  "DTMF-6",
  "DTMF-7",
  "DTMF-8",
  "DTMF-9",
  "DTMF-10",
  "DTMF-11",
  "DTMF-12",
  "DTMF-13",
  "DTMF-14",
  "DTMF-15",
  "DTMF-16",
  "Stun",
  "Wake",
  "Kill",
  "Monitor",
];

const LOCK = [t("unlocked"), t("only_rx"), t("locked")];

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
  t("off"),
  "Analog CH Monitor",
  t("fn_transmit_power"),
  "Dual Standby",
  "TX Priority",
  t("fn_scan"),
  "Backlight",
  "Analog Roger Beep",
  t("fn_fm"),
  "Talkaround",
  t("fn_alarm"),
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
  t("fn_vox"),
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

  protected _img?: Buffer;
  protected _mem?: ReturnType<typeof this._parse_v3>;

  // MARK: Mem mapping

  protected _parse_v3(img: Buffer) {
    const m = create_mem_mapper(img, this.dispatch_ui);

    const map_channel = () =>
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
      }));

    return {
      ...m.seek(ADDR_CH).skip(0, {}),

      channels: array_of(1024, map_channel),

      ...m.seek(ADDR_VFO).skip(0, {}),

      vfo_ab: array_of(2, map_channel),

      ...m.seek(ADDR_CONTACT).skip(0, {}),

      contacts: array_of(10_000, () =>
        m.struct(() => ({
          type: m.u8(), // 0=individual, 1=group, 2=all-call, empty
          id: m.u32(), // hex id
          name: m.str(16),
        }))
      ),

      ...m.seek(ADDR_TGLIST).skip(0, {}),

      tg_lists: array_of(250, () =>
        m.struct(() => ({
          name: m.str(16),
          contacts: array_of(32, () => m.u16()),
        }))
      ),

      ...m.seek(ADDR_ENCRYPT).skip(0, {}),

      keys: array_of(256, () =>
        m.struct(() => ({
          _unknown0: m.buf(1),
          type: m.u8(), // 0=ARC, 1=AES128, 2=AES256, 3=?, 4=?, empty
          name: m.str(14),
          key: m.buf(32),
        }))
      ),

      ...m.seek(ADDR_ZONE).skip(0, {}),

      zones: array_of(250, () =>
        m.struct(() => ({
          a_channel: m.u16(), // index of zones channel
          b_channel: m.u16(), // index of zones channel
          name: m.str(16),
          channels: array_of(250, () => m.u16()), // indexes
        }))
      ),

      ...m.seek(ADDR_FM).skip(0, {}),

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

      ...m.seek(ADDR_CFG).skip(0, {}),

      settings: {
        _unknown0: m.buf(16),
        start_pic_ws: m.u8(), // 0=off, on
        screen_save_timer: m.u8(), // TIMER[]
        _unknown18: m.u8(),
        start_beep: m.u8(), // 0=off, on
        start_text_sw: m.u8(), // 0=off, on
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
        _unknown110: m.buf(16),
        tx_priority: m.u8(), // 0=edit, 1=busy
        main_ptt: m.u8(), // 0=ch-a, 1=ch-main
        _unknown128: m.buf(14),
        lock_ranges: array_of(4, () => ({
          type: m.u8(), // 0=rx-tx, 1=rx, 2=lock
          start: m.u16(),
          end: m.u16(),
        })),
        _unknown162: m.buf(1),
        scan_mode: m.u8(), // 0=to, 1=co, 2=se
        scan_return: m.u8(), // 0=original-ch, 1=current-ch
        scan_dwell: m.u8(), // 0-30
        scan_interval: m.u8(), // [0..30], #0
        _unknown167: m.buf(2),
        refresh: m.u8(), // [0,100...2000], #0
        _unknown170: m.buf(63),
        contrast: m.u8(), // 5..25
        freq_6or8: m.u8(), // 0=xxx_xxx, xxx_xxx.xx
        _unknown235: m.buf(21),

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
        detect_delay: m.u8(), // DELAY[]
        _unknown274: m.buf(1),
        noaa: m.u8(), // 0=0ff, 1=on, #0
        glitch: m.u8(), // 0-10, 0
        tone_timer: m.u8(), // 0..120
        _unknown278: m.buf(106),

        // Digital +384
        radio_id: m.u32(),
        remote_control: m.u8(), // 0=off, 1=on
        tx_denoise: m.u8(), // 0-4
        rx_denoise: m.u8(), // 0-4
        mic_gain_dig: m.u8(), // 0-24
        spk_gain_dig: m.u8(), // 0-24
        _unknown393: m.buf(4),
        tx_beep_start_dig: m.u8(), // 0=off, 1=on
        tx_beep_end_dig: m.u8(), // 0=off, 1=on, 2=on
        group_call_timer: m.u16(), // 0-9999
        single_call_timer: m.u16(), // 0-9999
        sql_dig: m.u8(), // 0-10
        group_display: m.u8(), // 0=caller, 1=group
        _unknown405: m.buf(1),
        sms_format: m.u8(), // 0=hytera, 1=motorola, #0
        sms_font: m.u8(), // 0=unicode, 1=gbk, #0
        called_keep: m.u8(), // 0..4
        _unknown409: m.buf(103),

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
          _unknown521: m.buf(1),
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
        carrier_led: m.u8(), // 0=off, 1=on
      },

      ...m.seek(ADDR_CFG_2).skip(0, {}),

      settings2: {
        key_lock: m.u8(), // 0=off, 1=on, #0
        main_range: m.u8(), // 0=a, 1=b, #0
        dual_watch: m.u8(), // 0=off, 1=on, #0
        dual_display: m.u8(), // 0=off, 1=on, #0
        scan_dir: m.u8(), // 0=up, 1=down
        step: m.u8(), // STEP[]
        _unknown6: m.buf(2),
        spec_freq: m.u32(),
        spec_step: m.u32(),
        spec_rssi: m.u8(),
        _unknown17: m.u8(),
        fm_ch: m.u8(), // 0=1...80, #0
        fm_standby: m.u8(), // 0=off, 1=on, #0
        mode_a: m.u8(), // 0=freq, 1=ch, 2=zone
        mode_b: m.u8(), // 0=freq, 1=ch, 2=zone
        display_a: m.u8(), // 0=ch, 1=freq, 2=alias
        display_b: m.u8(), // 0=ch, 1=freq, 2=alias
        zone_a: m.u8(), // index: 0-249
        zone_b: m.u8(), // index: 0-249
        ch_a: m.u16(), // index: 0-1999
        ch_b: m.u16(), // index: 0-1999
        second_ptt: m.u8(), // 0=off, 1=on, #0
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
      },

      ...m.seek(ADDR_SMS_PRESET).skip(0, {}),

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

  protected _dmr_ui(field: UI.Field.Any) {
    return modify_field(field, (f) => ({ ...f, id: `dmr_${f.id}`, name: `DMR ${f.name}` }));
  }

  ui(): UI.Root {
    const mem = this._mem;
    if (!mem) return { fields: [] };

    const { channels, contacts, tg_lists, zones, keys, settings, settings2, fm } = mem;
    const { dtmf, lock_ranges } = settings;
    const { list: dtmf_list } = dtmf;

    return {
      fields: [
        // MARK: Channels

        {
          ...common_ui.channels({ size: channels.length }),
          swap: (a, b) => {
            const t = channels[a].__raw.get();
            channels[a].__raw.set(channels[b].__raw.get());
            channels[b].__raw.set(t);
          },
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
              set_string(name, val, "\x00");
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
        } as UI.Field.Channels,

        // MARK: Zones

        {
          type: "table",
          id: "zones",
          name: t("zones"),
          tab: UITab.Zones,
          size: () => zones.length,
          header: () => ({ name: { name: t("name") } }),
          get: (i) => ({ name: trim_string(zones[i].name.get()) }),
          set_ui: (i_zone) => [
            {
              type: "text",
              id: "name",
              name: t("name"),
              get: () => trim_string(zones[i_zone].name.get()),
              set: (val) => set_string(zones[i_zone].name, val, "\x00"),
            },
            {
              type: "table",
              id: "channels",
              name: t("channels"),
              size: () => zones[i_zone].channels.length,
              header: () => ({ name: { num: { name: t("channel_number") }, name: t("contact_name") } }),
              get: (i_contact) => {
                const ch_index = zones[i_zone].channels[i_contact].get();
                if (ch_index >= channels.length) return {};

                const ch = channels[ch_index];
                if (ch.type.get() > 1) return {};

                return { num: (ch_index + 1).toString(), name: trim_string(ch.name.get()) };
              },
              delete: (i_group) => {
                zones[i_zone].channels[i_group].set(0xffff);
              },
              set_ui: (i_channel) => {
                const ch_indexes: number[] = [];
                const ch_options: string[] = [];
                for (let ic = 0; ic < channels.length; ic += 1) {
                  const ch = channels[ic];
                  const type = ch.type.get();
                  if (type > 1) continue;

                  ch_indexes.push(ic);
                  ch_options.push(`${ic + 1}. ${trim_string(ch.name.get())}`);
                }

                if (zones[i_zone].channels[i_channel].get() === 0xffff) {
                  ch_indexes.unshift(0xffff);
                  ch_options.unshift(t("off"));
                }

                return [
                  {
                    type: "select",
                    id: "name",
                    name: t("channel"),
                    options: ch_options,
                    get: () => ch_indexes.indexOf(zones[i_zone].channels[i_channel].get()),
                    set: (val) => zones[i_zone].channels[i_channel].set(ch_indexes[val]),
                  },
                ];
              },
            },
          ],
        },

        // MARK: Contacts

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
            set_string(c.name, val.name, "\x00");
          },
          delete: (i) => {
            if (i === 0) throw new Error("Protected contact");
            const c = contacts[i];

            c.__raw.set(new Array(c.__raw.size).fill(0xff));
          },
        } as UI.Field.Contacts,

        // MARK: Keys

        {
          type: "table",
          id: "keys",
          name: "Encryption keys",
          tab: UITab.Encryption,
          size: () => keys.length,
          header: () => ({
            type: { name: t("encryption_type") },
            name: { name: t("name") },
          }),
          get: (i) => {
            const key = keys[i];
            const type = key.type.get();
            if (type > 4) return {};

            return {
              type: ENC_TYPE[type],
              name: trim_string(key.name.get()),
            };
          },
          delete: (i) => keys[i].__raw.set(new Array(keys[i].__raw.size).fill(0xff)),
          set_ui: (i) => [
            {
              type: "text",
              id: "name",
              name: t("name"),
              get: () => trim_string(keys[i].name.get()),
              set: (val) => set_string(keys[i].name, val, "\x00"),
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

        // MARK: TG Lists

        {
          type: "table",
          id: "tg_lists",
          name: t("tg_lists"),
          tab: UITab.TGLists,
          size: () => tg_lists.length,
          header: () => ({ name: { name: t("name") } }),
          get: (i) => ({ name: trim_string(tg_lists[i].name.get()) }),
          set_ui: (i_list) => [
            {
              type: "text",
              id: "name",
              name: t("name"),
              get: () => trim_string(tg_lists[i_list].name.get()),
              set: (val) => set_string(tg_lists[i_list].name, val, "\x00"),
            },
            {
              type: "table",
              id: "groups",
              name: t("dmr_groups"),
              size: () => tg_lists[i_list].contacts.length,
              header: () => ({ name: { name: t("contact_name") }, id: { name: t("id") } }),
              get: (i_contact) => {
                const contact_index = tg_lists[i_list].contacts[i_contact].get();
                if (contact_index >= contacts.length) return {};

                const contact = contacts[contact_index];
                if (contact.type.get() !== CONTACT_GROUP) return {};

                return { name: trim_string(contact.name.get()), id: contact.id.get().toString() };
              },
              delete: (i_group) => {
                tg_lists[i_list].contacts[i_group].set(0xffff);
              },
              set_ui: (i_group) => {
                const contact_indexes: number[] = [];
                const contact_options: string[] = [];
                for (let ic = 1; ic < contacts.length; ic += 1) {
                  const contact = contacts[ic];
                  const type = contact.type.get();
                  if (type > 2) break;
                  if (type !== CONTACT_GROUP) continue;

                  contact_indexes.push(ic);
                  contact_options.push(trim_string(contact.name.get()));
                }

                if (tg_lists[i_list].contacts[i_group].get() === 0xffff) {
                  contact_indexes.unshift(0xffff);
                  contact_options.unshift(t("off"));
                }

                return [
                  {
                    type: "select",
                    id: "name",
                    name: t("contact_name"),
                    options: contact_options,
                    get: () => contact_indexes.indexOf(tg_lists[i_list].contacts[i_group].get()),
                    set: (val) => tg_lists[i_list].contacts[i_group].set(contact_indexes[val]),
                  },
                ];
              },
            },
          ],
        },

        // MARK: Settings

        common_ui.device_name(settings.name, { pad: "\x00" }),
        common_ui.hello_mode(
          {
            get: () => (settings.start_text_sw.get() === 1 ? 0b01 : 0) | (settings.start_pic_ws.get() === 1 ? 0b10 : 0),
            set: (val) => {
              settings.start_text_sw.set(val & 0b01 ? 1 : 0);
              settings.start_pic_ws.set(val & 0b10 ? 1 : 0);
            },
          },
          {
            options: [
              t("hello_blank"),
              t("hello_text"),
              t("hello_picture"),
              `${t("hello_text")} + ${t("hello_picture")}`,
            ],
          }
        ),
        common_ui.hello_msg_str_x(settings.start_text, { line: 0, pad: "\x00" }),
        common_ui.voice_prompt(settings.voice_prompt),
        common_ui.beep(settings.key_beep),
        common_ui.backlight_brightness(settings.backlight_brightness, { min: 0, max: 4 }),
        common_ui.backlight_timeout(settings.backlight_timer, {
          min: 0,
          max: TIMER.length - 1,
          seconds: TIMER,
          names: { 0: t("off") },
        }),
        common_ui.pow_battery_save_ratio(settings.save_mode, { max: 3 }),
        common_ui.alarm_mode(settings.alarm, { options: [t("alarm_site"), t("alarm_tone"), t("alarm_both")] }),
        common_ui.dmr_radio_id(settings.radio_id),
        common_ui.dual_watch(settings2.dual_watch),
        common_ui.scan_mode(settings.scan_mode, { options: [t("scan_time"), t("scan_carrier"), t("scan_search")] }),
        common_ui.key_side_short_x_fn(settings2.keys.fs1_short, { key: "1", functions: KEY_FN }),
        common_ui.key_side_long_x_fn(settings2.keys.fs1_short, { key: "1", functions: KEY_FN }),
        common_ui.key_side_short_x_fn(settings2.keys.fs2_short, { key: "2", functions: KEY_FN }),
        common_ui.key_side_long_x_fn(settings2.keys.fs2_short, { key: "2", functions: KEY_FN }),
        common_ui.key_x_fn(settings2.keys.pad_0, { key: "0", functions: KEY_FN }),
        common_ui.key_x_fn(settings2.keys.pad_1, { key: "1", functions: KEY_FN }),
        common_ui.key_x_fn(settings2.keys.pad_2, { key: "2", functions: KEY_FN }),
        common_ui.key_x_fn(settings2.keys.pad_3, { key: "3", functions: KEY_FN }),
        common_ui.key_x_fn(settings2.keys.pad_4, { key: "4", functions: KEY_FN }),
        common_ui.key_x_fn(settings2.keys.pad_5, { key: "5", functions: KEY_FN }),
        common_ui.key_x_fn(settings2.keys.pad_6, { key: "6", functions: KEY_FN }),
        common_ui.key_x_fn(settings2.keys.pad_7, { key: "7", functions: KEY_FN }),
        common_ui.key_x_fn(settings2.keys.pad_8, { key: "8", functions: KEY_FN }),
        common_ui.key_x_fn(settings2.keys.pad_9, { key: "9", functions: KEY_FN }),
        common_ui.rtone_inout(settings.tone, { min: 110, max: 20_000 }),
        common_ui.roger_beep_select(settings.tx_beep_end, {
          options: [t("off"), `${t("roger_beep_roger")} 1`, `${t("roger_beep_roger")} 2`, "Radio Name"],
        }),
        this._dmr_ui(
          common_ui.roger_beep_select(settings.tx_beep_end, {
            options: [t("off"), `${t("roger_beep_roger")} 1`, `${t("roger_beep_roger")} 2`],
          })
        ),
        common_ui.sql(settings.sql, { min: 0, max: 10 }),
        this._dmr_ui(common_ui.sql(settings.sql_dig, { min: 0, max: 10 })),
        common_ui.mic_gain(settings.mic_gain, { min: 0, max: 31 }),
        this._dmr_ui(common_ui.mic_gain(settings.mic_gain_dig, { min: 0, max: 24 })),
        common_ui.spk_gain(settings.spk_gain, { min: 0, max: 63 }),
        this._dmr_ui(common_ui.spk_gain(settings.spk_gain_dig, { min: 0, max: 24 })),
        common_ui.spectrum_freq(
          { get: () => settings2.spec_freq.get() * 10, set: (val) => settings2.spec_freq.set(val / 10) },
          { min: 18_000_000, max: 999_999_999 }
        ),
        common_ui.spectrum_step(settings2.spec_step, { min: 10, max: 5_000_000 }),
        common_ui.spectrum_rssi_treshold(settings2.spec_rssi, { min: 0, max: 255 }),

        // MARK: DTMF

        common_ui.dtmf_remote_control(dtmf.remote_control),
        common_ui.dtmf_send_on(dtmf.send_mode, { options: ["Off", "Begin", "End", "BeginAndEnd"] }),
        {
          ...common_ui.dtmf_send_id(dtmf.send_select, { options: DTMF.slice(0, 16) }),
          name: t("id"),
          description: undefined,
        },
        {
          type: "table",
          id: "dtmf",
          name: "DTMF",
          tab: UITab.DTMF,
          size: () => dtmf.list.length,
          header: () => ({ fn: { name: "Function" }, code: { name: "Code" } }),
          get: (i) => {
            const d = dtmf_list[i];
            return { fn: DTMF[i], code: trim_string(d.code.get()) };
          },
          set_ui: (i) => [
            { type: "label", id: "fn", name: "Function", get: () => DTMF[i] },
            {
              type: "text",
              id: "code",
              name: "Code",
              get: () => trim_string(dtmf_list[i].code.get()),
              set: (val) => set_string(dtmf_list[i].code, val.replaceAll(/[^0-9]+/g, "")),
            },
          ],
        },

        // MARK: FM

        {
          type: "table",
          id: "fm_list",
          name: t("fm"),
          description: t("fm_tooltip"),
          tab: t("fm"),
          size: () => fm.length,
          header: () => ({ freq: { name: t("frequency") }, name: { name: t("name") } }),
          get: (i) => {
            const freq = fm[i].freq.get();
            if (freq === 0xffff) return {};
            return { freq: (freq / 10).toFixed(1), name: trim_string(fm[i].name.get()) };
          },
          delete: (i) => fm[i].__raw.set(new Array(fm[i].__raw.size).fill(0xff)),
          set_ui: (i) => [
            {
              type: "text",
              id: "freq",
              name: t("frequency"),
              get: () => {
                const freq = fm[i].freq.get();
                if (freq === 0xffff) return "";
                return (freq / 10).toFixed(1);
              },
              set: (val) => fm[i].freq.set(Math.max(640, (Number.parseFloat(val) || 0) * 10)),
            },
            {
              type: "text",
              id: "name",
              name: t("name"),
              get: () => trim_string(fm[i].name.get()),
              set: (val) => set_string(fm[i].name, val, "\x00"),
            },
          ],
        },

        // MARK: Lock

        {
          type: "table",
          id: "locks",
          name: t("frequency_lock"),
          tab: UITab.Unlock,
          size: () => lock_ranges.length,
          header: () => ({ state: { name: t("status") }, start: { name: t("begin") }, end: { name: t("end") } }),
          get: (i) => ({
            state: LOCK[lock_ranges[i].type.get()],
            start: `${lock_ranges[i].start.get()} ${t("mhz")}`,
            end: `${lock_ranges[i].end.get()} ${t("mhz")}`,
          }),
          set_ui: (i) => [
            {
              type: "select",
              id: "state",
              name: t("status"),
              options: LOCK,
              get: () => lock_ranges[i].type.get(),
              set: (val) => lock_ranges[i].type.set(val),
            },
            {
              type: "text",
              id: "start",
              name: t("begin"),
              suffix: t("mhz"),
              get: () => lock_ranges[i].start.get().toString(),
              set: (val) => lock_ranges[i].start.set(Math.max(18, Math.min(1_000, Number.parseInt(val) || 0))),
            },
            {
              type: "text",
              id: "end",
              name: t("end"),
              suffix: t("mhz"),
              get: () => lock_ranges[i].end.get().toString(),
              set: (val) => lock_ranges[i].end.set(Math.max(18, Math.min(1_000, Number.parseInt(val) || 0))),
            },
          ],
        },
      ],
    };
  }

  // MARK: Serial

  protected async _prog_mode_on() {
    await serial.write(PROG_CMD);

    const prog_ack = await serial.read(1);
    if (!prog_ack.equals(PROG_ACK)) throw new Error("Prog mode not ack");
  }

  protected async _prog_mode_off() {
    await serial.write(END_CMD);
  }

  protected async _read_block(number: number) {
    const cmd = Buffer.alloc(4);
    cmd.writeUInt8(0x52, 0);
    cmd.writeUInt16BE(number, 1);
    cmd.writeUInt8(checksum(cmd.slice(0, 3)), 3);

    await serial.write(cmd);

    const res = await serial.read(1028);
    if (!res.slice(0, 3).equals(cmd.slice(0, 3))) throw new Error("Unexpected header");
    if (res[1027] !== checksum(res.slice(0, -1))) throw new Error("Checksum error");

    const data = res.slice(3, 3 + 1024);

    return data;
  }

  protected async _write_block(cmd_code: number, number: number, data: Buffer) {
    const cmd = Buffer.alloc(1028);
    cmd.writeUInt8(cmd_code, 0);
    cmd.writeUInt16BE(number, 1);
    data.copy(cmd, 3);
    cmd.writeUInt8(checksum(cmd.slice(0, 1027)), 1027);

    await serial.write(cmd);

    const res = await serial.read(1, { timeout: TIMEOUT_WRITE });
    if (!res.equals(PROG_ACK)) throw new Error("Unexpected response code");
  }

  async load(snapshot: Buffer) {
    const mem = this._parse_v3(snapshot);

    this._img = snapshot;
    this._mem = mem;

    this.dispatch_ui_change();
  }

  async read() {
    this.dispatch_progress(0);

    this._img = undefined;
    this._mem = undefined;
    this.dispatch_ui_change();

    await serial.begin({ baudRate: 115_200 });
    await serial.clear();

    await this._prog_mode_on();

    this.dispatch_progress(0.1);

    const img = Buffer.alloc(MEM_SIZE);

    for (const range of READ) {
      const start_number = range.offset / 1024;

      for (let i = 0; i <= range.size; i += 1) {
        const block_number = start_number + i;
        const block = await this._read_block(block_number);

        const addr = block_number * 1024;
        block.copy(img, addr);

        this.dispatch_progress(0.1 + 0.8 * ((addr + 1024) / MEM_SIZE));
      }
    }

    await this._prog_mode_off();

    await this.load(img);

    this.dispatch_progress(1);
  }

  async write() {
    const img = this._img;
    if (!img) throw new Error("Image is empty");

    this.dispatch_progress(0);

    await serial.begin({ baudRate: 115_200 });
    await serial.clear();

    await this._prog_mode_on();

    await this._read_block(0); // initial block
    const cfg_block = await this._read_block(8);

    img.writeUInt8(0xff, 14);
    img.writeUInt8(0xff, 15);
    cfg_block.slice(960, 1024).copy(img, ADDR_CFG + 960);

    this.dispatch_progress(0.1);

    for (const range of WRITE) {
      for (let i = 0; i < range.size; i += 1) {
        const offset = range.offset + i * 1024;
        const block = img.slice(offset, offset + 1024);
        await this._write_block(range.cmd, i, block);

        this.dispatch_progress(0.1 + 0.8 * ((offset + 1024) / MEM_SIZE));
      }
    }

    await this._prog_mode_off();

    this.dispatch_progress(1);
  }
}
