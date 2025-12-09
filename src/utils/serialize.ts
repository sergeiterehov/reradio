import z from "zod";
import type { UI } from "./ui";

const zNumber = z.preprocess((val: unknown) => {
  if (typeof val === "string") {
    const n = Number(val);
    if (!isNaN(n)) return n;
  }
  return val;
}, z.number());
const zBoolean = z.preprocess((val: unknown) => {
  if (typeof val === "string") {
    if (val.toLowerCase() === "true") return true;
    if (val.toLowerCase() === "false") return false;
  }
  return val;
}, z.boolean());

const zSerializedChannel = z.object({
  channel: z.string().optional(),
  digital: zBoolean.optional(),
  freq: zNumber.optional(),
  offset: zNumber.optional(),
  mode: z.string().optional(),
  squelch_rx_mode: z.string().optional(),
  squelch_rx_freq: zNumber.optional(),
  squelch_rx_code: zNumber.optional(),
  squelch_rx_polarity: z.enum(["I", "N"]).optional(),
  squelch_tx_mode: z.string().optional(),
  squelch_tx_freq: zNumber.optional(),
  squelch_tx_code: zNumber.optional(),
  squelch_tx_polarity: z.enum(["I", "N"]).optional(),
  power: zNumber.optional(),
  scan: z.string().optional(),
  bcl: zBoolean.optional(),
  ptt_id_on: z.string().optional(),
  ptt_id_id: z.string().optional(),
  dmr_id_from: z.enum(["Radio", "Channel"]).optional(),
  dmr_id_id: zNumber.optional(),
  dmr_rx_list_name: z.string().optional(),
  dmr_contact_id: zNumber.optional(),
  dmr_slot: z.enum(["Slot-1", "Slot-2", "DualSlot"]).optional(),
  dmr_color_code: zNumber.optional(),
  dmr_encryption_name: z.string().optional(),
});

const extra_prefix = "extra_" as const;

type SerializedChannel = z.infer<typeof zSerializedChannel> & { [key: `${typeof extra_prefix}${string}`]: string };

function serializeChannel(index: number, channels: UI.Field.Channels): SerializedChannel | undefined {
  if (channels.empty?.get(index)) return;

  const getSquelch = (
    squelch: NonNullable<UI.Field.Channels["squelch_rx"]>
  ): { mode?: string; freq?: number; polarity?: "I" | "N"; code?: number } => {
    const value: UI.Squelch = squelch.get(index);

    if (value.mode === "Off") {
      return { mode: value.mode };
    }

    if (value.mode === "CTCSS") {
      return {
        mode: value.mode,
        freq: value.freq,
      };
    }

    if (value.mode === "DCS") {
      return {
        mode: value.mode,
        polarity: value.polarity,
        code: value.code,
      };
    }

    return {};
  };

  const serialized: SerializedChannel = {
    channel: channels.channel.get(index),
    digital: channels.digital?.get(index),
    freq: channels.freq?.get(index),
    offset: channels.offset?.get(index),
    power: channels.power ? channels.power.options[channels.power.get(index)] : undefined,
    scan: channels.scan ? channels.scan.options[channels.scan.get(index)] : undefined,
    bcl: channels.bcl?.get(index),
  };

  if (serialized.digital) {
    const dmr_id = channels.dmr_id?.get(index);

    serialized.dmr_slot = channels.dmr_slot ? channels.dmr_slot.options[channels.dmr_slot.get(index)] : undefined;
    serialized.dmr_color_code = channels.dmr_color_code?.get(index);
    serialized.dmr_contact_id = channels.dmr_contact
      ? channels.dmr_contact.contacts[channels.dmr_contact.get(index)].id
      : undefined;
    serialized.dmr_rx_list_name = channels.dmr_rx_list
      ? channels.dmr_rx_list.lists[channels.dmr_rx_list.get(index)]
      : undefined;
    serialized.dmr_encryption_name = channels.dmr_encryption
      ? channels.dmr_encryption.keys.at(channels.dmr_encryption.get(index).key_index)?.name
      : undefined;
    serialized.dmr_id_from = dmr_id?.from;
    serialized.dmr_id_id = dmr_id && "id" in dmr_id ? dmr_id?.id : undefined;
  } else {
    const squelch_rx = channels.squelch_rx ? getSquelch(channels.squelch_rx) : {};
    const squelch_tx = channels.squelch_tx ? getSquelch(channels.squelch_tx) : {};
    const ptt_id = ((): { ptt_id_on?: string; ptt_id_id?: string } => {
      if (!channels.ptt_id) return {};

      const ptt = channels.ptt_id;
      const value = ptt.get(index);

      return {
        ptt_id_on: ptt.on_options[value.on],
        ptt_id_id: ptt.id_options[value.id],
      };
    })();

    serialized.mode = channels.mode ? channels.mode.options[channels.mode.get(index)] : undefined;
    serialized.squelch_rx_mode = squelch_rx.mode;
    serialized.squelch_rx_freq = squelch_rx.freq;
    serialized.squelch_rx_code = squelch_rx.code;
    serialized.squelch_rx_polarity = squelch_rx.polarity;
    serialized.squelch_tx_mode = squelch_tx.mode;
    serialized.squelch_tx_freq = squelch_tx.freq;
    serialized.squelch_tx_code = squelch_tx.code;
    serialized.squelch_tx_polarity = squelch_tx.polarity;
    serialized.ptt_id_on = ptt_id.ptt_id_on;
    serialized.ptt_id_id = ptt_id.ptt_id_id;
  }

  const extras = channels.extra?.(index);
  for (const extra of extras || []) {
    if ("get" in extra && "set" in extra) {
      serialized[`${extra_prefix}${extra.id}`] = JSON.stringify(extra.get());
    }
  }

  return serialized;
}

