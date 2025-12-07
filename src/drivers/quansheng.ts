import { Buffer } from "buffer";
import { Radio, type RadioInfo } from "./radio";
import { hex } from "@/utils/radio";
import { serial } from "@/utils/serial";

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

const FIRMWARE_XOR_ARRAY = [
  0x47, 0x22, 0xc0, 0x52, 0x5d, 0x57, 0x48, 0x94, 0xb1, 0x60, 0x60, 0xdb, 0x6f, 0xe3, 0x4c, 0x7c, 0xd8, 0x4a, 0xd6,
  0x8b, 0x30, 0xec, 0x25, 0xe0, 0x4c, 0xd9, 0x00, 0x7f, 0xbf, 0xe3, 0x54, 0x05, 0xe9, 0x3a, 0x97, 0x6b, 0xb0, 0x6e,
  0x0c, 0xfb, 0xb1, 0x1a, 0xe2, 0xc9, 0xc1, 0x56, 0x47, 0xe9, 0xba, 0xf1, 0x42, 0xb6, 0x67, 0x5f, 0x0f, 0x96, 0xf7,
  0xc9, 0x3c, 0x84, 0x1b, 0x26, 0xe1, 0x4e, 0x3b, 0x6f, 0x66, 0xe6, 0xa0, 0x6a, 0xb0, 0xbf, 0xc6, 0xa5, 0x70, 0x3a,
  0xba, 0x18, 0x9e, 0x27, 0x1a, 0x53, 0x5b, 0x71, 0xb1, 0x94, 0x1e, 0x18, 0xf2, 0xd6, 0x81, 0x02, 0x22, 0xfd, 0x5a,
  0x28, 0x91, 0xdb, 0xba, 0x5d, 0x64, 0xc6, 0xfe, 0x86, 0x83, 0x9c, 0x50, 0x1c, 0x73, 0x03, 0x11, 0xd6, 0xaf, 0x30,
  0xf4, 0x2c, 0x77, 0xb2, 0x7d, 0xbb, 0x3f, 0x29, 0x28, 0x57, 0x22, 0xd6, 0x92, 0x8b,
];

function xor_firmware_arr_mut(buffer: Buffer): Buffer {
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] ^= FIRMWARE_XOR_ARRAY[i % FIRMWARE_XOR_ARRAY.length];
  }

  return buffer;
}

const _HEADER = Buffer.from([0xab, 0xcd]);
const _FOOTER = Buffer.from([0xdc, 0xba]);

export class QuanshengBaseRadio extends Radio {
  static Info: RadioInfo = {
    vendor: "Quansheng",
    model: "Unknown QUANSHENG Based",
  };

  static readonly Utils = {
    crc16,
    xor_arr_mut,
    xor_firmware_arr_mut,
  };

  _baudRate = 38_400;

  protected readonly _SESSION_ID = Buffer.from([0x6a, 0x39, 0x57, 0x64]);

  protected readonly _HELLO_CMD = Buffer.from([0x14, 0x05]);
  protected readonly _READ_CMD = Buffer.from([0x1b, 0x05]);
  protected readonly _WRITE_CMD = Buffer.from([0x1d, 0x05]);

  protected readonly _READ_ACK = Buffer.from([0x1c, 0x05]);
  protected readonly _WRITE_ACK = Buffer.from([0x1e, 0x05]);

  protected readonly _HELLO_FIRMWARE_ACK = Buffer.from([0x18, 0x05]);
  protected readonly _HELLO_CONFIG_ACK = Buffer.from([0x15, 0x05]);

  protected readonly _FIRMWARE_CMD = Buffer.from([0x30, 0x05]);
  protected readonly _FLASH_CMD = Buffer.from([0x19, 0x05]);
  protected readonly _REBOOT_CMD = Buffer.from([0xdd, 0x05]);

  protected readonly _FLASH_ACK = Buffer.from([0x1a, 0x05]);

