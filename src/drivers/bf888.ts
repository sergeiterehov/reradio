import { Buffer } from "buffer";
import { Radio, type RadioInfo } from "./radio";
import { array_of, create_mem_mapper, dup } from "./mem";
import type { UI } from "./ui";
import { ui_get_lbcd_squelch } from "./common";

const CMD_ACK = Buffer.from([0x06]);
const PROGRAM_CMD = Buffer.from("PROGRAM", "ascii");
const IDENT = [Buffer.from("P3107", "ascii")];
const BLOCK_SIZE = 0x08;
const MEM_SIZE = 0x03e0;

const Tab = {
  Channels: "Channels",
  Feedback: "Feedback",
  Scanning: "Scanning",
  VOX: "Voice Activation",
  Power: "Power Management",
  System: "System Settings",
};

export class BF888Radio extends Radio {
  static override Info: RadioInfo = {
    vendor: "Baofeng",
    model: "BF-888",
  };

  override baudRate = 9600;

  protected _parse(data: Buffer) {
    const m = create_mem_mapper(data, this.dispatch_ui);

    return {
      ...m.seek(0x0010).skip(0, {}),
      memory: array_of(16, () => ({
        rxfreq: m.lbcd(4),
        txfreq: m.lbcd(4),
        rxtone: m.lbcd(2),
        txtone: m.lbcd(2),
        ...m.bits("unknown3", "unknown2", "unknown1", "skip", "highpower", "narrow", "beatshift", "bcl"),
        unknown4: m.u8_array(3),
      })),
      ...m.seek(0x02b0).skip(0, {}),
      settings: {
        voiceprompt: m.u8(),
        voicelanguage: m.u8(),
        scan: m.u8(),
        vox: m.u8(),
        voxlevel: m.u8(),
        voxinhibitonrx: m.u8(),
        lowvolinhibittx: m.u8(),
        highvolinhibittx: m.u8(),
        alarm: m.u8(),
        fmradio: m.u8(),
      },
      ...m.seek(0x03c0).skip(0, {}),
      settings2: {
        ...m.bits(...dup(6, "unused"), "batterysaver", "beep"),
        squelchlevel: m.u8(),
        sidekeyfunction: m.u8(),
        timeouttimer: m.u8(),
        unused2: m.u8_array(3),
        ...m.bits(...dup(7, "unused3"), "scanmode"),
      },
    };
  }