function replaceChannel(data: SerializedChannel, index: number, channels: UI.Field.Channels) {
  if (channels.empty?.get(index)) channels.empty.init(index);

  if (channels.digital?.set && data.digital !== undefined) channels.digital.set(index, data.digital);

  if (data.channel !== undefined && channels.channel.set) channels.channel.set(index, data.channel);
  if (data.freq !== undefined && channels.freq) channels.freq.set(index, data.freq);
  if (data.power !== undefined && channels.power) {
    const i = channels.power.options.indexOf(data.power);
    if (i !== -1) channels.power.set(index, i);
  }
  if (data.scan !== undefined && channels.scan) {
    const i = channels.scan.options.indexOf(data.scan as UI.ScanMode);
    if (i !== -1) channels.scan.set(index, i);
  }
  if (data.bcl !== undefined && channels.bcl) channels.bcl.set(index, data.bcl);

  if (data.digital) {
    if (data.dmr_slot !== undefined && channels.dmr_slot) {
      const i = channels.dmr_slot.options.indexOf(data.dmr_slot);
      if (i !== -1) channels.dmr_slot.set(index, i);
    }
    if (data.dmr_color_code !== undefined && channels.dmr_color_code) {
      channels.dmr_color_code.set(index, data.dmr_color_code);
    }
    if (data.dmr_contact_id !== undefined && channels.dmr_contact) {
      const i = channels.dmr_contact.contacts.findIndex((c) => c.id === data.dmr_contact_id);
      if (i !== -1) channels.dmr_contact.set(index, i);
    }
    if (data.dmr_rx_list_name !== undefined && channels.dmr_rx_list) {
      const i = channels.dmr_rx_list.lists.indexOf(data.dmr_rx_list_name);
      if (i !== -1) channels.dmr_rx_list.set(index, i);
    }
    if (data.dmr_id_from !== undefined && channels.dmr_id) {
      if (channels.dmr_id.from.includes(data.dmr_id_from)) {
        if (data.dmr_id_from === "Radio") {
          channels.dmr_id.set(index, { from: "Radio" });
        } else if (data.dmr_id_from === "Channel" && data.dmr_id_id !== undefined) {
          channels.dmr_id.set(index, {
            from: "Channel",
            id: data.dmr_id_id,
          });
        }
      }
    }
    if (data.dmr_encryption_name !== undefined && channels.dmr_encryption) {
      const i = channels.dmr_encryption.keys.findIndex((k) => k.name === data.dmr_encryption_name);
      if (i !== -1) channels.dmr_encryption.set(index, { key_index: i });
    }
  } else {
    if (data.mode !== undefined && channels.mode) {
      const i = channels.mode?.options.indexOf(data.mode as UI.RadioMode);
      if (i !== -1) channels.mode.set(index, i);
    }
    if (data.squelch_rx_mode !== undefined && channels.squelch_rx) {
      if (data.squelch_rx_mode === "Off") {
        channels.squelch_rx.set(index, { mode: "Off" });
      } else if (data.squelch_rx_mode === "CTCSS" && data.squelch_rx_freq !== undefined) {
        channels.squelch_rx.set(index, { mode: "CTCSS", freq: data.squelch_rx_freq });
      } else if (
        data.squelch_rx_mode === "DCS" &&
        data.squelch_rx_code !== undefined &&
        data.squelch_rx_polarity !== undefined
      ) {
        channels.squelch_rx.set(index, { mode: "DCS", code: data.squelch_rx_code, polarity: data.squelch_rx_polarity });
      }
    }
    if (data.squelch_tx_mode !== undefined && channels.squelch_tx) {
      if (data.squelch_tx_mode === "Off") {
        channels.squelch_tx.set(index, { mode: "Off" });
      } else if (data.squelch_tx_mode === "CTCSS" && data.squelch_tx_freq !== undefined) {
        channels.squelch_tx.set(index, { mode: "CTCSS", freq: data.squelch_tx_freq });
      } else if (
        data.squelch_tx_mode === "DCS" &&
        data.squelch_tx_code !== undefined &&
        data.squelch_tx_polarity !== undefined
      ) {
        channels.squelch_tx.set(index, { mode: "DCS", code: data.squelch_tx_code, polarity: data.squelch_tx_polarity });
      }
    }
    if (data.ptt_id_on !== undefined && data.ptt_id_id !== undefined && channels.ptt_id) {
      const on = channels.ptt_id.on_options.indexOf(data.ptt_id_on as UI.PttIdOn);
      const id = channels.ptt_id.id_options.indexOf(data.ptt_id_id);
      if (on !== undefined && id !== undefined) channels.ptt_id.set(index, { on, id });
    }
  }

  if (channels.extra) {
    const extra_fields = channels.extra(index);

    for (const [key, json_extra] of Object.entries(data)) {
      if (!key.startsWith(extra_prefix)) continue;
      if (typeof json_extra !== "string") continue;

      const id = key.substring(extra_prefix.length);
      for (const field of extra_fields) {
        if (field.id !== id) continue;
        if (!("set" in field)) continue;

        try {
          const value = JSON.parse(json_extra);
          field.set(value as never);
        } catch {
          // ignore
        }

        break;
      }
    }
  }
}

