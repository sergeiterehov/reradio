import { Store } from "@/store";
import { useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { useShallowOn } from "./useShallowOn";

export function RadioWatch<T>(props: { on: () => T; children: (value: T) => React.ReactNode }) {
  const { on, children } = props;

  const radio = useStore(Store, (s) => s.radio);
  if (!radio) throw new Error();

  const value = useSyncExternalStore(radio.subscribe_ui, useShallowOn(on));

  return children(value);
}
