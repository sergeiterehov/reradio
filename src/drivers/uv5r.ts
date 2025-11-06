import { Buffer } from "buffer";
import { Radio, type RadioInfo } from "./radio";
import type { UI } from "./ui";
import { array_of, create_mem_mapper, dup } from "./mem";
import { common_ui } from "./common_ui";

const INDENT_291 = Buffer.from([0x50, 0xbb, 0xff, 0x20, 0x12, 0x07, 0x25]);
const INDENT_5R = Buffer.from([0x50, 0xbb, 0xff, 0x01, 0x25, 0x98, 0x4d]);

const ACK = Buffer.from([0x06]);

export class UV5RRadio extends Radio {
  static Info: RadioInfo = {
    vendor: "Baofeng",
    model: "UV-5R",
  };

  protected readonly _indents = [INDENT_291, INDENT_5R];
  protected readonly MEM_SIZE = 0x1800;
  protected readonly BLOCK_SIZE = 0x40;

  protected _img?: Buffer;
  protected _mem?: ReturnType<typeof this._parse>;

  protected _parse(img: Buffer) {
    const m = create_mem_mapper(img, this.dispatch_ui);

    return {
      ...m.seek(0x0000).skip(0, {}),
      memory: array_of(128, () => ({
        rxfreq: m.lbcd(4),
        txfreq: m.lbcd(4),
        rxtone: m.u16(),
        txtone: m.u16(),
        ...m.bitmap({
          unused1: 3,
          isuhf: 1,
          scode: 4,
        }),
        ...m.bitmap({
          unknown1: 7,
          txtoneicon: 1,
        }),
        ...m.bitmap({ mailicon: 3, unknown2: 3, lowpower: 2 }),
        ...m.bitmap({
          unknown3: 1,
          wide: 1,
          unknown4: 2,
          bcl: 1,
          scan: 1,
          pttid: 2,
        }),
      })),

      ...m.seek(0x0b08).skip(0, {}),
      pttid: array_of(15, () => ({
        code: m.u8_array(5),
        unused: m.u8_array(11),
      })),

      ...m.seek(0x0e28).skip(0, {}),
      settings: {
        squelch: m.u8(),
        step: m.u8(),
        unknown1: m.u8(),
        save: m.u8(),
        vox: m.u8(),
        unknown2: m.u8(),
        abr: m.u8(),
        tdr: m.u8(),
        beep: m.u8(),
        timeout: m.u8(),
        unknown3: m.u8_array(4),
        voice: m.u8(),
        unknown4: m.u8(),
        dtmfst: m.u8(),
        unknown5: m.u8(),
        ...m.bitmap({
          unknown12: 6,
          screv: 2,
        }),
        pttid: m.u8(),
        pttlt: m.u8(),
        mdfa: m.u8(),
        mdfb: m.u8(),
        bcl: m.u8(),
        /**
         * The UV-6 calls this byte voxenable, but the UV-5R calls it autolk.
         * Since this is a minor difference, it will be referred to by the wrong name for the UV-6.
         */
        autolk: m.u8(),
        sftd: m.u8(),
        unknown6: m.u8_array(3),
        wtled: m.u8(),
        rxled: m.u8(),
        txled: m.u8(),
        almod: m.u8(),
        band: m.u8(),
        tdrab: m.u8(),
        ste: m.u8(),
        rpste: m.u8(),
        rptrl: m.u8(),
        ponmsg: m.u8(),
        roger: m.u8(),
        rogerrx: m.u8(),
        /**
         * The UV-82HP calls this byte rtone, but the UV-6 calls it tdrch.
         * Since this is a minor difference, it will be referred to by the wrong name for the UV-82HP.
         */
        tdrch: m.u8(),
        ...m.bitmap({ displayab: 1, unknown7: 2, fmradio: 1, alarm: 1, unknown8: 1, reset: 1, menu: 1 }),
        ...m.bitmap({ unknown9: 6, singleptt: 1, vfomrlock: 1 }),
        workmode: m.u8(),
        keylock: m.u8(),
      },

      ...m.seek(0x1008).skip(0, {}),
      names: array_of(128, () => ({
        name: m.str(7),
        unknown2: m.u8_array(9),
      })),
    };
  }