  protected readonly _FLASH_SIZE = 0xf000;
  protected readonly _FLASH_BLOCK_SIZE = 0x100;

  protected async _send_buf(buf: Buffer) {
    // HEADER + length:16LE + xor_arr(data + crc(data):16LE) + FOOTER

    const p_header = 0;
    const p_length = p_header + _HEADER.length;
    const p_data = p_length + 2;
    const p_crc = p_data + buf.length;
    const p_footer = p_crc + 2;

    const res_length = p_footer + _FOOTER.length;

    const res = Buffer.alloc(res_length);

    _HEADER.copy(res, p_header);

    res.writeUInt16LE(buf.length, p_length);

    buf.copy(res, p_data);
    res.writeUInt16LE(crc16(buf), p_crc);
    xor_arr_mut(res.slice(p_data, p_footer));

    _FOOTER.copy(res, p_footer);

    console.log("QUANSHENG WRITE:", hex(buf));

    await serial.write(res);
  }

  protected async _recv_buf() {
    const p_header = 0;
    const p_length = p_header + _HEADER.length;

    const first_length = p_length + 2;

    const header_len = await serial.read(first_length, { timeout: 1_000 });

    const header = header_len.slice(p_header, p_length);
    const length = header_len.readUInt16LE(p_length);

    if (!_HEADER.equals(header)) throw new Error("Header not found");

    const p_data = 0;
    const p_crc = p_data + length;
    const p_footer = p_crc + 2;

    const rest_length = p_footer + _FOOTER.length;

    const data_crc_footer_obf = await serial.read(rest_length, { timeout: 3_000 });

    const footer = data_crc_footer_obf.slice(p_footer);
    const crc_obf = data_crc_footer_obf.readUInt16LE(p_crc);

    if (!_FOOTER.equals(footer)) throw new Error("Footer is wrong");

    const data_crc = xor_arr_mut(Buffer.from(data_crc_footer_obf.slice(p_data, p_footer)));

    const data = data_crc.slice(p_data, p_crc);
    const crc = data_crc.readUInt16LE(p_crc);

    if (crc_obf != 0xffff && crc !== 0xffff) {
      const crc2 = crc16(data);

      if (crc2 !== crc) throw new Error("CRC is incorrect");
    }

    console.log("QUANSHENG READ:", hex(data_crc));

    return data_crc;
  }

  protected async _hello() {
    const cmd = Buffer.alloc(this._HELLO_CMD.length + 2 + this._SESSION_ID.length);
    this._HELLO_CMD.copy(cmd, 0);
    cmd.writeUInt16LE(this._SESSION_ID.length, 2);
    this._SESSION_ID.copy(cmd, 4);

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

    if (this._HELLO_FIRMWARE_ACK.equals(mode)) throw new Error("Radio is in Firmware update mode");

    if (!this._HELLO_CONFIG_ACK.equals(mode)) throw new Error("Unknown radio mode");

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
    this._READ_CMD.copy(cmd, 0);
    cmd.writeUInt16LE(8, 2);
    cmd.writeUInt16LE(addr, 4);
    cmd.writeUInt16LE(size, 6);
    this._SESSION_ID.copy(cmd, 8);

    await this._send_buf(cmd);
    const res = await this._recv_buf();

    const ack = res.slice(0, this._READ_ACK.length);
    if (!this._READ_ACK.equals(ack)) throw new Error("Unexpected ACK");

    if (res.readUInt16LE(6) !== size) throw new Error("Unexpected length confirmation");

    const data = res.slice(8, 8 + size);

    return data;
  }

