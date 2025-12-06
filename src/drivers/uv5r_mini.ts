import { Buffer } from "buffer";
import { Radio, type RadioInfo } from "./radio";
import type { UI } from "@/utils/ui";
import { serial } from "@/utils/serial";
import { array_of, create_mem_mapper } from "@/utils/mem";

// Таблица шифрования (массив Buffer'ов)
const tblEncrySymbol: Buffer[] = [
  Buffer.from("BHT ", "ascii"),
  Buffer.from("CO 7", "ascii"),
  Buffer.from("A ES", "ascii"),
  Buffer.from(" EIY", "ascii"),
  Buffer.from("M PQ", "ascii"),
  Buffer.from("XN Y", "ascii"),
  Buffer.from("RVB ", "ascii"),
  Buffer.from(" HQP", "ascii"),
  Buffer.from("W RC", "ascii"),
  Buffer.from("MS N", "ascii"),
  Buffer.from(" SAT", "ascii"),
  Buffer.from("K DH", "ascii"),
  Buffer.from("ZO R", "ascii"),
  Buffer.from("C SL", "ascii"),
  Buffer.from("6RB ", "ascii"),
  Buffer.from(" JCG", "ascii"),
  Buffer.from("PN V", "ascii"),
  Buffer.from("J PK", "ascii"),
  Buffer.from("EK L", "ascii"),
  Buffer.from("I LZ", "ascii"),
];

function _crypto(symbolIndex: number, buffer: Buffer): Buffer {
  const tblEncryptSymbols = tblEncrySymbol[symbolIndex];
  let decBuffer = Buffer.alloc(0); // Изначально пустой буфер
  let index1 = 0;

  for (let index2 = 0; index2 < buffer.length; index2++) {
    const currentByte = buffer[index2];
    const keyByte = tblEncryptSymbols[index1];

    const boolEncryptChar =
      keyByte !== 32 &&
      currentByte !== 0 &&
      currentByte !== 255 &&
      currentByte !== keyByte &&
      currentByte !== (keyByte ^ 255);

    let outByte: number;
    if (boolEncryptChar) {
      outByte = currentByte ^ keyByte;
    } else {
      outByte = currentByte;
    }

    // Добавляем байт к результату
    decBuffer = Buffer.concat([decBuffer, Buffer.from([outByte])]);

    index1 = (index1 + 1) % 4;
  }

  return decBuffer;
}

export class UV5RMiniRadio extends Radio {
  static override Info: RadioInfo = {
    vendor: "Baofeng",
    model: "UV-5R Mini",
  };

  protected readonly _MEM_TOTAL = 0xA1C0;
  protected readonly _BLOCK_SIZE = 0x40;
  protected readonly _MEM_RANGES = [
    { addr: 0x0000, size: 0x8040 },
    { addr: 0x9000, size: 0x0040 },
    { addr: 0xA000, size: 0x01C0 },
  ];
  protected readonly _ANI_ADDR = 0xA000;
  protected readonly _PTT_ID_ADDR= 0xA020;

  protected readonly _PROG_CMD = Buffer.from("PROGRAMCOLORPROU", "ascii");
  protected readonly _PROG_ACK = Buffer.from([0x06]);
  protected readonly _READ_CMD = Buffer.from([0x52]);
  protected readonly _WRITE_CMD = Buffer.from("W", "ascii");
  protected readonly _WRITE_ACK = Buffer.from([0x06]);

  protected readonly _encryption = true;
  protected readonly _encryption_index = 1;
  protected readonly _channels = 999;

  protected _img?: Buffer;
  protected _mem?: ReturnType<typeof this._parse>;

