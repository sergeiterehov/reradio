import type { UI } from "@/drivers/ui";
import { Field, NativeSelect } from "@chakra-ui/react";
import { useRadioOn } from "../useRadioOn";

export function SelectField(props: { field: UI.Field.Select }) {
  const { field } = props;
  const value = useRadioOn(field.get);

  return (
    <Field.Root>
      <Field.Label>{field.name}</Field.Label>
      <NativeSelect.Root>
        <NativeSelect.Field value={String(value)} onChange={(e) => field.set(Number(e.currentTarget.value))}>
          {field.options.map((opt, i) => (
            <option key={i} value={String(i)}>
              {opt}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
      <Field.HelperText>{field.description}</Field.HelperText>
    </Field.Root>
  );
}
