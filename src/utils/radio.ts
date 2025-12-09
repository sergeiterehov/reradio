import type { Buffer } from "buffer";
import type { UI } from "./ui";

export const DCS_CODES = [
  23, 25, 26, 31, 32, 36, 43, 47, 51, 53, 54, 65, 71, 72, 73, 74, 114, 115, 116, 122, 125, 131, 132, 134, 143, 145, 152,
  155, 156, 162, 165, 172, 174, 205, 212, 223, 225, 226, 243, 244, 245, 246, 251, 252, 255, 261, 263, 265, 266, 271,
  274, 306, 311, 315, 325, 331, 332, 343, 346, 351, 356, 364, 365, 371, 411, 412, 413, 423, 431, 432, 445, 446, 452,
  454, 455, 462, 464, 465, 466, 503, 506, 516, 523, 526, 532, 546, 565, 606, 612, 624, 627, 631, 632, 654, 662, 664,
  703, 712, 723, 731, 732, 734, 743, 754,
];

export const CTCSS_TONES = [
  67.0, 69.3, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8, 97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8,
  123.0, 127.3, 131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 159.8, 162.2, 165.5, 167.9, 171.3, 173.8, 177.3, 179.9, 183.5,
  186.2, 189.9, 192.8, 196.6, 199.5, 203.5, 206.5, 210.7, 218.1, 225.7, 229.1, 233.6, 241.8, 250.3, 254.1,
];

export function hex(buffer: Buffer) {
  return buffer.toString("hex").toUpperCase().match(/../g)?.join(" ") || "";
}

export function* range(start: number, end: number, step: number = 1) {
  for (let i = start; i < end; i += step) {
    yield i;
  }
}

export function trim_string(str: string) {
  return str.replace(/\s*[\x00\xFF]+.*$/, "");
}

export function download_buffer(img: Buffer) {
  const blob = new Blob([img], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "output.bin";
  document.body.appendChild(a);
  a.click();

  URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export function moveChannel(channels: UI.Field.Channels, from: number, to: number) {
  if (channels.empty?.get(from) && !channels.empty.get(to)) {
    channels.empty.delete(to);
    return;
  }

  if (channels.empty?.get(to)) channels.empty.init(to);

  channels.digital?.set?.(to, channels.digital.get(from));

  channels.channel.set?.(to, channels.channel.get(from));
  channels.bcl?.set(to, channels.bcl.get(from));
  channels.freq?.set(to, channels.freq.get(from));
  channels.offset?.set(to, channels.offset.get(from));
  channels.power?.set(to, channels.power.get(from));
  channels.scan?.set(to, channels.scan.get(from));

  if (channels.digital?.get(from)) {
    channels.dmr_slot?.set(to, channels.dmr_slot.get(from));
    channels.dmr_color_code?.set(to, channels.dmr_color_code.get(from));
    channels.dmr_encryption?.set(to, channels.dmr_encryption.get(from));
    channels.dmr_contact?.set(to, channels.dmr_contact.get(from));
    channels.dmr_rx_list?.set(to, channels.dmr_rx_list.get(from));
    channels.dmr_id?.set(to, channels.dmr_id.get(from));
  } else {
    channels.mode?.set(to, channels.mode.get(from));
    channels.ptt_id?.set(to, channels.ptt_id.get(from));
    channels.squelch_rx?.set(to, channels.squelch_rx.get(from));
    channels.squelch_tx?.set(to, channels.squelch_tx.get(from));
  }

  if (channels.extra) {
    const extra_to_map = new Map(channels.extra(to).map((field) => [field.id, field]));

    for (const extra_from of channels.extra(from)) {
      const extra_to = extra_to_map.get(extra_from.id);
      if (!extra_to) continue;
      if (!("set" in extra_to) || !("get" in extra_from)) continue;

      extra_to.set(extra_from.get() as never);
    }
  }
}
