import { Library } from "@/drivers/library";
import type { Radio } from "@/drivers/radio";
import { Actions, Store } from "@/store";
import { NativeSelect } from "@chakra-ui/react";
import { useStore } from "zustand";

export function RadioSelector() {
  const radio = useStore(Store, (s) => s.radio);

  return (
    <NativeSelect.Root>
      <NativeSelect.Field
        rounded="full"
        value={radio ? Library.indexOf(radio.constructor as typeof Radio) : undefined}
        onChange={(e) => {
          const RadioClass = Library.at(Number(e.currentTarget.value));
          if (!RadioClass) return;

          Actions.changeRadio(RadioClass);
        }}
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
