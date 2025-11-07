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
  SegmentGroup,
  Text,
  IconButton,
  Popover,
  Switch,
} from "@chakra-ui/react";
import { RadioWatch } from "../RadioWatch";
import { useRadioOn } from "../useRadioOn";
import { TbHelp, TbTrash } from "react-icons/tb";
import { Tooltip } from "../ui/tooltip";
import { useState } from "react";

function SquelchForm(props: {
  config: NonNullable<UI.Field.Channels["squelch_rx"]>;
  squelch: UI.Squelch;
  name: string;
  onChange: (squelch: UI.Squelch) => void;
}) {
  const { squelch, name, config, onChange } = props;

  return (
    <Stack>
      <Field.Root>
        <Field.Label>
          {name}
          <Tooltip content="Tone-based access control that mutes the speaker unless a specific sub-audible tone (CTCSS) or digital code (DCS) is detected, reducing unwanted noise from other users on the same frequency.">
            <TbHelp />
          </Tooltip>
        </Field.Label>
        <NativeSelect.Root>
          <NativeSelect.Field
            value={squelch.mode}
            onChange={(e) => {
              const mode = e.currentTarget.value as UI.SquelchMode;

              if (mode === "Off") {
                onChange({ mode });
              } else if (mode === "CTCSS") {
                onChange({ mode, freq: 67.0 });
              } else if (mode === "DCS") {
                onChange({ mode, code: 23, polarity: "N" });
              }
            }}
          >
            {config.options.map((opt, i_opt) => (
              <option key={i_opt} value={opt}>
                {opt}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Field.Root>
      {squelch.mode === "CTCSS" && (
        <InputGroup flex="1" endElement={"Hz"}>
          <NumberInput.Root
            asChild
            size="sm"
            value={String(squelch.freq)}
            onValueChange={(e) => onChange({ ...squelch, freq: e.valueAsNumber })}
            formatOptions={{
              minimumFractionDigits: 1,
            }}
          >
            <NumberInput.Input />
          </NumberInput.Root>
        </InputGroup>
      )}
      {squelch.mode === "DCS" && (
        <InputGroup
          flex="1"
          startElement="D"
          endElement={
            <NativeSelect.Root size="xs" variant="plain" width="auto" me="-1">
              <NativeSelect.Field
                fontSize="sm"
                value={squelch.polarity}
                onChange={(e) => {
                  const polarity = e.currentTarget.value as "I" | "N";
                  onChange({ ...squelch, polarity });
                }}
              >
                <option value="N">N</option>
                <option value="I">I</option>
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          }
        >
          {config.codes ? (
            <NativeSelect.Root asChild height="var(--select-field-height)">
              <NativeSelect.Field
                value={squelch.code}
                onChange={(e) => {
                  onChange({ ...squelch, code: Number(e.currentTarget.value) });
                }}
              >
                {config.codes.map((code, i_code) => (
                  <option key={i_code}>{code}</option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          ) : (
            <NumberInput.Root
              asChild
              pe="0"
              min={1}
              max={999}
              value={String(squelch.code)}
              onValueChange={(e) => onChange({ ...squelch, code: e.valueAsNumber })}
            >
              <NumberInput.Input />
            </NumberInput.Root>
          )}
        </InputGroup>
      )}
    </Stack>
  );
}

function SquelchTxRx(props: {
  tx: UI.Field.Channels["squelch_tx"];
  rx: UI.Field.Channels["squelch_rx"];
  index: number;
}) {
  const { index, rx, tx } = props;

  const [sync, setSync] = useState(true);

  const rx_value = useRadioOn(() => rx?.get(index));
  const tx_value = useRadioOn(() => tx?.get(index));

  if (sync && tx_value && rx_value && JSON.stringify(tx_value) === JSON.stringify(rx_value)) {
    return (
      <>
        <SquelchForm
          name="Squelch TX/RX"
          config={rx!}
          squelch={rx_value}
          onChange={(s) => {
            rx!.set(index, s);
            tx!.set(index, s);
          }}
        />
        <Button variant="subtle" size="xs" onClick={() => setSync(false)}>
          Split squelch
        </Button>
      </>
    );
  }

  return (
    <>
      {rx_value && (
        <SquelchForm name="Squelch RX" config={rx!} squelch={rx_value} onChange={(s) => rx!.set(index, s)} />
      )}
      {tx_value && (
        <SquelchForm name="Squelch TX" config={tx!} squelch={tx_value} onChange={(s) => tx!.set(index, s)} />
      )}
      {tx_value && rx_value ? (
        <Button
          variant="subtle"
          size="xs"
          onClick={() => {
            tx!.set(index, rx_value);
            setSync(true);
          }}
        >
          Link squelch
        </Button>
      ) : null}
    </>
  );
}

function ChannelForm(props: { field: UI.Field.Channels; index: number }) {
  const { field, index } = props;
  const { freq, offset, mode, squelch_rx, squelch_tx, power, scan, bcl, ptt_id } = field;

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
                    size="lg"
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
                <SegmentGroup.Root
                  value={String(value)}
                  onValueChange={(e) => mode.set(index, e.value as UI.RadioMode)}
                >
                  <SegmentGroup.Indicator />
                  <SegmentGroup.Items items={mode.options} />
                </SegmentGroup.Root>
              </Field.Root>
            )}
          </RadioWatch>
        )}
        <SquelchTxRx tx={squelch_tx} rx={squelch_rx} index={index} />
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
        {ptt_id && (
          <RadioWatch on={() => ptt_id.get(index)}>
            {(value) => (
              <Stack>
                <Field.Root>
                  <Field.Label>
                    Send PTT ID
                    <Tooltip content="Sends a short identifying signal (such as a callsign or code) automatically when the PTT button is pressed, allowing other users to identify the transmitting station.">
                      <TbHelp />
                    </Tooltip>
                  </Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={value.on}
                      onChange={(e) => ptt_id.set(index, { ...value, on: e.currentTarget.value as UI.ChannelPTTIdOn })}
                    >
                      {ptt_id.on_options.map((opt, i_opt) => (
                        <option key={i_opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>
                {value.on !== "Off" && (
                  <Field.Root>
                    <NativeSelect.Root size="sm">
                      <NativeSelect.Field
                        value={value.id}
                        onChange={(e) => ptt_id.set(index, { ...value, id: e.currentTarget.value as string })}
                      >
                        {ptt_id.id_options.map((opt, i_opt) => (
                          <option key={i_opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>
                )}
              </Stack>
            )}
          </RadioWatch>
        )}
        {bcl && (
          <RadioWatch on={() => bcl.get(index)}>
            {(value) => (
              <Field.Root>
                <Switch.Root checked={Boolean(value)} onCheckedChange={(e) => bcl.set(index, e.checked)}>
                  <Switch.HiddenInput />
                  <Switch.Control />
                  <Switch.Label>
                    <HStack>
                      Busy channel lockout
                      <Tooltip content="Prevents transmission when the channel is already in use, helping to avoid interference.">
                        <TbHelp />
                      </Tooltip>
                    </HStack>
                  </Switch.Label>
                </Switch.Root>
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
  const { empty, freq, offset, mode, channel, squelch_rx } = field;

  const empty_value = useRadioOn(() => empty?.get(index));
  const channel_value = useRadioOn(() => channel.get(index));
  const freq_value = useRadioOn(() => freq?.get(index));
  const offset_value = useRadioOn(() => offset?.get(index));
  const mode_value = useRadioOn(() => mode?.get(index));
  const squelch_rx_value = useRadioOn(() => squelch_rx?.get(index));

  if (empty_value) {
    return (
      <Popover.Root lazyMount unmountOnExit>
        <Popover.Trigger asChild>
          <Button variant="subtle" p="3" fontFamily="monospace" width="200px" height="80px">
            {channel_value}
          </Button>
        </Popover.Trigger>
        <Portal>
          <Popover.Positioner>
            <Popover.Content>
              <Popover.Arrow />
              <Popover.Body>
                <Popover.Title fontWeight="medium">Channel is empty</Popover.Title>
                <Text my="4">
                  The channel slot contains no configured frequency or essential settings and is not usable for
                  communication.
                </Text>
                <Button onClick={() => empty!.init(index)}>Initialize</Button>
              </Popover.Body>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>
    );
  }

  return (
    <Drawer.Root lazyMount unmountOnExit>
      <Drawer.Trigger asChild>
        <Button variant="outline" p="3" fontFamily="monospace" width="200px" height="80px">
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
              <Drawer.Title>
                <HStack>
                  <Text flexGrow="1">{channel_value}</Text>
                  {empty ? (
                    <Tooltip content="Delete channel">
                      <IconButton variant="ghost" rounded="full" colorPalette="red" onClick={() => empty.delete(index)}>
                        <TbTrash />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </HStack>
              </Drawer.Title>
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
