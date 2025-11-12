import { createStore } from "zustand";
import type { Radio } from "./drivers/radio";
import { Library } from "./drivers/library";
import YaMetrika from "./YaMetrika";

export type Store = {
  radio: Radio;
  task?: string;
  progress?: number;

  _actions: {
    download: () => void;
    upload: () => void;

    changeRadio: (RadioClass: typeof Radio) => void;
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
  };

  const initRadio = new Library[0]();
  _unsubscribe_progress = initRadio.subscribe_progress(_handleProgress);

  return {
    radio: initRadio,
    _actions,
  };
});

export const Actions = Store.getState()._actions;
