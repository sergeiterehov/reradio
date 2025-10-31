import { createStore, useStore } from "zustand";
import { RB618Radio } from "./drivers/radtel_t18";
import type { Radio } from "./drivers/radio";
import { Progress } from "@chakra-ui/react";
import { TbRadar2 } from "react-icons/tb";

type Store = {
  radio?: Radio;
  task?: string;
  progress?: number;

  _actions: {
    download: () => void;
    upload: () => void;
  };
};

const Store = createStore<Store>((set, get) => {
  const _handleProgress = (k: number) => set({ progress: k });

  const _clearTask = () => set({ task: undefined, progress: undefined });

  const _actions: Store["_actions"] = {
    download: async () => {
      const { radio = new RB618Radio() } = get();
      set({ radio });

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
  };

  return {
    _actions,
  };
});
const Actions = Store.getState()._actions;

function App() {
  const radio = useStore(Store, (s) => s.radio);
  const progress = useStore(Store, (s) => s.progress);

  return (
    <>
      <TbRadar2 />
      <h1>{radio ? [radio.vendor, radio.model].join(" ") : "ReRadio"}</h1>
      <div className="card">
        <button onClick={() => Actions.download()}>Download</button>
        <button onClick={() => Actions.upload()}>Upload</button>
      </div>
      {typeof progress === "number" && (
        <Progress.Root maxW="240px" striped animated value={progress * 100}>
          <Progress.Track>
            <Progress.Range />
          </Progress.Track>
        </Progress.Root>
      )}
    </>
  );
}

export default App;
