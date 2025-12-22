import { Buffer } from "buffer";
import { createStore } from "zustand";
import { enableMapSet } from "immer";
import { immer } from "zustand/middleware/immer";
import type { Radio } from "./drivers/_radio";
import { Library } from "./drivers/_library";
import { Demos } from "./demo";
import YaMetrika from "./YaMetrika";
import type { UI } from "./utils/ui";
import { clipboardReplaceChannel, clipboardWriteChannels } from "./utils/serialize";
import { serial } from "./utils/serial";
import {
  history_add,
  history_all_short,
  history_clear,
  history_delete,
  history_get,
  history_patch,
  sharing_put,
  type ImageRecord,
} from "./db";
import { gzip_compress, gzip_decompress } from "./utils/gzip";
import { download_buffer } from "./utils/radio";
import { toaster } from "./toaster";

enableMapSet();

const LAST_READ_KEY = "last_read";
const DEVELOPER_KEY = "developer";
const CLOUD = import.meta.env.VITE_CLOUD_API;

type FetchState<T> = { loading: true } | { loading: false; result: T } | { loading: false; error: unknown };

export type Store = {
  init: "NO" | "IN_PROGRESS" | "DONE";

  developer: boolean;

  radio: Radio;
  task?: "READ" | "WRITE" | "LOAD" | "UPLOAD" | "SHARE" | "FETCH_SHARED";
  progress?: number;
  ui?: UI.Root;

  sharing?: FetchState<string>;
  history: Omit<ImageRecord, "snapshot">[];

  /** <channel_field_id, index[]> */
  selectedChannels: Map<string, Set<number>>;
  openedChannel?: { field_id: string; index: number };
};

export const Store = createStore<Store>()(immer((_) => ({} as Store)));

const _urlSharedRegex = /^\/s\/(?<id>[a-zA-Z0-9_-]+)$/;

const _makeSharedLink = (id: string) => {
  const pathname = `s/${id}`;
  const link = `${window.location.origin}/${pathname}`;
  return link;
};

let _unsubscribe_progress: () => void;
let _unsubscribe_ui_change: () => void;

const _get = Store.getState;
const _set = Store.setState;

const _handle_progress = (k: number, _step?: string) => _set({ progress: k });

const _handle_ui_change = () => _set({ ui: _get().radio.ui() });

const _setRadio = (radio: Radio) => {
  _unsubscribe_progress?.();
  _unsubscribe_ui_change?.();

  _unsubscribe_progress = radio.subscribe_progress(_handle_progress);
  _unsubscribe_ui_change = radio.subscribe_ui_change(_handle_ui_change);

  _set({ radio, ui: undefined });

  _handle_ui_change();
};

const _clearTask = () => _set({ task: undefined, progress: undefined });

const _clear_sharing = () => {
  if (!CLOUD) return;

  _set({ sharing: undefined });
  history.replaceState(null, "", "/");
};

const _useSelection = (index: number, channels: UI.Field.Channels): { indexes: number[]; multiselect: boolean } => {
  const indexes = _get().selectedChannels.get(channels.id);
  Actions.clearChannelSelection(channels);

  if (!indexes?.has(index)) {
    return { indexes: [index], multiselect: false };
  }

  return { indexes: [...indexes], multiselect: true };
};

const _trySharedLink = () => {
  if (!CLOUD) return;

  const hash = window.location.pathname;
  if (!hash) return;
  const match = _urlSharedRegex.exec(hash);
  if (!match) return;
  const { id } = match.groups!;
  if (!id) return;

  Actions.fetchSharedSnapshot(id);
  return true;
};

const _tryLastOpened = async () => {
  const history_id = sessionStorage.getItem(LAST_READ_KEY) || localStorage.getItem(LAST_READ_KEY);
  if (!history_id) return;

  const img = await history_get(history_id);
  if (!img) return;

  const Class = Library.find((R) => R.Info.id === img.radio_id);
  if (!Class) return;

  Actions.changeRadio(Class);
  const { radio } = _get();
  radio.load(Buffer.from(img.snapshot), img.version);
  return true;
};

const _storeLastHistoryId = async (history_id: string) => {
  sessionStorage.setItem(LAST_READ_KEY, history_id);
  localStorage.setItem(LAST_READ_KEY, history_id);
};

// MARK: Actions

