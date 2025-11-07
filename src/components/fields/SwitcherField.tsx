import type { UI } from "@/drivers/ui";
import { Field, Switch } from "@chakra-ui/react";
import { useRadioOn } from "../useRadioOn";

export function SwitcherField(props: { field: UI.Field.Switcher }) {
  const { field } = props;
  const value = useRadioOn(field.get);

  return (
    <Field.Root>
      <Switch.Root checked={Boolean(value)} onCheckedChange={(e) => field.set(e.checked)}>
        <Switch.HiddenInput />
        <Switch.Control />
        <Switch.Label>{field.name}</Switch.Label>
      </Switch.Root>
      <Field.HelperText>{field.description}</Field.HelperText>
    </Field.Root>
  );
}
