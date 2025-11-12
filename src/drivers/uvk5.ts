import { Buffer } from "buffer";
import { Radio, type RadioInfo } from "./radio";
import type { UI } from "./ui";
import { array_of, create_mem_mapper, to_js, type M } from "./mem";
import { common_ui, modify_field, UITab } from "./common_ui";
import { CTCSS_TONES, DCS_CODES, download_buffer } from "./utils";

const CRC16_TABLE = new Uint16Array([
  0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50a5, 0x60c6, 0x70e7, 0x8108, 0x9129, 0xa14a, 0xb16b, 0xc18c, 0xd1ad,
  0xe1ce, 0xf1ef, 0x1231, 0x0210, 0x3273, 0x2252, 0x52b5, 0x4294, 0x72f7, 0x62d6, 0x9339, 0x8318, 0xb37b, 0xa35a,
  0xd3bd, 0xc39c, 0xf3ff, 0xe3de, 0x2462, 0x3443, 0x0420, 0x1401, 0x64e6, 0x74c7, 0x44a4, 0x5485, 0xa56a, 0xb54b,
  0x8528, 0x9509, 0xe5ee, 0xf5cf, 0xc5ac, 0xd58d, 0x3653, 0x2672, 0x1611, 0x0630, 0x76d7, 0x66f6, 0x5695, 0x46b4,
  0xb75b, 0xa77a, 0x9719, 0x8738, 0xf7df, 0xe7fe, 0xd79d, 0xc7bc, 0x48c4, 0x58e5, 0x6886, 0x78a7, 0x0840, 0x1861,
  0x2802, 0x3823, 0xc9cc, 0xd9ed, 0xe98e, 0xf9af, 0x8948, 0x9969, 0xa90a, 0xb92b, 0x5af5, 0x4ad4, 0x7ab7, 0x6a96,
  0x1a71, 0x0a50, 0x3a33, 0x2a12, 0xdbfd, 0xcbdc, 0xfbbf, 0xeb9e, 0x9b79, 0x8b58, 0xbb3b, 0xab1a, 0x6ca6, 0x7c87,
  0x4ce4, 0x5cc5, 0x2c22, 0x3c03, 0x0c60, 0x1c41, 0xedae, 0xfd8f, 0xcdec, 0xddcd, 0xad2a, 0xbd0b, 0x8d68, 0x9d49,
  0x7e97, 0x6eb6, 0x5ed5, 0x4ef4, 0x3e13, 0x2e32, 0x1e51, 0x0e70, 0xff9f, 0xefbe, 0xdfdd, 0xcffc, 0xbf1b, 0xaf3a,
  0x9f59, 0x8f78, 0x9188, 0x81a9, 0xb1ca, 0xa1eb, 0xd10c, 0xc12d, 0xf14e, 0xe16f, 0x1080, 0x00a1, 0x30c2, 0x20e3,
  0x5004, 0x4025, 0x7046, 0x6067, 0x83b9, 0x9398, 0xa3fb, 0xb3da, 0xc33d, 0xd31c, 0xe37f, 0xf35e, 0x02b1, 0x1290,
  0x22f3, 0x32d2, 0x4235, 0x5214, 0x6277, 0x7256, 0xb5ea, 0xa5cb, 0x95a8, 0x8589, 0xf56e, 0xe54f, 0xd52c, 0xc50d,
  0x34e2, 0x24c3, 0x14a0, 0x0481, 0x7466, 0x6447, 0x5424, 0x4405, 0xa7db, 0xb7fa, 0x8799, 0x97b8, 0xe75f, 0xf77e,
  0xc71d, 0xd73c, 0x26d3, 0x36f2, 0x0691, 0x16b0, 0x6657, 0x7676, 0x4615, 0x5634, 0xd94c, 0xc96d, 0xf90e, 0xe92f,
  0x99c8, 0x89e9, 0xb98a, 0xa9ab, 0x5844, 0x4865, 0x7806, 0x6827, 0x18c0, 0x08e1, 0x3882, 0x28a3, 0xcb7d, 0xdb5c,
  0xeb3f, 0xfb1e, 0x8bf9, 0x9bd8, 0xabbb, 0xbb9a, 0x4a75, 0x5a54, 0x6a37, 0x7a16, 0x0af1, 0x1ad0, 0x2ab3, 0x3a92,
  0xfd2e, 0xed0f, 0xdd6c, 0xcd4d, 0xbdaa, 0xad8b, 0x9de8, 0x8dc9, 0x7c26, 0x6c07, 0x5c64, 0x4c45, 0x3ca2, 0x2c83,
  0x1ce0, 0x0cc1, 0xef1f, 0xff3e, 0xcf5d, 0xdf7c, 0xaf9b, 0xbfba, 0x8fd9, 0x9ff8, 0x6e17, 0x7e36, 0x4e55, 0x5e74,
  0x2e93, 0x3eb2, 0x0ed1, 0x1ef0,
]);

