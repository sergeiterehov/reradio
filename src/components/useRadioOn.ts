import { Store } from "@/store";
import { useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { useShallowOn } from "./useShallowOn";

export function useRadioOn<T>(on: () => T): T {
  const radio = useStore(Store, (s) => s.radio);
  if (!radio) throw new Error();

  return useSyncExternalStore(radio.subscribe_ui, useShallowOn(on));
}
