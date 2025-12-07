import type { UI } from "@/utils/ui";
import { Radio, type RadioInfo } from "./radio";
import { serial } from "@/utils/serial";
import { Buffer } from "buffer";
import { common_ui } from "@/utils/common_ui";
import { array_of, create_mem_mapper, to_js } from "@/utils/mem";
import { trim_string } from "@/utils/radio";
import { t } from "i18next";

const DCS_NO = [
  0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16, 17, 20, 21, 22, 23, 24, 25, 26, 27, 30, 31, 32, 33, 34, 35, 36,
  37, 40, 41, 42, 43, 44, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 60, 61, 62, 63, 64, 65, 66, 67, 70, 71, 72, 73,
  74, 75, 76, 77, 100, 101, 102, 103, 104, 105, 106, 107, 110, 111, 112, 113, 114, 115, 116, 117, 120, 121, 122, 123,
  124, 125, 126, 127, 130, 131, 132, 133, 134, 135, 136, 137, 140, 141, 142, 143, 144, 145, 146, 147, 150, 151, 152,
  153, 154, 155, 156, 157, 160, 161, 162, 163, 164, 165, 166, 167, 170, 171, 172, 173, 174, 175, 176, 177, 200, 201,
  202, 203, 204, 205, 206, 207, 210, 211, 212, 213, 214, 215, 216, 217, 220, 221, 222, 223, 224, 225, 226, 227, 230,
  231, 232, 233, 234, 235, 236, 237, 240, 241, 242, 243, 244, 245, 246, 247, 250, 251, 252, 253, 254, 255, 256, 257,
  260, 261, 262, 263, 264, 265, 266, 267, 270, 271, 272, 273, 274, 275, 276, 277, 300, 301, 302, 303, 304, 305, 306,
  307, 310, 311, 312, 313, 314, 315, 316, 317, 320, 321, 322, 323, 324, 325, 326, 327, 330, 331, 332, 333, 334, 335,
  336, 337, 340, 341, 342, 343, 344, 345, 346, 347, 350, 351, 352, 353, 354, 355, 356, 357, 360, 361, 362, 363, 364,
  365, 366, 367, 370, 371, 372, 373, 374, 375, 376, 377, 400, 401, 402, 403, 404, 405, 406, 407, 410, 411, 412, 413,
  414, 415, 416, 417, 420, 421, 422, 423, 424, 425, 426, 427, 430, 431, 432, 433, 434, 435, 436, 437, 440, 441, 442,
  443, 444, 445, 446, 447, 450, 451, 452, 453, 454, 455, 456, 457, 460, 461, 462, 463, 464, 465, 466, 467, 470, 471,
  472, 473, 474, 475, 476, 477, 500, 501, 502, 503, 504, 505, 506, 507, 510, 511, 512, 513, 514, 515, 516, 517, 520,
  521, 522, 523, 524, 525, 526, 527, 530, 531, 532, 533, 534, 535, 536, 537, 540, 541, 542, 543, 544, 545, 546, 547,
  550, 551, 552, 553, 554, 555, 556, 557, 560, 561, 562, 563, 564, 565, 566, 567, 570, 571, 572, 573, 574, 575, 576,
  577, 600, 601, 602, 603, 604, 605, 606, 607, 610, 611, 612, 613, 614, 615, 616, 617, 620, 621, 622, 623, 624, 625,
  626, 627, 630, 631, 632, 633, 634, 635, 636, 637, 640, 641, 642, 643, 644, 645, 646, 647, 650, 651, 652, 653, 654,
  655, 656, 657, 660, 661, 662, 663, 664, 665, 666, 667, 670, 671, 672, 673, 674, 675, 676, 677, 700, 701, 702, 703,
  704, 705, 706, 707, 710, 711, 712, 713, 714, 715, 716, 717, 720, 721, 722, 723, 724, 725, 726, 727, 730, 731, 732,
  733, 734, 735, 736, 737, 740, 741, 742, 743, 744, 745, 746, 747, 750, 751, 752, 753, 754, 755, 756, 757, 760, 761,
  762, 763, 764, 765, 766, 767, 770, 771, 772, 773, 774, 775, 776, 777,
];

const TOT = [
  0, 5, 10, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345,
  360, 375, 390, 405, 420, 435, 450, 465, 480, 495, 510, 525, 540, 555, 570, 585, 600,
];

function ArraySum(buf: Buffer, offset: number = 0, length: number = buf.length) {
  let sum = 0;
  for (let i = 0; i < length; i += 1) sum = (sum + buf[offset + i]) % 256;
  return sum;
}

function SetSubaudio(buf: Buffer) {
  let num = 0;
  num = buf[0] & 0xf;
  num <<= 8;
  num += buf[1];

  if ((buf[0] & 0xf0) == 16) {
    return num / 10 + "." + (num % 10);
  }
  if ((buf[0] & 0xf0) == 32) {
    return DCS_NO[num] + "N";
  }
  if ((buf[0] & 0x30) == 48) {
    return DCS_NO[num] + "I";
  }

  return "None";
}

export class RT4DRadio extends Radio {
  static override Info: RadioInfo = {
    vendor: "Radtel",
    model: "RT-4D",
  };

  protected readonly _PROG_CMD = Buffer.from([0x34, 0x52, 0x05, 0x10, 0x9b]);
  protected readonly _PROG_ACK = Buffer.from([0x06]);
  protected readonly _END_CMD = Buffer.from([0x34, 0x52, 0x05, 0xee, 0x79]);