  protected async _write_block(addr: number, data: Buffer) {
    const cmd = Buffer.alloc(2 + 2 + 2 + 1 + 1 + 4 + data.length);
    this._WRITE_CMD.copy(cmd, 0);
    cmd.writeUInt16LE(8 + data.length, 2);
    cmd.writeUInt16LE(addr, 4);
    cmd.writeUInt8(data.length, 6);
    cmd.writeUInt8(1, 7); // Allow password
    this._SESSION_ID.copy(cmd, 8);
    data.copy(cmd, 12);

    await this._send_buf(cmd);
    const res = await this._recv_buf();

    const ack = res.slice(0, this._WRITE_ACK.length);
    if (!this._WRITE_ACK.equals(ack)) throw new Error("Unexpected ACK");

    if (res.readUInt16LE(4) !== addr) throw new Error("Unexpected addr confirmation");
  }

  protected async _send_firmware_message(version: Buffer) {
    const buf = Buffer.alloc(4 + 16);
    this._FIRMWARE_CMD.copy(buf, 0);
    buf.writeUInt16LE(16, 2);
    version.copy(buf, 4);

    await this._send_buf(buf);

    const started_at = Date.now();
    const timeout_at = started_at + 3_000;
    while (true) {
      if (Date.now() > timeout_at) throw new Error("Firmware version response timeout");

      const res = await this._recv_buf().catch(() => null);
      if (!res) continue;

      const mode = res.slice(0, 2);

      if (!this._HELLO_FIRMWARE_ACK.equals(mode)) continue;
      if (res.length !== 22 && res.length !== 38) continue;

      break;
    }
  }

  protected async _write_flash(addr: number, img: Buffer) {
    const max_block_addr = img.length & 0xff ? (img.length & 0xff00) + this._FLASH_BLOCK_SIZE : img.length;
    const chunk_size = Math.min(this._FLASH_BLOCK_SIZE, img.length - addr);

    const buf = Buffer.alloc(4 + 12 + this._FLASH_BLOCK_SIZE);
    this._FLASH_CMD.copy(buf, 0);
    buf.writeUInt16LE(12 + this._FLASH_BLOCK_SIZE, 2);
    Buffer.from([0x8a, 0x8d, 0x9f, 0x1d]).copy(buf, 4);
    buf.writeUInt16BE(addr, 8);
    buf.writeUInt16BE(max_block_addr, 10);
    buf.writeUInt16LE(chunk_size, 12);
    img.copy(buf, 16, addr, addr + chunk_size);

    await this._send_buf(buf);

    const started_at = Date.now();
    const timeout_at = started_at + 5_000;
    while (true) {
      if (Date.now() > timeout_at) throw new Error(`Flashing rejected 0x${addr.toString(16)}`);

      const res = await this._recv_buf().catch(() => null);

      if (!res) continue;
      if (res.length < 12) continue;
      if (!this._FLASH_ACK.equals(res.slice(0, this._FLASH_ACK.length)) || res[2] != 0x08 || res[3] != 0x00) continue;

      if (!res.slice(4, 10).equals(buf.slice(4, 10))) throw new Error("Flashing failed! Probably device is bricked.");

      break;
    }
  }

  protected async _read_bootloader_version() {
    const version = Buffer.alloc(17);

    const started_at = Date.now();
    const timeout_at = started_at + 3_000;
    while (true) {
      if (Date.now() > timeout_at) throw new Error("Radio is not in firmware updating mode");

      const chunk = await this._recv_buf().catch(() => null);
      if (!chunk) continue;

      const mode = chunk.slice(0, this._HELLO_FIRMWARE_ACK.length);
      if (!this._HELLO_FIRMWARE_ACK.equals(mode)) continue;

      console.log("Firmware updating mode: OK");

      if (chunk.length >= 36) {
        chunk.copy(version, 0, 20, 20 + 16);

        console.log(`Bootloader version: ${version.toString("ascii")}`);
      } else {
        console.log(`Bootloader version: unknown (short message)`);
      }

      break;
    }

    return version;
  }

  protected async _reboot() {
    const cmd = Buffer.alloc(4);
    this._REBOOT_CMD.copy(cmd, 0);

    await this._send_buf(cmd);
  }
}