export async function clipboardWriteChannels(channels: UI.Field.Channels, indexes: number[]) {
  const channel_structs = indexes.map((index) => serializeChannel(index, channels)).filter(Boolean);

  const column_set = new Set<string>();
  for (const struct of channel_structs) {
    if (!struct) continue;
    for (const key of Object.keys(struct)) {
      if (struct[key as keyof typeof struct] !== undefined) {
        column_set.add(key);
      }
    }
  }

  const rows: string[] = [];
  const header = [...column_set];
  rows.push(header.join("\t"));

  for (const channel of channel_structs) {
    if (!channel) continue;

    const row: string[] = [];
    for (const key of header) {
      const value = channel[key as keyof typeof channel];
      row.push(value !== undefined ? String(value) : "");
    }
    rows.push(row.join("\t"));
  }

  const tsv = rows.join("\n");

  await navigator.clipboard.writeText(tsv);
}

export async function clipboardReplaceChannel(channels: UI.Field.Channels, indexes: number[], strictIndexes: boolean) {
  if (!indexes.length) return;

  const text = await navigator.clipboard.readText();
  if (!text) return;

  const serializedChannels: SerializedChannel[] = [];

  const rows = text
    .split("\n")
    .map((row) => row.trim())
    .filter((row) => row.length > 0);
  const header = rows[0].split("\t");
  for (let i = 1; i < rows.length; i += 1) {
    const cols = rows[i].split("\t");
    const channel: Record<string, string> = {};
    const extra: Record<string, string> = {};

    for (let j = 0; j < header.length; j += 1) {
      const key = header[j];
      const value = cols[j];
      if (!value) continue;

      if (key.startsWith(extra_prefix)) {
        extra[key] = value;
      } else {
        channel[key] = value;
      }
    }

    serializedChannels.push({ ...zSerializedChannel.parse(channel), ...extra });
  }

  if (strictIndexes) {
    for (let i = 0; i < serializedChannels.length && i < indexes.length; i += 1) {
      replaceChannel(serializedChannels[i], indexes[i], channels);
    }
  } else {
    for (let i = 0; i < serializedChannels.length && i < channels.size; i += 1) {
      replaceChannel(serializedChannels[i], indexes[0] + i, channels);
    }
  }
}
