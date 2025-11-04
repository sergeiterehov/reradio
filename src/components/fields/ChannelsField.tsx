import type { UI } from "@/drivers/ui";
import {
  Drawer,
  Button,
  Stack,
  HStack,
  Box,
  Portal,
  Field,
  NativeSelect,
  InputGroup,
  NumberInput,
  Fieldset,
} from "@chakra-ui/react";
import { RadioWatch } from "../RadioWatch";
import { useRadioOn } from "../useRadioOn";
import { TbHelp } from "react-icons/tb";
import { Tooltip } from "../ui/tooltip";

function SquelchForm(props: { squelch: NonNullable<UI.Field.Channels["squelch_rx"]>; index: number; name: string }) {
  const { squelch, index, name } = props;

  return (
    <RadioWatch on={() => squelch.get(index)}>
      {(value) => (
        <>
          <Field.Root>
            <Field.Label>
              {name}
              <Tooltip content="Tone-based access control that mutes the speaker unless a specific sub-audible tone (CTCSS) or digital code (DCS) is detected, reducing unwanted noise from other users on the same frequency.">
                <TbHelp />
              </Tooltip>
            </Field.Label>
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
  const { freq, offset, mode, squelch_rx, squelch_tx, power, scan } = field;

  return (
    <Fieldset.Root>
      <Fieldset.Content>
        {freq && (
          <RadioWatch on={() => freq.get(index)}>
            {(value) => (
              <Field.Root>
                <Field.Label>
                  Frequency
                  <Tooltip content="The radio frequency used for receiving and transmitting signals.">
                    <TbHelp />
                  </Tooltip>
                </Field.Label>
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
                <Field.Label>
                  Offset
                  <Tooltip content="The difference between the transmit and receive frequencies, used to enable communication through repeaters or to avoid interference when operating simplex.">
                    <TbHelp />
                  </Tooltip>
                </Field.Label>
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
                <Field.Label>
                  Mode
                  <Tooltip content="The type of frequency modulation used for the signal, affecting bandwidth and audio quality. Common modes include FM (standard narrowband), NFM (narrower bandwidth), and WFM (wideband, typically for broadcast reception).">
                    <TbHelp />
                  </Tooltip>
                </Field.Label>
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
                <Field.Label>
                  Power
                  <Tooltip content="Transmit power level; use low power for short-range communication to save battery and reduce interference, high power for longer range when needed.">
                    <TbHelp />
                  </Tooltip>
                </Field.Label>
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
                <Field.Label>
                  Scan behavior
                  <Tooltip content="Controls whether and how the channel is included during scanning operations, allowing it to be skipped, scanned normally, or given higher attention.">
                    <TbHelp />
                  </Tooltip>
                </Field.Label>
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

function ChannelCard(props: { field: UI.Field.Channels; index: number }) {
  const { field, index } = props;
  const { freq, offset, mode, channel, squelch_rx } = field;

  const channel_value = useRadioOn(() => channel.get(index));
  const freq_value = useRadioOn(() => freq?.get(index));
  const offset_value = useRadioOn(() => offset?.get(index));
  const mode_value = useRadioOn(() => mode?.get(index));
  const squelch_rx_value = useRadioOn(() => squelch_rx?.get(index));

  return (
    <Drawer.Root lazyMount unmountOnExit>
      <Drawer.Trigger asChild>
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
      </Drawer.Trigger>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header>
              <Drawer.Title>{channel_value}</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>
              <ChannelForm {...props} />
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}

export function ChannelsField(props: { field: UI.Field.Channels }) {
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
