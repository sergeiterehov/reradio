import type { UI } from "@/utils/ui";
import { Radio, type RadioInfo } from "./radio";
import { serial } from "@/utils/serial";
import { Buffer } from "buffer";
import { common_ui } from "@/utils/common_ui";
import { array_of, create_mem_mapper, to_js, type M } from "@/utils/mem";
import { CTCSS_TONES, DCS_CODES, trim_string } from "@/utils/radio";
import { t } from "i18next";

const TYPE_DIGITAL = 0;
const TYPE_ANALOG = 1;

const MODE_SINGLE_SLOT = 0;
const MODE_DIRECT_DUAL = 1;

const SLOT_1 = 0;
const SLOT_2 = 1;

const ID_SELECT_RADIO = 0;
const ID_SELECT_CHANNEL = 1;

const TOT = [
  0, 5, 10, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345,
  360, 375, 390, 405, 420, 435, 450, 465, 480, 495, 510, 525, 540, 555, 570, 585, 600,
];

function checksum(buf: Buffer, offset: number = 0, length: number = buf.length) {
  let sum = 0;
  for (let i = 0; i < length; i += 1) sum = (sum + buf[offset + i]) % 256;
  return sum;
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
              contact: m.at(addr + 24, () => m.u16()), // 0=all-call, number
              encryption: m.at(addr + 26, () => m.u16()), // 0=none, number
              own_id: m.at(addr + 28, () => m.u32()), // 0=1, number
            },

            analog: {
              mode: m.at(addr + 0, () => m.u8()), // 0=fm, 1=am, 2=ssb
              band: m.at(addr + 3, () => m.u8()), // 0=wide, 1=narrow
              rx_tone: m.at(addr + 4, () => m.u16()),
              tx_tone: m.at(addr + 14, () => m.u16()),
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
              ch.type.set(TYPE_ANALOG);
            },
          },
          digital: {
            get: (i) => channels[i].type.get() === TYPE_DIGITAL,
            set: (i, val) => {
              const ch = channels[i];
              const prev = ch.type.get() === TYPE_DIGITAL;

              if (prev === val) return;

              for (const ref of Object.values(ch.digital)) ref.set(0);
              for (const ref of Object.values(ch.analog)) ref.set(0);

              ch.type.set(val ? TYPE_DIGITAL : TYPE_ANALOG);
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
          bcl: {
            get: (i) => {
              const ch = channels[i];
              return Boolean((ch.type.get() === TYPE_ANALOG ? ch.analog.bcl : ch.digital.bcl).get());
            },
            set: (i, val) => {
              const ch = channels[i];
              (ch.type.get() === TYPE_ANALOG ? ch.analog.bcl : ch.digital.bcl).set(val ? 1 : 0);
            },
          },

          mode: {
            options: ["NFM", "FM", "AM", "SSB"],
            get: (i) => {
              const mode = channels[i].analog.mode.get();
              const band = channels[i].analog.band.get();

              if (mode === 0 && band === 1) return 0;

              return mode + 1;
            },
            set: (i, val) => {
              if (val === 0) {
                channels[i].analog.mode.set(0);
                channels[i].analog.band.set(1);
              } else {
                channels[i].analog.mode.set(val - 1);
                channels[i].analog.band.set(0);
              }
            },
          },
          squelch_rx: this._get_squelch_ui((i) => channels[i].analog.rx_tone),
          squelch_tx: this._get_squelch_ui((i) => channels[i].analog.tx_tone),

          dmr_encryption: {
            keys: [
              { name: "", type: "Off" },
              // TODO: insert keys
            ],
            get: (i) => ({ key_index: channels[i].digital.encryption.get() }),
            set: (i, val) => channels[i].digital.encryption.set(val.key_index),
          },
          dmr_slot: {
            options: ["Slot-1", "Slot-2", "DualSlot"],
            get: (i) => {
              if (channels[i].digital.mode.get() === MODE_DIRECT_DUAL) return 2;
              return channels[i].digital.slot.get() === SLOT_2 ? 1 : 0;
            },
            set: (i, val) => {
              if (val === 2) {
                channels[i].digital.mode.set(MODE_DIRECT_DUAL);
              } else {
                channels[i].digital.mode.set(MODE_SINGLE_SLOT);
                channels[i].digital.slot.set(val === 0 ? SLOT_1 : SLOT_2);
              }
            },
          },
          dmr_color_code: {
            get: (i) => channels[i].digital.color_code.get(),
            set: (i, val) => channels[i].digital.color_code.set(val),
          },
          dmr_contact: {
            contacts: [
              { type: "Group", id: 16_777_215 },
              // TODO: insert contacts
            ],
            get: (i) => channels[i].digital.contact.get(),
            set: (i, val) => channels[i].digital.contact.set(val),
          },
          dmr_rx_list: {
            lists: [
              t("off"),
              // TODO: insert lists
            ],
            get: (i) => channels[i].digital.group.get(),
            set: (i, val) => channels[i].digital.group.set(val),
          },
          dmr_id: {
            from: ["Radio", "Channel"],
            get: (i) => {
              if (channels[i].digital.id_select.get() !== ID_SELECT_CHANNEL) return { from: "Radio" };
              return { from: "Channel", id: channels[i].digital.own_id.get() };
            },
            set: (i, val) => {
              if (val.from === "Radio") {
                channels[i].digital.id_select.set(ID_SELECT_RADIO);
              } else {
                channels[i].digital.id_select.set(ID_SELECT_CHANNEL);
                channels[i].digital.own_id.set(val.id);
              }
            },
          },

          extra: (i) =>
            channels[i].type.get() === TYPE_DIGITAL
              ? [
                  {
                    type: "switcher",
                    id: "dmr_monit",
                    name: "Monitoring",
                    options: ["Radio", "Channel"],
                    get: () => channels[i].digital.monit.get() === 1,
                    set: (val) => channels[i].digital.monit.set(val ? 1 : 0),
                  },
                ]
              : [],
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
    const mem = this._parse(snapshot);

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