  protected readonly _RANGES = [
    { start: 8, end: 12 }, // bufCFG
    { start: 16, end: 64 }, // bufAll
    { start: 112, end: 240 }, // bufZone
    { start: 368, end: 432 }, // bufContact
    { start: 496, end: 508 }, // bufGroupList
    { start: 520, end: 532 }, // bufEncrypt
    { start: 592, end: 788 }, // bufSMSData
    { start: 856, end: 857 }, // bufFM
  ];
  protected readonly _MEM_SIZE = 856 * 1024;

  protected _img?: Buffer;
  protected _mem?: ReturnType<typeof this._parse>;

  protected _parse(img: Buffer) {
    const m = create_mem_mapper(img, this.dispatch_ui);

    return {
      ...m.seek(0x4000).skip(0, {}),

      channels: array_of(1024, () =>
        m.struct(() => {
          const addr = m.addr;
          const channel = {
            type: m.at(addr + 2, () => m.u8()), // 0=digital, 1=analog, empty

            rx_freq: m.at(addr + 6, () => m.u32()),
            tx_freq: m.at(addr + 10, () => m.u32()),

            pow: m.at(addr + 16, () => m.u8()), // 0=low, 1=high
            ...m.at(addr + 19, () =>
              m.bitmap({
                scan_skip: 1, // 0=scan, 1=skip
                _: 7,
              })
            ),
            name: m.at(addr + 32, () => m.str(16)),

            digital: {
              id_select: m.at(addr + 0, () => m.u8()), // 0=radio_id, 1=channel_id, #0
              slot: m.at(addr + 3, () => m.u8()), // 0=1, 1=2, #0
              color_code: m.at(addr + 4, () => m.u8()), // 0..15, #0
              mode: m.at(addr + 5, () => m.u8()), // 0=dual-off, 1=direct-dual, #0
              monit: m.at(addr + 14, () => m.u8()), // 0=off, 1=on, #0
              bcl: m.at(addr + 17, () => m.u8()), // 0=allow-tx, 1=channel-free, 2=color-code-idle, #0
              tot: m.at(addr + 20, () => m.u8()), // TOT[], #0
              group: m.at(addr + 22, () => m.u16()), // 0=none, number
              contact: m.at(addr + 24, () => m.u16()), // 0=none, number
              encryption: m.at(addr + 26, () => m.u16()), // 0=none, number
              channel_id: m.at(addr + 28, () => m.u32()),
            },

            analog: {
              mode: m.at(addr + 0, () => m.u8()), // 0=fm, 1=am, 2=ssb
              band: m.at(addr + 3, () => m.u8()), // 0=wide, 1=narrow
              rx_tone: m.at(addr + 4, () => m.u8_array(2)),
              tx_tone: m.at(addr + 14, () => m.u8_array(2)),
              bcl: m.at(addr + 17, () => m.u8()), //0=allow-tx, 1=channel-free, 2=subtone-idle
              ...m.at(addr + 18, () =>
                m.bitmap({
                  ctdc: 3, // 0=normal, 1=encrypt1, 2=encrypt2, 3=encrypt3, 4=mute-code
                  tot: 5, // TOT[]
                })
              ),
              ...m.at(addr + 19, () =>
                m.bitmap({
                  _: 1,
                  tail_tone: 3, // 0=off, 1=55hz, 2=120-deg-shift, 3=180-deg-shift, 4=240-deg-shift
                  scramble: 4, // 0..8
                })
              ),
              mute1: m.at(addr + 20, () => m.u32()),
              _mute2: m.at(addr + 24, () => m.u32()), // unused
              _mute3: m.at(addr + 28, () => m.u32()), // unused
            },
          };

          m.seek(addr + 48);
          return channel;
        })
      ),
    };
  }

  ui(): UI.Root {
    const mem = this._mem;
    if (!mem) return { fields: [] };

    const { channels } = mem;

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
            },
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
            get: (i) => channels[i].pow.get(),
            set: (i, val) => channels[i].pow.set(val),
          },
          scan: {
            options: ["On", "Off"],
            get: (i) => channels[i].scan_skip.get(),
            set: (i, val) => channels[i].scan_skip.set(val),
          },

          // Analog

          mode: {
            options: ["FM", "AM", "SSB", "NFM"],
            get: (i) => {
              const mode = channels[i].analog.mode.get();
              const band = channels[i].analog.band.get();

              if (mode === 0 && band === 1) return 3;

              return mode;
            },
            set: (i, val) => {
              if (val === 3) {
                channels[i].analog.mode.set(0);
                channels[i].analog.band.set(1);
              } else {
                channels[i].analog.mode.set(val);
                channels[i].analog.band.set(0);
              }
            },
          },
        },
      ],
    };
  }

  protected async _read_block(addr: number) {
    const cmd = Buffer.alloc(4);
    cmd.writeUInt8(0x52, 0);
    cmd.writeUInt16BE(addr, 1);
    cmd.writeUInt8(ArraySum(cmd.slice(0, 3)), 3);

    await serial.write(cmd);

    const res = await serial.read(1028);
    if (!res.slice(0, 3).equals(cmd.slice(0, 3))) throw new Error("Unexpected header");
    if (res[1027] !== ArraySum(res.slice(0, -1))) throw new Error("Checksum error");

    const data = res.slice(3, 3 + 1024);

    return data;
  }

  async load(snapshot: Buffer) {
    const mem = this._parse(snapshot);

    this._img = snapshot;
    this._mem = mem;

    console.log(mem, to_js(mem));

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
      for (let i = range.start; i < range.end; i += 1) {
        const block = await this._read_block(i);

        const addr = i * 1024;
        block.copy(img, addr);

        this.dispatch_progress(0.1 + 0.8 * (addr / this._MEM_SIZE));
      }
    }

    await serial.write(this._END_CMD);

    this.dispatch_progress(1);
  }
}