function crc16(data: Buffer): number {
  if (data.length === 0) return 0;

  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    const tableIndex = ((crc >> 8) ^ byte) & 0xff;
    crc = ((crc << 8) ^ CRC16_TABLE[tableIndex]) & 0xffff;
  }
  return crc;
}

const K5_XOR_ARRAY = [0x16, 0x6c, 0x14, 0xe6, 0x2e, 0x91, 0x0d, 0x40, 0x21, 0x35, 0xd5, 0x40, 0x13, 0x03, 0xe9, 0x80];

function xor_arr_mut(buffer: Buffer): Buffer {
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] ^= K5_XOR_ARRAY[i % K5_XOR_ARRAY.length];
  }

  return buffer;
}

const HEADER = Buffer.from([0xab, 0xcd]);
const FOOTER = Buffer.from([0xdc, 0xba]);

const SESSION_ID = Buffer.from([0x6a, 0x39, 0x57, 0x64]);

const HELLO_CMD = Buffer.from([0x14, 0x05]);
const READ_CMD = Buffer.from([0x1b, 0x05]);
const WRITE_CMD = Buffer.from([0x1d, 0x05]);

const READ_ACK = Buffer.from([0x1c, 0x05]);
const WRITE_ACK = Buffer.from([0x1e, 0x05]);

const FIRMWARE_UPDATE_MODE = Buffer.from([0x18, 0x05]);
const CONFIG_MODE = Buffer.from([0x15, 0x05]);

const CONFIG_MEM_SIZE = 0x2000;
const CONFIG_PROG_SIZE = 0x1d00;
const CONFIG_BLOCK_SIZE = 0x80;

class BaseUVK5Radio extends Radio {
  static Info: RadioInfo = {
    vendor: "Quansheng",
    model: "UV-K5",
  };

  baudRate = 38_400;

  protected async _send_buf(buf: Buffer) {
    // HEADER + length:16LE + xor_arr(data + crc(data):16LE) + FOOTER

    const p_header = 0;
    const p_length = p_header + HEADER.length;
    const p_data = p_length + 2;
    const p_crc = p_data + buf.length;
    const p_footer = p_crc + 2;

    const res_length = p_footer + FOOTER.length;

    const res = Buffer.alloc(res_length);

    HEADER.copy(res, p_header);

    res.writeUInt16LE(buf.length, p_length);

    buf.copy(res, p_data);
    res.writeUInt16LE(crc16(buf), p_crc);
    xor_arr_mut(res.slice(p_data, p_footer));

    FOOTER.copy(res, p_footer);

    await this._serial_write(res);
  }

  protected async _recv_buf() {
    const p_header = 0;
    const p_length = p_header + HEADER.length;

    const first_length = p_length + 2;

    const header_len = await this._serial_read(first_length, { timeout: 1_000 });

    const header = header_len.slice(p_header, p_length);
    const length = header_len.readUInt16LE(p_length);

    if (!HEADER.equals(header)) throw new Error("Header not found");

    const p_data = 0;
    const p_crc = p_data + length;
    const p_footer = p_crc + 2;

    const rest_length = p_footer + FOOTER.length;

    const data_crc_footer_obf = await this._serial_read(rest_length, { timeout: 3_000 });

    const footer = data_crc_footer_obf.slice(p_footer);
    const crc_obf = data_crc_footer_obf.readUInt16LE(p_crc);

    if (!FOOTER.equals(footer)) throw new Error("Footer is wrong");

    const data_crc = xor_arr_mut(Buffer.from(data_crc_footer_obf.slice(p_data, p_footer)));

    const data = data_crc.slice(p_data, p_crc);
    const crc = data_crc.readUInt16LE(p_crc);

    if (crc_obf != 0xffff && crc !== 0xffff) {
      const crc2 = crc16(data);

      if (crc2 !== crc) throw new Error("CRC is incorrect");
    }

    return data_crc;
  }