export const Actions = {
  init: async () => {
    if (_get().init !== "NO") return;
    _set({ init: "IN_PROGRESS" });

    try {
      if (await _trySharedLink()) return;
      if (await _tryLastOpened()) return;
    } finally {
      _set({ init: "DONE" });
    }
  },

  iAmDeveloper: () => {
    _set({ developer: true });
    localStorage.setItem(DEVELOPER_KEY, "1");
    toaster.warning({ title: "You are developer!", description: "Now you can use experimental drivers" });
  },

  loadDemo: async (RadioClass: typeof Radio) => {
    if (_get().task) return;

    Actions.changeRadio(RadioClass);
    const { radio } = _get();
    const { default: demo } = await Demos.get(RadioClass)!();
    await radio.load(Buffer.from(demo, "hex"), 0);
  },

  read: async () => {
    const { radio, task } = _get();

    if (task) return;

    YaMetrika.richGoal(YaMetrika.Goal.TryReadFromRadio, { ...radio.info });

    _clear_sharing();
    _set({ task: "READ" });
    try {
      try {
        await radio.read();

        YaMetrika.richGoal(YaMetrika.Goal.SuccessReadFromRadio, { ...radio.info });
      } finally {
        await serial.end();
      }
    } finally {
      _clearTask();
    }

    await Actions.saveHistory();
  },

  write: async () => {
    const { radio, task } = _get();

    if (task !== undefined) return;

    YaMetrika.richGoal(YaMetrika.Goal.TryWriteToRadio, { ...radio.info });

    _set({ task: "WRITE" });
    try {
      try {
        await radio.write();

        YaMetrika.richGoal(YaMetrika.Goal.SuccessWriteToRadio, { ...radio.info });
      } finally {
        await serial.end();
      }
    } finally {
      _clearTask();
    }
  },

  changeRadio: (RadioClass: typeof Radio) => {
    const { task } = _get();

    if (task) return;

    _clear_sharing();

    const newRadio = new RadioClass();
    _setRadio(newRadio);
  },

  fetchSharedLink: async () => {
    if (!CLOUD) return;

    const { radio, task } = _get();

    if (task) return;

    _set({ sharing: { loading: true }, task: "SHARE" });

    try {
      const { snapshot, version } = await radio.upload();

      if (radio.info.beta) {
        download_buffer(snapshot, `${radio.info.id}_${new Date().toISOString().replaceAll(/[^\d-]+/g, "_")}.img`);
        throw new Error("Only downloading available for experimental drivers");
      }

      const meta = Buffer.from(
        JSON.stringify({
          version: 1,
          radio_id: radio.info.id,
          radio_version: version,
        }),
        "utf8"
      );
      const gzip = await gzip_compress(snapshot);

      const payload = Buffer.alloc(1 + 2 + meta.length + gzip.length);
      payload.writeUInt8(1, 0);
      payload.writeUInt16LE(meta.length, 1);
      meta.copy(payload, 3);
      gzip.copy(payload, 3 + meta.length);

      await new Promise((r) => setTimeout(r, 3_000));

      const res = await fetch(`${CLOUD}/share`, {
        method: "POST",
        body: payload,
        headers: [["Content-Type", "application/octet-stream"]],
      });

      if (res.status !== 200) {
        try {
          const data = await res.json();
          if (data && "error" in data && typeof data.error === "string") {
            throw new Error(data.error);
          }
        } catch {
          throw new Error(res.statusText);
        }
      }

      const data: { id: string } = await res.json();

      const link = _makeSharedLink(data.id);

      _set({ sharing: { loading: false, result: link }, task: undefined });
      window.history.replaceState(null, "", new URL(link));

      await sharing_put({
        id: data.id,
        timestamp: Date.now(),
        device_id: radio.info.id,
      });
    } catch (error) {
      _set({ sharing: { loading: false, error }, task: undefined });
    }
  },

  fetchSharedSnapshot: async (id: string) => {
    if (!CLOUD) return;

    if (_get().task) return;

    _set({ sharing: { loading: true }, task: "FETCH_SHARED" });
    try {
      const res = await fetch(`${CLOUD}/share/${id}`, { method: "GET" });
      if (res.status !== 200) throw new Error(res.statusText);

      const raw = Buffer.from(await res.bytes());
      if (raw.readUInt8(0) !== 1) throw new Error("Unknown file version");

      const meta_len = raw.readUInt16LE(1);

      const meta: {
        version: number;
        radio_id: string;
        radio_version: number;
      } = JSON.parse(raw.slice(3, 3 + meta_len).toString("utf8"));
      if (meta.version !== 1) throw new Error("Unknown meta version");

      const gzip = raw.slice(3 + meta_len);
      const snapshot = await gzip_decompress(gzip);

      const RadioClass = Library.find((R) => R.Info.id === meta.radio_id);
      if (!RadioClass) throw new Error("Radio driver not found");

      const newRadio = new RadioClass();
      _setRadio(newRadio);

      const link = _makeSharedLink(id);

      _set({ radio: newRadio, sharing: { loading: false, result: link }, task: undefined });
      await newRadio.load(snapshot, meta.version);
    } catch (e) {
      _set({ sharing: { loading: false, error: e }, task: undefined });
      throw e;
    }
  },

  refreshHistory: async () => {
    _set({ history: await history_all_short(30) });
  },

  openFromHistory: async (id: string) => {
    if (_get().task) return;

    const img = await history_get(id);
    if (!img) return;

    const Class = Library.find((R) => R.Info.id === img.radio_id);
    if (!Class) return;

    Actions.changeRadio(Class);
    const { radio } = _get();
    radio.load(Buffer.from(img.snapshot), img.version);

    _storeLastHistoryId(id);
  },

  saveHistory: async () => {
    const { radio } = _get();
    const { snapshot, version } = await radio.upload();

    const history_id = await history_add({
      radio_id: radio.info.id,
      version,
      timestamp: Date.now(),
      snapshot,
    });

    _storeLastHistoryId(history_id);

    await Actions.refreshHistory();
  },

  clearHistory: async () => {
    await history_clear();
    await Actions.refreshHistory();
  },

  renameHistoryItem: async (id: string, name: string) => {
    _set((s) => {
      const item = s.history.find((h) => h.id === id);
      if (!item) return;
      item.name = name;
    });

    await history_patch(id, { name });
  },

  deleteHistoryItem: async (id: string) => {
    _set((s) => {
      const index = s.history.findIndex((h) => h.id === id);
      if (index === -1) return;
      s.history.splice(index, 1);
    });

    await history_delete(id);
  },

  clearChannelSelection: (channels: UI.Field.Channels) => {
    _set((store) => {
      if (channels) {
        store.selectedChannels.delete(channels.id);
      } else {
        store.selectedChannels.clear();
      }
    });
  },

  setChannelSelection: (index: number, selected: boolean, channels: UI.Field.Channels) => {
    _set((state) => {
      let indexes = state.selectedChannels.get(channels.id);
      if (!indexes) {
        indexes = new Set();
        state.selectedChannels.set(channels.id, indexes);
      }

      if (selected) {
        indexes.add(index);
      } else {
        indexes.delete(index);
      }
    });
  },

  toggleChannelSelection: (index: number, channels: UI.Field.Channels) => {
    _set((state) => {
      let indexes = state.selectedChannels.get(channels.id);
      if (!indexes) {
        indexes = new Set();
        state.selectedChannels.set(channels.id, indexes);
      }

      if (indexes.has(index)) {
        indexes.delete(index);
      } else {
        indexes.add(index);
      }
    });
  },

  toggleChannelSelectionTo: (index: number, channels: UI.Field.Channels) => {
    _set((state) => {
      let indexes = state.selectedChannels.get(channels.id);
      if (!indexes) {
        indexes = new Set();
        state.selectedChannels.set(channels.id, indexes);
      }

      const selected = indexes.has(index);

      let from = 0;
      for (let i = index; i >= 0; i -= 1) {
        if (indexes.has(i) !== selected) {
          from = i;
          break;
        }
      }

      if (selected) {
        for (let i = from; i <= index; i += 1) indexes.delete(i);
      } else {
        for (let i = from; i <= index; i += 1) indexes.add(i);
      }
    });
  },

  openChannel: (index: number, channels: UI.Field.Channels) => {
    _set({ openedChannel: { field_id: channels.id, index } });
  },

  closeChannel: () => {
    _set({ openedChannel: undefined });
  },

  moveChannelsRight: (index: number, channels: UI.Field.Channels) => {
    let from = index;
    let to = channels.size - 1;

    if (channels.empty) {
      for (let i = from; i < channels.size; i += 1) {
        if (!channels.empty.get(i)) {
          from = i;
          break;
        }
      }

      for (let i = from; i < channels.size; i += 1) {
        if (channels.empty.get(i)) {
          to = i;
          break;
        }
      }
    }

    if (channels.swap) {
      for (let i = to; i > from; i -= 1) {
        channels.swap(i - 1, i);
      }
    }

    channels.empty?.delete(from);
  },

  rippleDelete: (index: number, channels: UI.Field.Channels) => {
    if (!channels.empty || !channels.swap) return;

    if (!channels.empty.get(index)) return;

    let from = index;
    for (; from < channels.size && channels.empty.get(from); from += 1);

    if (from === channels.size) return;

    let to = from + 1;
    for (; to < channels.size && !channels.empty.get(to); to += 1);
    to -= 1;

    let target = index - 1;
    for (; target >= 0 && channels.empty.get(target); target -= 1);
    target += 1;

    for (let i = from; i <= to; i += 1) {
      channels.swap(i, target);
      target += 1;
    }

    for (let i = target; i <= to; i += 1) channels.empty.delete(i);
  },

  delete: (index: number, channels: UI.Field.Channels) => {
    if (!channels.empty) return;

    const { indexes } = _useSelection(index, channels);

    for (const i of indexes) {
      if (channels.empty.get(i)) continue;
      channels.empty.delete(i);
    }
  },

  setChannelDigital: (is_digital: boolean, index: number, channels: UI.Field.Channels) => {
    if (!channels.digital?.set) return;

    const { indexes } = _useSelection(index, channels);
    for (const i of indexes) channels.digital.set(i, is_digital);
  },

  copyToClipboard: (index: number, channels: UI.Field.Channels) => {
    const { indexes } = _useSelection(index, channels);
    clipboardWriteChannels(channels, indexes);
  },

  replaceFromClipboard: (index: number, channels: UI.Field.Channels) => {
    const { indexes, multiselect } = _useSelection(index, channels);
    clipboardReplaceChannel(channels, indexes, multiselect);
  },
};

// MARK: Init state
{
  const radio = new Library[0]();

  const initialState: Store = {
    init: "NO",
    developer: localStorage.getItem(DEVELOPER_KEY) === "1",
    radio,
    selectedChannels: new Map(),
    history: [],
  };

  _set(initialState);
  _setRadio(radio);
}