  override ui(): UI.Root {
    const mem = this._mem;

    if (!mem) return { fields: [] };

    return {
      fields: [
        {
          ...common_ui.channels({ size: mem.memory.length }),
          channel: { get: (i) => mem.names[i].name.get().replaceAll("\xFF", "").trim() || `CH-${i + 1}` },
          empty: {
            get: (i) => mem.memory[i].rxfreq.raw.get(0) === 0xff,
            // TODO: empty methods
          },
          freq: {
            get: (i) => mem.memory[i].rxfreq.get() * 10,
            set: (i, val) => mem.memory[i].rxfreq.set(val / 10),
          },
        },
      ],
    };
  }

  protected async _read_ident() {
    for (const indent of this._indents) {
      console.log("Try ident:", indent.toString("hex"));

      for (let i = 0; i < indent.length; i += 1) {
        await this._serial_write(indent.slice(i, i + 1));
        await new Promise((r) => setTimeout(r, 10));
      }

      const ack = await this._serial_read(1);
      if (!ack.equals(ACK)) throw new Error("Identification rejected");

      await this._serial_write(Buffer.from([0x02]));

      const response = await this._serial_read(8);

      console.log("Response:", response.toString("hex"));

      await this._serial_write(ACK);
      const ack2 = await this._serial_read(1);
      if (!ack2.equals(ACK)) throw new Error("Identification ACK rejected");

      return response;
    }

    throw new Error("Radio is undefined");
  }

  protected async _read_block(addr: number, size: number, first = false) {
    const cmd = Buffer.alloc(4);
    cmd.write("S", 0);
    cmd.writeUInt16BE(addr, 1);
    cmd.writeUInt8(size, 3);

    await this._serial_write(cmd);

    if (!first) {
      const ack = await this._serial_read(1);
      if (!ack.equals(ACK)) throw new Error("Refused NOT first block reading");
    }

    const expect_answer = Buffer.from(cmd);
    expect_answer.write("X", 0);

    const answer = await this._serial_read(4);
    if (!answer.equals(expect_answer)) throw new Error("Invalid answer when reading");

    const data = await this._serial_read(size);

    await this._serial_write(Buffer.from([0x06]));
    await new Promise((r) => setTimeout(r, 50));

    return data;
  }

  protected async _write_block(addr: number, data: Buffer) {
    const cmd = Buffer.alloc(4);
    cmd.write("X", 0);
    cmd.writeUInt16BE(addr, 1);
    cmd.writeUInt8(data.length, 3);

    await this._serial_write(Buffer.concat([cmd, data]));

    await new Promise((r) => setTimeout(r, 50));

    const ack = await this._serial_read(1);
    if (!ack.equals(ACK)) throw new Error(`Refused to access block 0x${addr.toString(16)}`);
  }

  override async load(snapshot: Buffer) {
    const mem = this._parse(snapshot);

    this._img = snapshot;
    this._mem = mem;
    this.dispatch_ui();
  }

  override async read(onProgress: (k: number) => void) {
    onProgress(0);

    await this._serial_read(128, { timeout: 100 }).catch(() => null);

    const ident = await this._read_ident();

    const block0 = await this._read_block(0x1e80, this.BLOCK_SIZE, true);
    const block1 = await this._read_block(0x1ec0, this.BLOCK_SIZE);
    const block2 = await this._read_block(0x1fc0, this.BLOCK_SIZE);

    const version = block1.slice(48, 62);
    console.log("Firmware:", version.toString("ascii"));

    const chunks: Buffer[] = [];

    onProgress(0.1);

    for (let i = 0; i < this.MEM_SIZE; i += this.BLOCK_SIZE) {
      const chunk = await this._read_block(i, this.BLOCK_SIZE);
      chunks.push(chunk);

      onProgress(0.1 + 0.8 * (i / this.MEM_SIZE));
    }

    const img = Buffer.concat(chunks);
    this.load(img);

    onProgress(1);
  }
}