  protected async _hello() {
    const cmd = Buffer.alloc(HELLO_CMD.length + 2 + SESSION_ID.length);
    HELLO_CMD.copy(cmd, 0);
    cmd.writeUInt16LE(SESSION_ID.length, 2);
    SESSION_ID.copy(cmd, 4);

    await this._send_buf(cmd);
    const res = await this._recv_buf();

    const p_mode = 0;
    const p_unknown_0 = p_mode + 2;
    const p_version = p_unknown_0 + 2;
    const p_has_aes = p_version + 16;
    const p_is_lock_screen = p_has_aes + 1;
    const p_unknown_1 = p_is_lock_screen + 1;
    const p_m_challenge = p_unknown_1 + 2;
    const p_unknown_2 = p_m_challenge + 4;

    const mode = res.slice(p_mode, p_unknown_0);

    if (FIRMWARE_UPDATE_MODE.equals(mode)) throw new Error("Radio is in Firmware update mode");

    if (!CONFIG_MODE.equals(mode)) throw new Error("Unknown radio mode");

    const firmware_buf = res.slice(p_version, p_has_aes);

    return {
      firmware_version: firmware_buf.slice(0, firmware_buf.indexOf(0)).toString("ascii"),
      has_aes: res.readUInt8(p_has_aes),
      is_lock_screen: res.readUInt8(p_is_lock_screen),
      m_challenge: res.slice(p_m_challenge, p_unknown_2),
    };
  }

  protected async _read_block(addr: number, size: number) {
    const cmd = Buffer.alloc(2 + 2 + 2 + 2 + 4);
    READ_CMD.copy(cmd, 0);
    cmd.writeUInt16LE(8, 2);
    cmd.writeUInt16LE(addr, 4);
    cmd.writeUInt16LE(size, 6);
    SESSION_ID.copy(cmd, 8);

    await this._send_buf(cmd);
    const res = await this._recv_buf();

    const ack = res.slice(0, READ_ACK.length);
    if (!READ_ACK.equals(ack)) throw new Error("Unexpected ACK");

    if (res.readUInt16LE(6) !== size) throw new Error("Unexpected length confirmation");

    const data = res.slice(8, 8 + size);

    return data;
  }

  protected async _write_block(addr: number, data: Buffer) {
    const cmd = Buffer.alloc(2 + 2 + 2 + 1 + 1 + 4 + data.length);
    WRITE_CMD.copy(cmd, 0);
    cmd.writeUInt16LE(8 + data.length, 2);
    cmd.writeUInt16LE(addr, 4);
    cmd.writeUInt8(data.length, 6);
    cmd.writeUInt8(1, 7); // Allow password
    SESSION_ID.copy(cmd, 8);
    data.copy(cmd, 12);

    await this._send_buf(cmd);
    const res = await this._recv_buf();

    const ack = res.slice(0, WRITE_ACK.length);
    if (!WRITE_ACK.equals(ack)) throw new Error("Unexpected ACK");

    if (res.readUInt16LE(4) !== addr) throw new Error("Unexpected addr confirmation");
  }
}

const SHIFT_NONE = 0b00;
const SHIFT_PLUS = 0b01;
const SHIFT_MINUS = 0b10;

const SUB_TONE_FLAG_NONE = 0b00;
const SUB_TONE_FLAG_CTCSS = 0b01;
const SUB_TONE_FLAG_DCS_N = 0b10;
const SUB_TONE_FLAG_DCS_I = 0b11;

const PTT_ID_ON_OPTIONS: UI.ChannelPTTIdOn[] = ["Off", "Begin", "End", "Begin & End"];

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
  "None",
  "Flashlight on/off",
  "Power select",
  "Monitor",
  "Scan on/off",
  "VOX on/off",
  "Alarm on/off",
  "FM radio on/off",
  "Transmit 1750 Hz",
];

const trim_regexp = /[\x00\xff\x20]+$/;

export class UVK5Radio extends BaseUVK5Radio {
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
      channelname: array_of(200, () => ({ name: m.str(16) })),

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
        const type = config.flag_ref(i).get();

        if (type === SUB_TONE_FLAG_NONE) return { mode: "Off" };

        const code = config.code_ref(i).get();

        if (type === SUB_TONE_FLAG_CTCSS) return { mode: "CTCSS", freq: CTCSS_TONES[code] };

        return { mode: "DCS", code: DCS_CODES[code], polarity: type === SUB_TONE_FLAG_DCS_N ? "N" : "I" };
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