  override ui(): UI.Root {
    if (!this._mem) return { fields: [] };

    const { memory, settings, settings2 } = this._mem;

    return {
      fields: [
        {
          type: "channels",
          id: "channels",
          name: "Channels",
          tab: Tab.Channels,
          size: 16,
          channel: { get: (i) => `CH${i + 1}` },
          freq: { get: (i) => memory[i].rxfreq.get() * 10, set: (i, val) => memory[i].rxfreq.set(val / 10) },
          offset: {
            get: (i) => (memory[i].txfreq.get() - memory[i].rxfreq.get()) * 10,
            set: (i, val) => memory[i].txfreq.set(memory[i].rxfreq.get() + val / 10),
          },
          mode: {
            options: ["FM", "NFM"],
            get: (i) => (memory[i].narrow.get() ? "NFM" : "FM"),
            set: (i, val) => memory[i].narrow.set(val === "NFM" ? 1 : 0),
          },
          squelch_rx: ui_get_lbcd_squelch((i) => memory[i].rxtone),
          squelch_tx: ui_get_lbcd_squelch((i) => memory[i].txtone),
          power: {
            options: [1, 5],
            name: (val) => (val < 5 ? "Low" : "Height"),
            get: (i) => (memory[i].highpower.get() ? 5 : 1),
            set: (i, val) => memory[i].highpower.set(val === 5 ? 1 : 0),
          },
          scan: {
            options: ["Off", "On"],
            get: (i) => (memory[i].skip.get() ? "Off" : "On"),
            set: (i, val) => memory[i].skip.set(val === "Off" ? 1 : 0),
          },
          get: () => null,
          set: () => null,
        },

        // Tab.Feedback
        {
          type: "switcher",
          id: "alarm",
          name: "Alarm",
          description: "Loud, repeating alert tone to get attention.",
          tab: Tab.Feedback,
          get: () => settings.alarm.get(),
          set: (val) => settings.alarm.set(val ? 1 : 0),
        },
        {
          type: "switcher",
          id: "beep",
          name: "Beep",
          description: "Short audible tone when pressing buttons.",
          tab: Tab.Feedback,
          get: () => settings2.beep.get(),
          set: (val) => settings2.beep.set(val ? 1 : 0),
        },
        {
          type: "switcher",
          id: "voice_prompt",
          name: "Voice prompt",
          description: "Plays spoken confirmation when changing channels or pressing buttons.",
          tab: Tab.Feedback,
          get: () => settings.voiceprompt.get(),
          set: (val) => settings.voiceprompt.set(val ? 1 : 0),
        },
        {
          type: "select",
          id: "lang",
          name: "Voice language",
          description: "Language used for voice prompts.",
          tab: Tab.Feedback,
          options: ["English", "Chinese"],
          get: () => settings.voicelanguage.get(),
          set: (val) => settings.voicelanguage.set(Number(val)),
        },

        // Tab.Scan
        {
          type: "switcher",
          id: "scan",
          name: "Scan",
          description: "Automatically checks channels for activity and stops on active ones.",
          tab: Tab.Scanning,
          get: () => settings.scan.get(),
          set: (val) => settings.scan.set(val ? 1 : 0),
        },
        {
          type: "select",
          id: "scan_mode",
          name: "Scan mode",
          description: "How the radio detects activity during scan.",
          tab: Tab.Scanning,
          options: ["Carrier", "Time"],
          get: () => settings2.scanmode.get(),
          set: (val) => settings2.scanmode.set(Number(val)),
        },

        // Tab.VOX
        {
          type: "switcher",
          id: "vox",
          name: "VOX",
          description: "Voice-activated transmit: microphone turns on automatically when you speak (no PTT needed).",
          tab: Tab.VOX,
          get: () => settings.vox.get(),
          set: (val) => settings.vox.set(val ? 1 : 0),
        },
        {
          type: "switcher",
          id: "vox_inhibit",
          name: "Inhibit VOX on receive",
          description: "Disables VOX while receiving to prevent false activation from incoming audio.",
          tab: Tab.VOX,
          get: () => settings.voxinhibitonrx.get(),
          set: (val) => settings.voxinhibitonrx.set(val ? 1 : 0),
        },
        {
          type: "select",
          id: "vox_level",
          name: "VOX level",
          description: "VOX sensitivity: lower values = easier to trigger transmit with your voice.",
          tab: Tab.VOX,
          options: Array(5)
            .fill(0)
            .map((_, i) => String(i + 1)),
          get: () => settings.voxlevel.get(),
          set: (val) => settings.voxlevel.set(Number(val)),
        },

        // Tab.Power
        {
          type: "switcher",
          id: "bat_save",
          name: "Battery saver",
          description: "Reduces power consumption during standby by periodically turning off the receiver.",
          tab: Tab.Power,
          get: () => settings2.batterysaver.get(),
          set: (val) => settings2.batterysaver.set(val ? 1 : 0),
        },
        {
          type: "switcher",
          id: "low_no_tx",
          name: "Low voltage inhibit transmit",
          description: "Blocks transmission when battery voltage is too low (protects battery).",
          tab: Tab.Power,
          get: () => settings.lowvolinhibittx.get(),
          set: (val) => settings.voxinhibitonrx.set(val ? 1 : 0),
        },
        {
          type: "switcher",
          id: "hight_no_tx",
          name: "High voltage inhibit transmit",
          description: "Blocks transmission if battery voltage is abnormally high (rarely used).",
          tab: Tab.Power,
          get: () => settings.highvolinhibittx.get(),
          set: (val) => settings.highvolinhibittx.set(val ? 1 : 0),
        },
        {
          type: "select",
          id: "tot",
          name: "Timeout timer",
          description: "Limits continuous transmit time to prevent overheating or PTT stuck.",
          tab: Tab.Power,
          options: [
            "Off",
            "30 seconds",
            "60 seconds",
            "90 seconds",
            "120 seconds",
            "150 seconds",
            "180 seconds",
            "210 seconds",
            "240 seconds",
            "270 seconds",
            "300 seconds",
          ],
          get: () => settings2.timeouttimer.get(),
          set: (val) => settings2.timeouttimer.set(Number(val)),
        },

        // Tab.System
        {
          type: "switcher",
          id: "fm",
          name: "FM function",
          description: "Enables listening to commercial FM broadcast radio.",
          tab: Tab.System,
          get: () => settings.fmradio.get(),
          set: (val) => settings.fmradio.set(val ? 1 : 0),
        },
        {
          type: "select",
          id: "sql",
          name: "Squelch level",
          description: "Noise suppression threshold: higher = quieter background, but weak signals may be blocked.",
          tab: Tab.System,
          options: Array(10)
            .fill(0)
            .map((_, i) => String(i)),
          get: () => settings2.squelchlevel.get(),
          set: (val) => settings2.squelchlevel.set(Number(val)),
        },
        {
          type: "select",
          id: "key_fn",
          name: "Side key function",
          tab: Tab.System,
          options: ["Off", "Monitor", "Transmit Power", "Alarm"],
          get: () => settings2.sidekeyfunction.get(),
          set: (val) => settings2.sidekeyfunction.set(Number(val)),
        },
      ],
    };
  }

