import { createStore } from "zustand";
import type { Radio } from "./drivers/radio";
import { Library } from "./drivers/library";
import YaMetrika from "./YaMetrika";
import type { UI } from "./utils/ui";
import { moveChannel } from "./utils/radio";

export type Store = {
  radio: Radio;
  task?: string;
  progress?: number;

  _actions: {
    download: () => void;
    upload: () => void;

    changeRadio: (RadioClass: typeof Radio) => void;

    moveChannelsRight: (index: number, channels: UI.Field.Channels) => void;
    rippleDelete: (index: number, channels: UI.Field.Channels) => void;
  };
};

export const Store = createStore<Store>((set, get) => {
  const _handleProgress = (k: number, step?: string) => set({ progress: k });
  let _unsubscribe_progress: () => void;

  const _clearTask = () => set({ task: undefined, progress: undefined });

  const _actions: Store["_actions"] = {
    download: async () => {
      const { radio, task } = get();

      if (task !== undefined) return;

      YaMetrika.richGoal(YaMetrika.Goal.TryReadFromRadio, { ...radio.info });

      set({ task: "Downloading" });
      try {
        await radio.connect();

        try {
          await radio.read();

          YaMetrika.richGoal(YaMetrika.Goal.SuccessReadFromRadio, { ...radio.info });
        } finally {
          await radio.disconnect();
        }
      } finally {
        _clearTask();
      }
    },

    upload: async () => {
      const { radio, task } = get();

      if (task !== undefined) return;

      YaMetrika.richGoal(YaMetrika.Goal.TryWriteToRadio, { ...radio.info });

      set({ task: "Uploading" });
      try {
        await radio.connect();
        try {
          await radio.write();

          YaMetrika.richGoal(YaMetrika.Goal.SuccessWriteToRadio, { ...radio.info });
        } finally {
          await radio.disconnect();
        }
      } finally {
        _clearTask();
      }
    },

    changeRadio: (RadioClass) => {
      const { task } = get();

      if (task) return;

      const newRadio = new RadioClass();
      _unsubscribe_progress();
      _unsubscribe_progress = newRadio.subscribe_progress(_handleProgress);

      set({ radio: newRadio });
    },

    moveChannelsRight: (index, channels) => {
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

      for (let i = to; i > from; i -= 1) {
        moveChannel(channels, i - 1, i);
      }

      channels.empty?.delete(from);
    },

    rippleDelete: (index, channels) => {
      if (!channels.empty) return;

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
        moveChannel(channels, i, target);
        target += 1;
      }

      for (let i = target; i <= to; i += 1) channels.empty.delete(i);
    },
  };

  const initRadio = new Library[0]();
  _unsubscribe_progress = initRadio.subscribe_progress(_handleProgress);

  return {
    radio: initRadio,
    _actions,
  };
});

export const Actions = Store.getState()._actions;
