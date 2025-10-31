import { useStore } from "zustand";
import { Progress } from "@chakra-ui/react";
import { TbRadar2 } from "react-icons/tb";
import { useEffect } from "react";
import { Actions, Store } from "./store";
import { AnyField } from "./components/fields";

function App() {
  const radio = useStore(Store, (s) => s.radio);
  const progress = useStore(Store, (s) => s.progress);

  useEffect(() => {
    Actions.init();
  }, []);

  return (
    <>
      <TbRadar2 />
      <h1>{radio ? [radio.vendor, radio.model].join(" ") : "ReRadio"}</h1>
      <div className="card">
        <button onClick={() => Actions.download()}>Download</button>
        <button onClick={() => Actions.upload()}>Upload</button>
      </div>
      {radio && radio.ui().map((field) => <AnyField key={field.id} field={field} />)}
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