  protected _ranges = [
    [0x0000, 0x0110],
    [0x0380, 0x03e0],
    [0x02b0, 0x02c0],
  ];

  protected _img?: Buffer;
  protected _mem?: ReturnType<typeof this._parse>;

  override async load(snapshot: Buffer) {
    this._img = snapshot;
    this._mem = this._parse(this._img);
    this.dispatch_ui();
  }

  protected async _enter_programming_mode() {
    await this._serial_write(Buffer.from([0x02]));
    // await new Promise((r) => setTimeout(r, 100));
    await this._serial_write(PROGRAM_CMD);

    const ack = await this._serial_read(1);
    if (!ack.equals(CMD_ACK)) throw new Error("Radio refused to enter programming mode");

    await this._serial_write(Buffer.from([0x02]));

    const ident = await this._serial_read(8);
    await this._serial_write(CMD_ACK);

    const ack2 = await this._serial_read(1);
    if (!ack2.equals(CMD_ACK)) throw new Error("Bad ACK after reading ident");

    if (!IDENT.some((id) => ident.slice(0, id.length).equals(id))) throw new Error("Incorrect model");
  }

  protected async _exit_programming_mode() {
    await this._serial_write(Buffer.from("E", "ascii"));
  }

  protected async _read_block(addr: number, size: number) {
    const cmd = new Buffer(4);
    cmd.write("R", 0);
    cmd.writeInt16BE(addr, 1);
    cmd.writeUInt8(size, 3);
    await this._serial_write(cmd);

    const res = await this._serial_read(4 + size);

    const res_expected = Buffer.concat([Buffer.from("W"), cmd.slice(1)]);
    if (Buffer.compare(res_expected, res.slice(0, res_expected.length)) !== 0) {
      throw new Error(`Error riding block 0x${addr.toString(16)}`);
    }

    const data = res.slice(4);

    await this._serial_write(CMD_ACK);

    const ack = await this._serial_read(1);
    if (!ack.equals(CMD_ACK)) throw new Error(`No ACK reading block 0x${addr.toString(16)}`);

    return data;
  }

  protected async _write_block(addr: number, data: Buffer) {
    const cmd = new Buffer(4);
    cmd.write("W", 0);
    cmd.writeInt16BE(addr, 1);
    cmd.writeUInt8(data.length, 3);

    await this._serial_write(Buffer.concat([cmd, data]));

    const sck = await this._serial_read(1);
    if (!sck.equals(CMD_ACK)) throw new Error("No ACK");
  }

  override async read(onProgress: (k: number) => void) {
    onProgress(0);

    this._img = undefined;
    this._mem = undefined;
    this.dispatch_ui();

    await this._enter_programming_mode();
    onProgress(0.1);

    const blocks: Buffer[] = [];

    for (let addr = 0; addr < MEM_SIZE; addr += BLOCK_SIZE) {
      const block = await this._read_block(addr, BLOCK_SIZE);
      blocks.push(block);

      onProgress(0.1 + 0.8 * (addr / MEM_SIZE));
    }

    await this._exit_programming_mode();
    onProgress(0.95);

    const img = Buffer.concat(blocks);
    this.load(img);

    onProgress(1);
  }

  override async write(onProgress: (k: number) => void) {
    if (!this._img) throw new Error("No data");

    onProgress(0);

    await this._enter_programming_mode();
    onProgress(0.1);

    for (let addr = 0; addr < MEM_SIZE; addr += BLOCK_SIZE) {
      await this._write_block(addr, this._img.slice(addr, addr + BLOCK_SIZE));
      onProgress(0.1 + 0.8 * (addr / MEM_SIZE));
    }

    await this._exit_programming_mode();

    onProgress(1);
  }
}
