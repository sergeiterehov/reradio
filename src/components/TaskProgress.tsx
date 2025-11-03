import { Store } from "@/store";
import { Progress } from "@chakra-ui/react";
import { useStore } from "zustand";

export function TaskProgress() {
  const progress = useStore(Store, (s) => s.progress);

  if (typeof progress !== "number") return null;

  return (
    <Progress.Root width="200px" striped animated value={progress * 100}>
      <Progress.Track>
        <Progress.Range />
      </Progress.Track>
    </Progress.Root>
  );
}
