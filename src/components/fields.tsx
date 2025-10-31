import { useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { Store } from "@/store";
import type { UI } from "@/drivers/ui";
import { Box, Field, HStack, NativeSelect, NumberInput, Stack, Switch } from "@chakra-ui/react";

function useField(field: UI.Field.Any) {
  const radio = useStore(Store, (s) => s.radio);
  if (!radio) throw new Error();

  return useSyncExternalStore(radio.subscribe_ui, field.get);
}

function RadioWatch<T>(props: { on: () => T; children: (value: T) => React.ReactNode }) {
  const { on, children } = props;

  const radio = useStore(Store, (s) => s.radio);
  if (!radio) throw new Error();

  const value = useSyncExternalStore(radio.subscribe_ui, on);

  return children(value);
}

function ChannelsField(props: { field: UI.Field.Channels }) {
  const { field } = props;
  useField(field);

  return (
    <HStack wrap="wrap">
      {Array(field.size)
        .fill(0)
        .map((_, i) => {
          const { freq, mode, channel } = field;

          return (
            <Box key={i} borderWidth="thin" p="4" borderRadius="lg">
              <Stack>
                {channel.get(i)}
                {freq && (
                  <RadioWatch on={() => freq.get(i)}>
                    {(value) => (
                      <Field.Root>
                        <Field.Label>Frequency</Field.Label>
                        <NumberInput.Root
                          value={String(value / 1_000_000)}
                          onValueChange={(e) => freq.set(i, e.valueAsNumber * 1_000_000)}
                          formatOptions={{
                            minimumFractionDigits: 3,
                          }}
                        >
                          <NumberInput.Input />
                        </NumberInput.Root>
                      </Field.Root>
                    )}
                  </RadioWatch>
                )}
                {mode && (
                  <RadioWatch on={() => mode.get(i)}>
                    {(value) => (
                      <Field.Root>
                        <Field.Label>Mode</Field.Label>
                        <NativeSelect.Root>
                          <NativeSelect.Field
                            value={value}
                            onChange={(e) => mode.set(i, e.currentTarget.value as UI.RadioMode)}
                          >
                            {mode.options.map((opt, i_opt) => (
                              <option key={i_opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </NativeSelect.Field>
                          <NativeSelect.Indicator />
                        </NativeSelect.Root>
                      </Field.Root>
                    )}
                  </RadioWatch>
                )}
              </Stack>
            </Box>
          );
        })}
    </HStack>
  );
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
    <NativeSelect.Root>
      <NativeSelect.Field
        value={field.options.findIndex((opt) => opt.value === value)}
        onChange={(e) => field.set(field.options[Number(e.currentTarget.value)].value)}
      >
        {field.options.map((opt, i) => (
          <option key={i} value={String(i)}>
            {opt.name}
          </option>
        ))}
      </NativeSelect.Field>
      <NativeSelect.Indicator />
    </NativeSelect.Root>
  );
}

export function AnyField(props: { field: UI.Field.Any }) {
  const { field } = props;

  if (field.type === "channels") return <ChannelsField field={field} />;
  if (field.type === "switcher") return <SwitcherField field={field} />;
  if (field.type === "select") return <SelectField field={field} />;

  return null;
}
