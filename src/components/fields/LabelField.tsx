import type { UI } from "@/drivers/ui";
import { Field } from "@chakra-ui/react";
import { useRadioOn } from "../useRadioOn";

export function LabelField(props: { field: UI.Field.Label }) {
  const { field } = props;
  const value = useRadioOn(field.get);

  return (
    <Field.Root>
      <Field.Label>{field.name}</Field.Label>
      {String(value)}
      <Field.HelperText>{field.description}</Field.HelperText>
    </Field.Root>
  );
}
