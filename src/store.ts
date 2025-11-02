import { createStore } from "zustand";
import type { Radio } from "./drivers/radio";
import { Library } from "./drivers/library";

export type Store = {
  radio?: Radio;
  task?: string;
  progress?: number;

  _actions: {
    init: () => void;

    download: () => void;
    upload: () => void;

    changeRadio: (RadioClass: typeof Radio) => void;
  };
};

export const Store = createStore<Store>((set, get) => {
  const _handleProgress = (k: number) => set({ progress: k });

  const _clearTask = () => set({ task: undefined, progress: undefined });

  const _actions: Store["_actions"] = {
    init: () => {
      const RadioClass = Library[0];

      const { radio = new RadioClass() } = get();
      set({ radio });
    },

    download: async () => {
      const { radio } = get();

      if (!radio) return;

      set({ task: "Downloading" });
      try {
        await radio.connect();
        await radio.read(_handleProgress);
        await radio.disconnect();
      } finally {
        _clearTask();
      }
    },

    upload: async () => {
      const { radio } = get();

      if (!radio) return;

      set({ task: "Uploading" });
      try {
        await radio.connect();
        await radio.write(_handleProgress);
        await radio.disconnect();
      } finally {
        _clearTask();
      }
    },

    changeRadio: (RadioClass) => {
      set({ radio: new RadioClass() });
    },
  };

  return {
    _actions,
  };
});
export const Actions = Store.getState()._actions;

Actions.init();
