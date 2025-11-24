import z from "zod";
import type { UI } from "./ui";

export const zSerializedChannel = z.object({
  channel: z.string().optional(),
  freq: z.number().optional(),
  offset: z.number().optional(),
  mode: z.string().optional(),
  squelch_rx_mode: z.string().optional(),
  squelch_rx_freq: z.number().optional(),
  squelch_rx_code: z.number().optional(),
  squelch_rx_polarity: z.enum(["I", "N"]).optional(),
  squelch_tx_mode: z.string().optional(),
  squelch_tx_freq: z.number().optional(),
  squelch_tx_code: z.number().optional(),
  squelch_tx_polarity: z.enum(["I", "N"]).optional(),
  power: z.number().optional(),
  scan: z.string().optional(),
  bcl: z.boolean().optional(),
  ptt_id_on: z.string().optional(),
  ptt_id_id: z.string().optional(),
});

const zChannelsClipboard = z.object({ channels: z.array(zSerializedChannel) });

export type SerializedChannel = z.infer<typeof zSerializedChannel>;

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
        freq: squelch.tones?.[value.freq] ?? value.freq,
      };
    }

    if (value.mode === "DCS") {
      return {
        mode: value.mode,
        polarity: value.polarity,
        code: squelch.codes?.[value.code] ?? value.code,
      };
    }

    return {};
  };

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

  return {
    channel: channels.channel.get(index),
    freq: channels.freq?.get(index),
    offset: channels.offset?.get(index),
    mode: channels.mode ? channels.mode.options[channels.mode.get(index)] : undefined,
    squelch_rx_mode: squelch_rx.mode,
    squelch_rx_freq: squelch_rx.freq,
    squelch_rx_code: squelch_rx.code,
    squelch_rx_polarity: squelch_rx.polarity,
    squelch_tx_mode: squelch_tx.mode,
    squelch_tx_freq: squelch_tx.freq,
    squelch_tx_code: squelch_tx.code,
    squelch_tx_polarity: squelch_tx.polarity,
    power: channels.power ? channels.power.options[channels.power.get(index)] : undefined,
    scan: channels.scan ? channels.scan.options[channels.scan.get(index)] : undefined,
    bcl: channels.bcl?.get(index),
    ptt_id_on: ptt_id.ptt_id_on,
    ptt_id_id: ptt_id.ptt_id_id,
  };
}

function replaceChannel(data: SerializedChannel, index: number, channels: UI.Field.Channels) {
  if (channels.empty?.get(index)) channels.empty.init(index);

  if (data.channel !== undefined && channels.channel.set) channels.channel.set(index, data.channel);
  if (data.freq !== undefined && channels.freq) channels.freq.set(index, data.freq);
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
  if (data.power !== undefined && channels.power) {
    const i = channels.power.options.indexOf(data.power);
    if (i !== -1) channels.power.set(index, i);
  }
  if (data.scan !== undefined && channels.scan) {
    const i = channels.scan.options.indexOf(data.scan as UI.ScanMode);
    if (i !== -1) channels.scan.set(index, i);
  }
  if (data.bcl !== undefined && channels.bcl) channels.bcl.set(index, data.bcl);
  if (data.ptt_id_on !== undefined && data.ptt_id_id !== undefined && channels.ptt_id) {
    const on = channels.ptt_id.on_options.indexOf(data.ptt_id_on as UI.PttIdOn);
    const id = channels.ptt_id.id_options.indexOf(data.ptt_id_id);
    if (on !== undefined && id !== undefined) channels.ptt_id.set(index, { on, id });
  }
}

export async function clipboardWriteChannels(channels: UI.Field.Channels, indexes: number[]) {
  const channel_structs = indexes.map((index) => serializeChannel(index, channels)).filter(Boolean);
  const struct = { channels: channel_structs };

  await navigator.clipboard.writeText(JSON.stringify(struct));
}

export async function clipboardReplaceChannel(channels: UI.Field.Channels, indexes: number[]) {
  const text = await navigator.clipboard.readText();
  if (!text) return;

  const rawStruct = await new Promise((r) => r(JSON.parse(text))).catch(() => null);
  const struct = await zChannelsClipboard.parseAsync(rawStruct).catch(() => undefined);
  if (!struct) return;

  for (let i = 0; i < struct.channels.length && i < indexes.length; i += 1) {
    const data = struct.channels[i];
    replaceChannel(data, indexes[i], channels);
  }
}