              return channelname.at(i)?.name.get().replace(trim_regexp, "") || `CH-${i + 1}`;
            },
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
                name.set("".padEnd(name.raw.size));
                channel_attributes[i].is_free.set(1);
              }
            },
            init: (i) => {
              const ch = channels[i];
              ch.__raw.set(Array(ch.__raw.size).fill(0x00));
              ch.freq.set(400_000_00);
              if (i < channel_attributes.length) {
                channel_attributes[i].is_free.set(0);
              }
            },
          },
          freq: {
            get: (i) => channels[i].freq.get() * 10,
            set: (i, val) => channels[i].freq.set(val / 10),
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
            options: ["NFM", "FM", "NAM", "AM"],
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
            name: (pow) => ["Low", "Medium", "Height"][pow] || "unknown",
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
            get: (i) => ({ id: "", on: PTT_ID_ON_OPTIONS[channels[i].dtmf_pttid.get()] }),
            set: (i, val) => channels[i].dtmf_pttid.set(PTT_ID_ON_OPTIONS.indexOf(val.on)),
          },
        },

        common_ui.beep(mem.beep_control),
        common_ui.voice_language(mem.keypad_tone, { languages: ["Off", "Chinese", "English"] }),
        common_ui.language(mem.keypad_tone, { languages: ["Chinese", "English"] }),
        modify_field(
          common_ui.hello_mode(mem.power_on_dispmode, { options: ["Blank", "Hello text", "Voltage"] }),
          (f) => ({
            ...f,
            set: (...args) => {
              f.set(...args);
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
        common_ui.keypad_lock(mem.auto_keypad_lock),
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
        common_ui.dw_priority_ab(mem.dual_watch),
        common_ui.alarm_mode(mem.alarm_mode, { options: ["Site - only speaker", "Tone - transmit"] }),
        common_ui.roger_beep_select(mem.reminding_of_end_talk, { options: ["Off", "Roger", "MDC"] }),

        {
          type: "select",
          id: "flock",
          name: "Frequency lock",
          tab: UITab.Unlock,
          options: [
            "Off",
            "FCC: Restricts operation to U.S. FCC-approved bands and power levels.",
            "CE: Applies European Union frequency and emission limits.",
            "GB: Enforces United Kingdom-specific regulations.",
            "430: Restricts transmission to specific sub-bands within the 70 cm amateur band (430–440 MHz)",
            "438: Restricts transmission (438–440 MHZ)",
          ],
          get: () => mem.lock.flock.get(),
          set: (val) => mem.lock.flock.set(Number(val)),
        },
        common_ui.unlock_tx350(mem.lock.tx350),
        common_ui.unlock_en350(mem.lock.en350),
        common_ui.unlock_tx200(mem.lock.tx200),
        common_ui.unlock_tx500(mem.lock.tx500),
        common_ui.unlock_enscramble(mem.lock.enscramble),
      ],
    };
  }

  override async load(snapshot: Buffer) {
    const mem = this._parse(snapshot);

    this._img = snapshot;
    this._mem = mem;
    this.dispatch_ui_change();
  }

  override async read(onProgress: (k: number) => void) {
    onProgress(0);

    this._mem = undefined;
    this._img = undefined;
    this.dispatch_ui_change();

    await this._serial_clear();

    const info = await this._hello();

    console.log(info);

    onProgress(0.1);

    const img = Buffer.alloc(CONFIG_MEM_SIZE);

    for (let addr = 0; addr < CONFIG_MEM_SIZE; addr += CONFIG_BLOCK_SIZE) {
      const block = await this._read_block(addr, CONFIG_BLOCK_SIZE);

      block.copy(img, addr);

      onProgress(0.1 + 0.8 * (addr / CONFIG_MEM_SIZE));
    }

    onProgress(0.9);

    await this.load(img);

    onProgress(1);
  }

  override async write(onProgress: (k: number) => void) {
    const img = this._img;
    if (!img) throw new Error("No image");

    onProgress(0);

    await this._serial_clear();

    const info = await this._hello();

    console.log(info);

    onProgress(0.1);

    for (let addr = 0; addr < CONFIG_PROG_SIZE; addr += CONFIG_BLOCK_SIZE) {
      const block = img.slice(addr, addr + CONFIG_BLOCK_SIZE);

      await this._write_block(addr, block);

      onProgress(0.1 + 0.8 * (addr / CONFIG_PROG_SIZE));
    }

    onProgress(0.9);

    await this.load(img);

    onProgress(1);
  }
}