  protected _parse(img: Buffer) {
    const m = create_mem_mapper(img, this.dispatch_ui);

    return {
      memory: array_of(this._channels, () => m.struct(() => ({
        rxfreq: m.lbcd(4),
        txfreq: m.lbcd(4),
        rxtone: m.u16(),
        txtone: m.u16(),
        scode: m.u8(),
        pttid: m.u8(),
        ...m.bitmap({_unknown7:2,
          scramble:2,
          _unknown8:2,
          lowpower:2}),
        ...m.bitmap({_unknown1:1,
          wide:1,
          sqmode:2,
          bcl:1,
          scan:1,
          _unknown2:1,
          fhss:1}),
        _unknown3: m.u8(),
        _unknown4: m.u8(),
        _unknown5: m.u8(),
        _unknown6: m.u8(),
        name: m.str(12),
        }))),
      
      ...m.seek(0x8000).skip(0, {}),

      vfo: array_of(2, () => m.struct(() => ({
              freq: m.u8_array(8),
              rxtone: m.u16(),
              txtone: m.u16(),
              _unknown0: m.u8(),
              bcl: m.u8(),
              ...m.bitmap({sftd:3,
                scode:5}),
              _unknown1: m.u8(),
              lowpower: m.u8(),
              ...m.bitmap({_unknown2:1,
                wide:1,
                _unknown3:5,
                fhss:1}),
              _unknown4: m.u8(),
              step: m.u8(),
              offset: m.u8_array(6),
              _unknown5: m.u8_array(2),
              sqmode: m.u8(),
              _unknown6: m.u8_array(3),
      }))),

      ...m.seek(0x9000).skip(0, {}),

      settings: m.struct(() => ({
        squelch: m.u8(),
        savemode: m.u8(),
        vox: m.u8(),
        backlight: m.u8(),
        dualstandby: m.u8(),
        tot: m.u8(),
        beep: m.u8(),
        voicesw: m.u8(),
        voice: m.u8(),
        sidetone: m.u8(),
        scanmode: m.u8(),
        pttid: m.u8(),
        pttdly: m.u8(),
        chadistype: m.u8(),
        chbdistype: m.u8(),
        bcl: m.u8(),
        autolock: m.u8(),
        alarmmode: m.u8(),
        alarmtone: m.u8(),
        _unknown1: m.u8(),
        tailclear: m.u8(),
        rpttailclear: m.u8(),
        rpttaildet: m.u8(),
        roger: m.u8(),
        a_or_b_selected: m.u8(),
        fmenable: m.u8(),
        ...m.bitmap({chbworkmode:4,
          chaworkmode:4}),
        keylock: m.u8(),
        powerondistype: m.u8(),
        tone: m.u8(),
        _unknown4: m.u8_array(2),
        voxdlytime: m.u8(),
        menuquittime: m.u8(),
        _unknown5: m.u8_array(2),
        dispani: m.u8(),
        _unknown11: m.u8_array(3),
        totalarm: m.u8(),
        _unknown6: m.u8_array(2),
        ctsdcsscantype: m.u8(),
        vfoscanmin: m.u16(),
        vfoscanmax: m.u16(),
        gpsw: m.u8(),
        gpsmode: m.u8(),
        key1short: m.u8(),
        _unknown7: m.u8(),
        key2short: m.u8(),
        _unknown8: m.u8_array(2),
        rstmenu: m.u8(),
        singlewatch: m.u8(),
        hangup: m.u8(),
        voxsw: m.u8(),
        gpstimezone: m.u8(),
        _unknown10: m.u8(),
        inputdtmf: m.u8(),
        gpsunits: m.u8(),
        pontime: m.u8(),
      })),

      ...m.seek(this._ANI_ADDR).skip(0, {}),

      ani: m.struct(() => ({
        code: m.u8_array(5),
        _unknown: m.u8(),
        ...m.bitmap({_unused1:6,
          aniid:2}),
        dtmfon: m.u8(),
        dtmfoff: m.u8(),
        separatecode: m.u8(),
        groupcallcode: m.u8(),
      })),

      ...m.seek(this._PTT_ID_ADDR).skip(0, {}),

      pttid: array_of(20, () => m.struct(() => ({
        code: m.u8_array(5),
        name: m.str(10),
        _unused: m.u8(),
      }))),

      upcode: m.struct(() => ({
        _unknown32: m.u8_array(32),
        code: m.u8_array(16),
      })),

      downcode: m.struct(() => ({
        code: m.u8_array(16),
      })),
    };
  }

