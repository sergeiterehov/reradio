import { createStore } from "zustand";
import type { Radio } from "./drivers/radio";
import { Library } from "./drivers/library";

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
  const _handleProgress = (k: number) => set({ progress: k });

  const _clearTask = () => set({ task: undefined, progress: undefined });

  const _actions: Store["_actions"] = {
    download: async () => {
      const { radio } = get();

      if (!radio) return;

      set({ task: "Downloading" });
      try {
        await radio.connect();
        try {
          await radio.read(_handleProgress);
        } finally {
          await radio.disconnect();
        }
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
        try {
          await radio.write(_handleProgress);
        } finally {
          await radio.disconnect();
        }
      } finally {
        _clearTask();
      }
    },

    changeRadio: (RadioClass) => {
      set({ radio: new RadioClass() });
    },
  };

  return {
    radio: new Library[0](),
    _actions,
  };
});

export const Actions = Store.getState()._actions;
