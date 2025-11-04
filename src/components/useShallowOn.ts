import { useShallow } from "zustand/shallow";

export function useShallowOn<T>(selector: () => T): () => T {
  const shallow = useShallow(() => selector());
  return () => shallow(undefined);
}