  ui(): UI.Root {
    return { fields: [] };
  }

  protected async _indent() {
    await serial.write(this._PROG_CMD);

    const ack = await serial.read(this._PROG_ACK.length);
    if (!ack.equals(this._PROG_ACK)) throw new Error("Unexpected indent ACK");

    await serial.write(Buffer.from([0x46]));
    await serial.read(16);

    await serial.write(Buffer.from([0x4d]));
    await serial.read(15);

    await serial.write(
      Buffer.from([
        0x53, 0x45, 0x4e, 0x44, 0x21, 0x05, 0x0d, 0x01, 0x01, 0x01, 0x04, 0x11, 0x08, 0x05, 0x0d, 0x0d, 0x01, 0x11,
        0x0f, 0x09, 0x12, 0x09, 0x10, 0x04, 0x00,
      ])
    );
    await serial.read(1);
  }

  private _optional_crypto(data: Buffer) {
    if (!this._encryption) return data;

    return _crypto(this._encryption_index, data);
  }

  protected async _read_block(addr: number, size: number) {
    const cmd = Buffer.alloc(4);
    this._READ_CMD.copy(cmd, 0);
    cmd.writeUInt16BE(addr, 1);
    cmd.writeUInt8(size, 3);

    await serial.write(cmd);

    const res = await serial.read(4 + size);
    if (!res.slice(0, cmd.length).equals(cmd)) throw new Error("Unexpected response header");

    const data = this._optional_crypto(res.slice(4));

    return data;
  }

  protected async _write_block(addr: number, data: Buffer) {
    const cmd = Buffer.alloc(4 + data.length);
    this._WRITE_CMD.copy(cmd, 0);
    cmd.writeUInt16BE(addr, 1);
    cmd.writeUInt8(data.length, 3);
    this._optional_crypto(data).copy(cmd, 4);

    await serial.write(cmd);

    const ack = await serial.read(1);
    if (!ack.equals(this._WRITE_ACK)) throw new Error("Unexpected write ack");
  }

  override async load(snapshot: Buffer) {
    const mem = this._parse(snapshot);

    this._img = snapshot;
    this._mem = mem;
    this.dispatch_ui_change();
  }

  override async read() {
    this.dispatch_progress(0);

    this._img = undefined;
    this._mem = undefined;
    this.dispatch_ui_change();

    await serial.begin({ baudRate: 115_200 });
    await serial.clear();

    await this._indent();

    this.dispatch_progress(0.1);

    const img = Buffer.alloc(this._MEM_TOTAL);

    for (const range of this._MEM_RANGES) {
      for (let i = range.addr; i < range.addr + range.size; i += this._BLOCK_SIZE) {
        const block = await this._read_block(i, this._BLOCK_SIZE);
        block.copy(img, i);

        this.dispatch_progress(0.1 + 0.8 * i / img.length);
      }
    }

    const mem = this._parse(img);

    console.log(mem);

    this._img = img;
    this._mem = mem;
    this.dispatch_ui_change();

    this.dispatch_progress(1);
  }

  override async write() {
    const img = this._img;
    if (!img) throw new Error("No image");

    this.dispatch_progress(0);

    await serial.begin({ baudRate: 115_200 });
    await serial.clear();

    await this._indent();

    this.dispatch_progress(0.1);

    for (const range of this._MEM_RANGES) {
      for (let i = range.addr; i < range.addr + range.size; i += this._BLOCK_SIZE) {
        const block = img.slice(i, i + this._BLOCK_SIZE);
        await this._write_block(i, block);

        this.dispatch_progress(0.1 + 0.8 * i / img.length);
      }
    }

    this.dispatch_progress(1);
  }
}
