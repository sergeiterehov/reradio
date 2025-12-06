import { Buffer } from "buffer";
import { Radio, type RadioInfo } from "./radio";
import type { UI } from "@/utils/ui";
import { serial } from "@/utils/serial";

const PROG_CMD = Buffer.from("PROGRAMCOLORPROU", "ascii");
const ACK = Buffer.from([0x06]);

export class UV5RMiniRadio extends Radio {
  static override Info: RadioInfo = {
    vendor: "Baofeng",
    model: "UV-5R Mini",
  };

  ui(): UI.Root {
    return { fields: [] };
  }

  protected async _indent() {
    await serial.write(PROG_CMD);

    const ack = await serial.read(1);
    if (!ack.equals(PROG_CMD)) throw new Error("Unexpected indent ACK");

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

  override async read(): Promise<void> {
    await serial.begin({ baudRate: 115_200 });
    await serial.clear();

    await this._indent();
  }
}
