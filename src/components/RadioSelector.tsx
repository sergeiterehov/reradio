import { Library } from "@/drivers/library";
import type { Radio } from "@/drivers/radio";
import { Store } from "@/store";
import { NativeSelect } from "@chakra-ui/react";
import { useStore } from "zustand";

export function RadioSelector() {
  const radio = useStore(Store, (s) => s.radio);

  return (
    <NativeSelect.Root variant="plain">
      <NativeSelect.Field
        value={radio ? Library.indexOf(radio.constructor as typeof Radio) : undefined}
        onChange={(e) => console.log(Library.at(Number(e.currentTarget.value))?.Info)}
      >
        {Library.map((RadioClass, i) => (
          <option key={i} value={String(i)}>
            {[RadioClass.Info.vendor, RadioClass.Info.model].join(" ")}
          </option>
        ))}
      </NativeSelect.Field>
      <NativeSelect.Indicator />
    </NativeSelect.Root>
  );
}
