import { useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { Store } from "@/store";
import type { UI } from "@/drivers/ui";
import { NativeSelect, Switch } from "@chakra-ui/react";

function useField(field: UI.Field.Any) {
  const radio = useStore(Store, (s) => s.radio);
  if (!radio) throw new Error();

  return useSyncExternalStore(radio.subscribe_ui, field.get);
}

function SwitcherField(props: { field: UI.Field.Switcher }) {
  const { field } = props;
  const value = useField(field);

  return (
    <Switch.Root key={field.id} checked={Boolean(value)} onCheckedChange={(e) => field.set(e.checked)}>
      <Switch.HiddenInput />
      <Switch.Control />
      <Switch.Label>{field.name}</Switch.Label>
    </Switch.Root>
  );
}

function SelectField(props: { field: UI.Field.Select }) {
  const { field } = props;
  const value = useField(field);

  return (
    <NativeSelect.Root size="sm" width="240px">
      <NativeSelect.Field
        value={field.options.findIndex((opt) => opt.value === value)}
        onChange={(e) => field.set(field.options[Number(e.currentTarget.value)].value)}
      >
        {field.options.map((opt, i) => (
          <option value={String(i)}>{opt.name}</option>
        ))}
      </NativeSelect.Field>
      <NativeSelect.Indicator />
    </NativeSelect.Root>
  );
}

export function AnyField(props: { field: UI.Field.Any }) {
  const { field } = props;

  if (field.type === "switcher") return <SwitcherField field={field} />;
  if (field.type === "select") return <SelectField field={field} />;

  return null;
}
