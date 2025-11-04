import { useShallow as useShallowZustand } from "zustand/shallow";
import { useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { Store } from "@/store";
import type { UI } from "@/drivers/ui";
import {
  Box,
  Button,
  Field,
  Fieldset,
  HStack,
  InputGroup,
  NativeSelect,
  NumberInput,
  Popover,
  Portal,
  Stack,
  Switch,
} from "@chakra-ui/react";

function useShallow<T>(selector: () => T): () => T {
  const shallow = useShallowZustand(() => selector());
  return () => shallow(undefined);
}

function useRadioOn<T>(on: () => T): T {
  const radio = useStore(Store, (s) => s.radio);
  if (!radio) throw new Error();

  return useSyncExternalStore(radio.subscribe_ui, useShallow(on));
}

function RadioWatch<T>(props: { on: () => T; children: (value: T) => React.ReactNode }) {
  const { on, children } = props;

  const radio = useStore(Store, (s) => s.radio);
  if (!radio) throw new Error();

  const value = useSyncExternalStore(radio.subscribe_ui, useShallow(on));

  return children(value);
}

function ChannelCard(props: { field: UI.Field.Channels; index: number }) {
  const { field, index } = props;
  const { freq, offset, mode, channel, squelch_rx } = field;

  const channel_value = useRadioOn(() => channel.get(index));
  const freq_value = useRadioOn(() => freq?.get(index));
  const offset_value = useRadioOn(() => offset?.get(index));
  const mode_value = useRadioOn(() => mode?.get(index));
  const squelch_rx_value = useRadioOn(() => squelch_rx?.get(index));

  return (
    <Popover.Root lazyMount unmountOnExit positioning={{ placement: "right-start" }}>
      <Popover.Trigger asChild>
        <Button variant="outline" height="auto" p="3" fontFamily="monospace" width="200px">
          <Stack>
            <HStack>
              <Box>{channel_value}</Box>
              <Box fontWeight="bolder">{freq_value ? freq_value / 1_000_000 : "-"}</Box>
              {mode_value ? <Box>{mode_value}</Box> : null}
              {offset_value ? `${offset_value > 0 ? "+" : ""}${offset_value / 1_000_000}` : null}
            </HStack>
            <Box>
              {(() => {
                if (!squelch_rx_value || squelch_rx_value.mode === "Off") return "No squelch";

                if (squelch_rx_value.mode === "CTCSS") return `CTCSS ${squelch_rx_value.freq}`;
                if (squelch_rx_value.mode === "DCS")
                  return `DCS D${squelch_rx_value.code.toString().padStart(3, "0")}${squelch_rx_value.polarity}`;

                return "?";
              })()}
            </Box>
          </Stack>
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Arrow />
            <Popover.Body>
              <ChannelForm {...props} />
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}

function SquelchForm(props: { squelch: NonNullable<UI.Field.Channels["squelch_rx"]>; index: number; name: string }) {
  const { squelch, index, name } = props;

  return (
    <RadioWatch on={() => squelch.get(index)}>
      {(value) => (
        <>
          <Field.Root>
            <Field.Label>{name}</Field.Label>
            <NativeSelect.Root>
              <NativeSelect.Field
                value={value.mode}
                onChange={(e) => {
                  const mode = e.currentTarget.value as UI.SquelchMode;

                  if (mode === "Off") {
                    squelch.set(index, { mode });
                  } else if (mode === "CTCSS") {
                    squelch.set(index, { mode, freq: 67.0 });
                  } else if (mode === "DCS") {
                    squelch.set(index, { mode, code: 23, polarity: "N" });
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
            <InputGroup flex="1" endElement={"Hz"}>
              <NumberInput.Root
                asChild
                value={String(value.freq)}
                onValueChange={(e) => squelch.set(index, { ...value, freq: e.valueAsNumber })}
                formatOptions={{
                  minimumFractionDigits: 1,
                }}
              >
                <NumberInput.Input />
              </NumberInput.Root>
            </InputGroup>
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
                        squelch.set(index, { ...value, polarity });
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
                  onValueChange={(e) => squelch.set(index, { ...value, code: e.valueAsNumber })}
                >
                  <NumberInput.Input />
                </NumberInput.Root>
              </InputGroup>
            </>
          )}
        </>
      )}
    </RadioWatch>
  );
}

function ChannelForm(props: { field: UI.Field.Channels; index: number }) {
  const { field, index } = props;
  const { freq, offset, mode, channel, squelch_rx, squelch_tx, power, scan } = field;

  return (
    <Fieldset.Root>
      <Fieldset.Legend>{channel.get(index)}</Fieldset.Legend>
      <Fieldset.Content>
        {freq && (
          <RadioWatch on={() => freq.get(index)}>
            {(value) => (
              <Field.Root>
                <Field.Label>Frequency</Field.Label>
                <InputGroup flex="1" endElement={"MHz"}>
                  <NumberInput.Root
                    asChild
                    value={String(value / 1_000_000)}
                    onValueChange={(e) => freq.set(index, e.valueAsNumber * 1_000_000)}
                    formatOptions={{
                      minimumFractionDigits: 6,
                    }}
                    min={typeof freq.min === "number" ? freq.min / 1_000_000 : undefined}
                    max={typeof freq.max === "number" ? freq.max / 1_000_000 : undefined}
                  >
                    <NumberInput.Input />
                  </NumberInput.Root>
                </InputGroup>
              </Field.Root>
            )}
          </RadioWatch>
        )}
        {offset && (
          <RadioWatch on={() => offset.get(index)}>
            {(value) => (
              <Field.Root>
                <Field.Label>Offset</Field.Label>
                <InputGroup flex="1" endElement={"MHz"}>
                  <NumberInput.Root
                    asChild
                    width="full"
                    value={String(value / 1_000_000)}
                    onValueChange={(e) => offset.set(index, e.valueAsNumber * 1_000_000)}
                    formatOptions={{
                      minimumFractionDigits: 6,
                    }}
                  >
                    <NumberInput.Input />
                  </NumberInput.Root>
                </InputGroup>
              </Field.Root>
            )}
          </RadioWatch>
        )}
        {mode && (
          <RadioWatch on={() => mode.get(index)}>
            {(value) => (
              <Field.Root>
                <Field.Label>Mode</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    value={value}
                    onChange={(e) => mode.set(index, e.currentTarget.value as UI.RadioMode)}
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
        {squelch_rx && <SquelchForm name="Squelch RX" squelch={squelch_rx} index={index} />}
        {squelch_tx && <SquelchForm name="Squelch TX" squelch={squelch_tx} index={index} />}
        {power && (
          <RadioWatch on={() => power.get(index)}>
            {(value) => (
              <Field.Root>
                <Field.Label>Power</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field value={value} onChange={(e) => power.set(index, Number(e.currentTarget.value))}>
                    {power.options.map((opt, i_opt) => (
                      <option key={i_opt} value={opt}>
                        {power.name ? `${power.name(opt)} (${opt}W)` : `${opt} watt`}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field.Root>
            )}
          </RadioWatch>
        )}
        {scan && (
          <RadioWatch on={() => scan.get(index)}>
            {(value) => (
              <Field.Root>
                <Field.Label>Scan behavior</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    value={value}
                    onChange={(e) => scan.set(index, e.currentTarget.value as UI.ChannelScanMode)}
                  >
                    {scan.options.map((opt, i_opt) => (
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
      </Fieldset.Content>
    </Fieldset.Root>
  );
}

function ChannelsField(props: { field: UI.Field.Channels }) {
  const { field } = props;
  useRadioOn(field.get);

  return (
    <HStack wrap="wrap">
      {Array(field.size)
        .fill(0)
        .map((_, i) => (
          <ChannelCard key={i} field={field} index={i} />
        ))}
    </HStack>
  );
}

function SwitcherField(props: { field: UI.Field.Switcher }) {
  const { field } = props;
  const value = useRadioOn(field.get);

  return (
    <Field.Root>
      <Switch.Root key={field.id} checked={Boolean(value)} onCheckedChange={(e) => field.set(e.checked)}>
        <Switch.HiddenInput />
        <Switch.Control />
        <Switch.Label>{field.name}</Switch.Label>
      </Switch.Root>
      <Field.HelperText>{field.description}</Field.HelperText>
    </Field.Root>
  );
}

function SelectField(props: { field: UI.Field.Select }) {
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

export function AnyField(props: { field: UI.Field.Any }) {
  const { field } = props;

  if (field.type === "channels") return <ChannelsField field={field} />;
  if (field.type === "switcher") return <SwitcherField field={field} />;
  if (field.type === "select") return <SelectField field={field} />;

  return null;
}
