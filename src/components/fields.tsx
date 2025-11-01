import { useShallow as useShallowZustand } from "zustand/shallow";
import { useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { Store } from "@/store";
import type { UI } from "@/drivers/ui";
import { Box, Field, HStack, Input, InputGroup, NativeSelect, NumberInput, Stack, Switch } from "@chakra-ui/react";

function useShallow<T>(selector: () => T): () => T {
  const shallow = useShallowZustand(() => selector());
  return () => shallow(undefined);
}

function useField(field: UI.Field.Any) {
  const radio = useStore(Store, (s) => s.radio);
  if (!radio) throw new Error();

  return useSyncExternalStore(radio.subscribe_ui, useShallow(field.get));
}

function RadioWatch<T>(props: { on: () => T; children: (value: T) => React.ReactNode }) {
  const { on, children } = props;

  const radio = useStore(Store, (s) => s.radio);
  if (!radio) throw new Error();

  const value = useSyncExternalStore(radio.subscribe_ui, useShallow(on));

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
          const { freq, mode, channel, squelch } = field;

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
                            minimumFractionDigits: 6,
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
                {squelch && (
                  <RadioWatch on={() => squelch.get(i)}>
                    {(value) => (
                      <>
                        <Field.Root>
                          <Field.Label>Squelch</Field.Label>
                          <NativeSelect.Root>
                            <NativeSelect.Field
                              value={value.mode}
                              onChange={(e) => {
                                const mode = e.currentTarget.value as UI.SquelchMode;

                                if (mode === "Off") {
                                  squelch.set(i, { mode });
                                } else if (mode === "CTCSS") {
                                  squelch.set(i, { mode, freq: 67.0 });
                                } else if (mode === "DCS") {
                                  squelch.set(i, { mode, code: 23, polarity: "N" });
                                }
                              }}
                            >
                              {squelch.options.map((opt, i_opt) => (
                                <option key={i_opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </NativeSelect.Field>
                            <NativeSelect.Indicator />
                          </NativeSelect.Root>
                        </Field.Root>
                        {value.mode === "CTCSS" && (
                          <Field.Root>
                            <Field.Label>Frequency</Field.Label>
                            <NumberInput.Root
                              value={String(value.freq)}
                              onValueChange={(e) => squelch.set(i, { ...value, freq: e.valueAsNumber })}
                              formatOptions={{
                                minimumFractionDigits: 1,
                              }}
                            >
                              <NumberInput.Input />
                            </NumberInput.Root>
                          </Field.Root>
                        )}
                        {value.mode === "DCS" && (
                          <>
                            <InputGroup
                              flex="1"
                              startElement="D"
                              endElement={
                                <NativeSelect.Root size="xs" variant="plain" width="auto" me="-1">
                                  <NativeSelect.Field
                                    fontSize="sm"
                                    value={value.polarity}
                                    onChange={(e) => {
                                      const polarity = e.currentTarget.value as "I" | "N";
                                      squelch.set(i, { ...value, polarity });
                                    }}
                                  >
                                    <option value="N">N</option>
                                    <option value="I">I</option>
                                  </NativeSelect.Field>
                                  <NativeSelect.Indicator />
                                </NativeSelect.Root>
                              }
                            >
                              <NumberInput.Root
                                asChild
                                pe="0"
                                value={String(value.code)}
                                onValueChange={(e) => squelch.set(i, { ...value, code: e.valueAsNumber })}
                              >
                                <NumberInput.Input />
                              </NumberInput.Root>
                            </InputGroup>
                          </>
                        )}
                      </>
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
    <Field.Root>
      <Switch.Root key={field.id} checked={Boolean(value)} onCheckedChange={(e) => field.set(e.checked)}>
        <Switch.HiddenInput />
        <Switch.Control />
        <Switch.Label>{field.name}</Switch.Label>
      </Switch.Root>
    </Field.Root>
  );
}

function SelectField(props: { field: UI.Field.Select }) {
  const { field } = props;
  const value = useField(field);

  return (
    <Field.Root>
      <Field.Label>{field.name}</Field.Label>
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
    </Field.Root>
  );
}

export function AnyField(props: { field: UI.Field.Any }) {
  const { field } = props;

  if (field.type === "channels") return <ChannelsField field={field} />;
  if (field.type === "switcher") return <SwitcherField field={field} />;
  if (field.type === "select") return <SelectField field={field} />;

  return null;
}
