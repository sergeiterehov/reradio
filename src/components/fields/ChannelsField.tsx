import type { UI } from "@/utils/ui";
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
  Menu,
  type ButtonProps,
  Slider,
  Heading,
  Separator,
  Link,
  Spacer,
} from "@chakra-ui/react";
import { RadioWatch } from "../RadioWatch";
import { useRadioOn } from "../useRadioOn";
import {
  TbArrowBarToLeft,
  TbArrowBigRightLines,
  TbArrowNarrowRightDashed,
  TbCancel,
  TbCopy,
  TbCopyPlus,
  TbHelp,
  TbLayoutSidebarRightExpand,
  TbMenu2,
  TbRadio,
  TbTextSpellcheck,
  TbTransitionBottom,
  TbTrash,
} from "react-icons/tb";
import { Tooltip } from "../ui/tooltip";
import { Fragment, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { t } from "i18next";
import { Actions, Store } from "@/store";
import { useStore } from "zustand";
import { useMeasure } from "react-use";
import { AnyField } from "./AnyField";
import { DMR_ALL_CALL_ID } from "@/utils/radio";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { bands } from "@/bands";

const SlotNames: { [K in UI.DMRSlot]: string } = {
  DualSlot: t("dmr_slot_dual"),
  "Slot-1": t("dmr_slot_1"),
  "Slot-2": t("dmr_slot_2"),
};

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
          <Tooltip content={t("squelch_tooltip")}>
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
                onChange({ mode, freq: config.tones?.[0] ?? 67.0 });
              } else if (mode === "DCS") {
                onChange({ mode, code: config.codes?.[0] ?? 23, polarity: "N" });
              }
            }}
          >
            {config.options.map((opt, i_opt) => (
              <option key={i_opt} value={opt}>
                {opt === "Off" ? t("off") : opt}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Field.Root>
      {squelch.mode === "CTCSS" && (
        <InputGroup flex="1" endElement={t("hz")}>
          {config.tones ? (
            <NativeSelect.Root asChild height="var(--select-field-height)">
              <NativeSelect.Field
                value={squelch.freq}
                onChange={(e) => {
                  onChange({ ...squelch, freq: Number(e.currentTarget.value) });
                }}
              >
                {config.tones.map((freq, i_freq) => (
                  <option key={i_freq} value={freq}>
                    {freq}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          ) : (
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
          )}
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
                  <option key={i_code} value={code}>
                    {code}
                  </option>
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
          name={t("squelch_tx_rx")}
          config={rx!}
          squelch={rx_value}
          onChange={(s) => {
            rx!.set(index, s);
            tx!.set(index, s);
          }}
        />
        <Button variant="subtle" size="xs" onClick={() => setSync(false)}>
          {t("split_squelch")}
        </Button>
      </>
    );
  }

  return (
    <>
      {rx_value && (
        <SquelchForm name={t("squelch_rx")} config={rx!} squelch={rx_value} onChange={(s) => rx!.set(index, s)} />
      )}
      {tx_value && (
        <SquelchForm name={t("squelch_tx")} config={tx!} squelch={tx_value} onChange={(s) => tx!.set(index, s)} />
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
          {t("link_squelch")}
        </Button>
      ) : null}
    </>
  );
}

function FrequencySelector(props: { onSelect: (config: { freq: number }) => void }) {
  const { onSelect } = props;

  const { t } = useTranslation();

  return (
    <Stack gap="4">
      {bands.map((b) => {
        return (
          <Fragment key={b.id}>
            <Stack>
              <HStack>
                <Heading size="md" flexGrow="1">
                  {b.name}
                </Heading>
                <Text fontFamily="monospace">
                  <Link
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelect({ freq: b.freqMin });
                    }}
                  >
                    {(b.freqMin / 1_000_000).toString()}
                  </Link>
                  {" - "}
                  <Link
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelect({ freq: b.freqMax });
                    }}
                  >
                    {(b.freqMax / 1_000_000).toString()}
                  </Link>
                  {` ${t("mhz")}`}
                </Text>
              </HStack>
              <Text>{b.description}</Text>
              {b.channels && (
                <Stack>
                  {b.channels.map((ch) => {
                    return (
                      <HStack key={ch.number}>
                        <Text>{ch.name}</Text>
                        <Box flexGrow="1" borderBottom="dotted" borderColor="fg.subtle" />
                        <Link
                          fontFamily="monospace"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onSelect({ freq: ch.freq });
                          }}
                        >
                          {(ch.freq / 1_000_000).toFixed(6)}
                        </Link>
                      </HStack>
                    );
                  })}
                </Stack>
              )}
              <Text fontSize="xs">{b.hint}</Text>
            </Stack>
            <Separator />
          </Fragment>
        );
      })}
    </Stack>
  );
}

function ChannelForm(props: { field: UI.Field.Channels; index: number }) {
  const { field, index } = props;
  const {
    freq,
    offset,
    mode,
    squelch_rx,
    squelch_tx,
    power,
    scan,
    bcl,
    ptt_id,
    digital,
    dmr_encryption,
    dmr_slot,
    dmr_color_code,
    dmr_contact,
    dmr_rx_list,
    dmr_id,
  } = field;

  const { t } = useTranslation();

  const is_digital = useRadioOn(() => digital?.get(index));

  const freqInputRef = useRef<HTMLInputElement>(null);

  return (
    <Fieldset.Root>
      <Fieldset.Content>
        {freq && (
          <RadioWatch on={() => freq.get(index)}>
            {(value) => (
              <Popover.Root lazyMount unmountOnExit positioning={{ placement: "left-start" }}>
                <Popover.Context>
                  {(popover) => (
                    <Field.Root>
                      <Field.Label alignSelf="stretch" {...popover.getAnchorProps()}>
                        {t("frequency")}
                        <Tooltip content={t("frequency_tooltip")}>
                          <TbHelp />
                        </Tooltip>
                        <Spacer />
                        <Link
                          {...(popover.getTriggerProps() as object)}
                          color={popover.open ? "fg.subtle" : undefined}
                          fontSize="xs"
                        >
                          {t("select")}
                        </Link>
                      </Field.Label>
                      <InputGroup flex="1" endElement={t("mhz")}>
                        <NumberInput.Root
                          asChild
                          size="lg"
                          defaultValue={String(value / 1_000_000)}
                          onValueChange={(e) => freq.set(index, e.valueAsNumber * 1_000_000)}
                          formatOptions={{
                            minimumFractionDigits: 6,
                          }}
                          min={typeof freq.min === "number" ? freq.min / 1_000_000 : 0}
                          max={typeof freq.max === "number" ? freq.max / 1_000_000 : undefined}
                        >
                          <NumberInput.Input ref={freqInputRef} />
                        </NumberInput.Root>
                      </InputGroup>
                      <Field.HelperText>
                        {(() => {
                          const info: string[] = [];

                          const band = bands.find((b) => b.freqMin <= value && b.freqMax > value);

                          if (!band) return t("unknown_band");

                          if (band.channels) {
                            const ch = band.channels.find((ch) => ch.freq === value);

                            info.push(`${ch ? ch.name : t("unknown_channel")}.`);
                          }

                          info.push(band.description);
                          info.push(band.hint);

                          return info.join(" ");
                        })()}
                      </Field.HelperText>
                    </Field.Root>
                  )}
                </Popover.Context>
                <Popover.Positioner>
                  <Popover.Content width="md">
                    <Popover.Arrow />
                    <Popover.Body overflowY="auto">
                      <FrequencySelector
                        onSelect={(config) => {
                          const next = Math.max(freq.min ?? 0, Math.min(freq.max ?? Infinity, config.freq));
                          freq.set(index, next);
                          freqInputRef.current!.value = (next / 1_000_000).toString();
                        }}
                      />
                    </Popover.Body>
                  </Popover.Content>
                </Popover.Positioner>
              </Popover.Root>
            )}
          </RadioWatch>
        )}
        {offset && (
          <RadioWatch on={() => offset.get(index)}>
            {(value) => (
              <Field.Root>
                <Field.Label>
                  {t("offset")}
                  <Tooltip content={t("offset_tooltip")}>
                    <TbHelp />
                  </Tooltip>
                </Field.Label>
                <InputGroup flex="1" endElement={t("mhz")}>
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
        {!is_digital && mode && (
          <RadioWatch on={() => mode.get(index)}>
            {(value) => (
              <Field.Root>
                <Field.Label>
                  {t("modulation")}
                  <Tooltip content={t("modulation_tooltip")}>
                    <TbHelp />
                  </Tooltip>
                </Field.Label>
                <SegmentGroup.Root
                  size={mode.options.length > 4 ? "xs" : undefined}
                  value={mode.options[value]}
                  onValueChange={(e) => mode.set(index, mode.options.indexOf(e.value as UI.RadioMode))}
                >
                  <SegmentGroup.Indicator />
                  <SegmentGroup.Items items={mode.options} />
                </SegmentGroup.Root>
              </Field.Root>
            )}
          </RadioWatch>
        )}
        {!is_digital && <SquelchTxRx tx={squelch_tx} rx={squelch_rx} index={index} />}
        {is_digital && dmr_id && (
          <RadioWatch on={() => dmr_id.get(index)}>
            {(value) => (
              <Field.Root>
                <Field.Label>
                  {t("dmr_id")}
                  <Tooltip content={t("dmr_id_tooltip")}>
                    <TbHelp />
                  </Tooltip>
                </Field.Label>
                <HStack width="full">
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={value.from}
                      onChange={(e) => {
                        const from = e.currentTarget.value as UI.DMR_IDFrom;
                        if (from === "Radio") {
                          dmr_id.set(index, { from });
                        } else {
                          dmr_id.set(index, { from, id: 1 });
                        }
                      }}
                    >
                      <option value="Radio">{t("id_from_radio")}</option>
                      <option value="Channel">{t("id")}</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                  {value.from === "Channel" && (
                    <Field.Root>
                      <NumberInput.Root
                        asChild
                        value={String(value.id)}
                        onValueChange={(e) => dmr_id.set(index, { from: "Channel", id: e.valueAsNumber })}
                        min={1}
                        max={16_777_215}
                      >
                        <NumberInput.Input />
                      </NumberInput.Root>
                    </Field.Root>
                  )}
                </HStack>
              </Field.Root>
            )}
          </RadioWatch>
        )}
        {is_digital && dmr_contact && (
          <RadioWatch on={() => dmr_contact.get(index)}>
            {(value) => (
              <Field.Root>
                <Field.Label>
                  {t("dmr_call_contact")}
                  <Tooltip content={t("dmr_call_contact_tooltip")}>
                    <TbHelp />
                  </Tooltip>
                </Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    value={value}
                    onChange={(e) => dmr_contact.set(index, Number(e.currentTarget.value))}
                  >
                    {dmr_contact.contacts().map((opt, i_opt) => (
                      <option key={i_opt} value={i_opt}>
                        {(() => {
                          if (opt.type === "Group" && opt.id === DMR_ALL_CALL_ID) return t("all_call");

                          const num = `${opt.type === "Group" ? "TG " : ""}${opt.id}`;
                          if (!opt.name) return num;

                          return `${opt.name} (${num})`;
                        })()}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field.Root>
            )}
          </RadioWatch>
        )}
        {is_digital && dmr_rx_list && (
          <RadioWatch on={() => dmr_rx_list.get(index)}>
            {(value) => (
              <Field.Root>
                <Field.Label>
                  {t("dmr_rx_list")}
                  <Tooltip content={t("dmr_rx_list_tooltip")}>
                    <TbHelp />
                  </Tooltip>
                </Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    value={value}
                    onChange={(e) => dmr_rx_list.set(index, Number(e.currentTarget.value))}
                  >
                    {dmr_rx_list.lists().map((opt, i_opt) => (
                      <option key={i_opt} value={i_opt}>
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
        {is_digital && dmr_encryption && (
          <RadioWatch on={() => dmr_encryption.get(index).key_index}>
            {(key_index) => (
              <Field.Root>
                <Field.Label>
                  {t("dmr_encryption_key")}
                  <Tooltip content={t("dmr_encryption_key_tooltip")}>
                    <TbHelp />
                  </Tooltip>
                </Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    value={key_index}
                    onChange={(e) => dmr_encryption.set(index, { key_index: Number(e.currentTarget.value) })}
                  >
                    {dmr_encryption.keys().map((opt, i_opt) => (
                      <option key={i_opt} value={i_opt}>
                        {(() => {
                          if (opt.type === "Off") return t("off");

                          return `${opt.name} (${opt.type})`;
                        })()}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field.Root>
            )}
          </RadioWatch>
        )}
        {is_digital && dmr_slot && (
          <RadioWatch on={() => dmr_slot.get(index)}>
            {(value) => (
              <Field.Root>
                <Field.Label>
                  {t("dmr_slot")}
                  <Tooltip content={t("dmr_slot_tooltip")}>
                    <TbHelp />
                  </Tooltip>
                </Field.Label>
                <SegmentGroup.Root
                  size={dmr_slot.options.length > 4 ? "xs" : undefined}
                  value={dmr_slot.options[value]}
                  onValueChange={(e) => dmr_slot.set(index, dmr_slot.options.indexOf(e.value as UI.DMRSlot))}
                >
                  <SegmentGroup.Indicator />
                  <SegmentGroup.Items
                    items={dmr_slot.options.map((slot) => ({ value: slot, label: SlotNames[slot] || slot }))}
                  />
                </SegmentGroup.Root>
              </Field.Root>
            )}
          </RadioWatch>
        )}
        {is_digital && dmr_color_code && (
          <RadioWatch on={() => dmr_color_code.get(index)}>
            {(value) => (
              <Field.Root>
                <Slider.Root
                  w="full"
                  min={0}
                  max={15}
                  value={[value]}
                  onValueChange={(e) => dmr_color_code.set(index, e.value[0])}
                >
                  <HStack justify="space-between">
                    <Slider.Label>{t("dmr_color_code")}</Slider.Label>
                    <Tooltip content={t("dmr_color_code_tooltip")}>
                      <TbHelp />
                    </Tooltip>
                    <Text flexGrow={1} textAlign="end">
                      {value}
                    </Text>
                  </HStack>
                  <Slider.Control>
                    <Slider.Track>
                      <Slider.Range />
                    </Slider.Track>
                    <Slider.Thumbs />
                  </Slider.Control>
                </Slider.Root>
              </Field.Root>
            )}
          </RadioWatch>
        )}
        {power && (
          <RadioWatch on={() => power.get(index)}>
            {(value) => (
              <Field.Root>
                <Field.Label>
                  {t("power")}
                  <Tooltip content={t("power_tooltip")}>
                    <TbHelp />
                  </Tooltip>
                </Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field value={value} onChange={(e) => power.set(index, Number(e.currentTarget.value))}>
                    {power.options.map((opt, i_opt) => (
                      <option key={i_opt} value={i_opt}>
                        {power.name
                          ? t("power_option", { replace: { option: power.name(i_opt), value: opt } })
                          : t("watt", { replace: { value: opt } })}
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
                  {t("scan_behavior")}
                  <Tooltip content={t("scan_behavior_tooltip")}>
                    <TbHelp />
                  </Tooltip>
                </Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field value={value} onChange={(e) => scan.set(index, Number(e.currentTarget.value))}>
                    {scan.options.map((opt, i_opt) => (
                      <option key={i_opt} value={i_opt}>
                        {(() => {
                          if (opt === "On") return t("scan");
                          if (opt === "Off") return t("skip");

                          return opt;
                        })()}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field.Root>
            )}
          </RadioWatch>
        )}
        {!is_digital && ptt_id && (
          <RadioWatch on={() => ptt_id.get(index)}>
            {(value) => (
              <Stack>
                <Field.Root>
                  <Field.Label>
                    {t("send_ptt_id")}
                    <Tooltip content={t("send_ptt_id_tooltip")}>
                      <TbHelp />
                    </Tooltip>
                  </Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={value.on}
                      onChange={(e) => ptt_id.set(index, { ...value, on: Number(e.currentTarget.value) })}
                    >
                      {ptt_id.on_options.map((opt, i_opt) => (
                        <option key={i_opt} value={i_opt}>
                          {(() => {
                            if (opt === "Off") return t("off");
                            if (opt === "Begin") return t("begin");
                            if (opt === "End") return t("end");
                            if (opt === "BeginAndEnd") return t("begin_n_end");

                            return opt;
                          })()}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>
                {ptt_id.on_options[value.on] !== "Off" && ptt_id.id_options.length !== 0 && (
                  <Field.Root>
                    <NativeSelect.Root size="sm">
                      <NativeSelect.Field
                        value={value.id}
                        onChange={(e) => ptt_id.set(index, { ...value, id: Number(e.currentTarget.value) })}
                      >
                        {ptt_id.id_options.map((opt, i_opt) => (
                          <option key={i_opt} value={i_opt}>
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
                      {t("busy_channel_lockout")}
                      <Tooltip content={t("busy_channel_lockout_tooltip")}>
                        <TbHelp />
                      </Tooltip>
                    </HStack>
                  </Switch.Label>
                </Switch.Root>
              </Field.Root>
            )}
          </RadioWatch>
        )}
        {field.extra?.(index).map((extra_field, extra_index) => (
          <AnyField key={extra_index} field={extra_field} />
        ))}
      </Fieldset.Content>
      <Box height={100} />
    </Fieldset.Root>
  );
}

function ChannelMenuItems(props: { field: UI.Field.Channels; index: number }) {
  const { field, index } = props;
  const { empty, channel, digital, swap } = field;

  const selectionMode = useStore(Store, (s) => Boolean(s.selectedChannels.get(field.id)?.size));

  const empty_value = useRadioOn(() => empty?.get(index));

  return (
    <>
      {!empty_value && (
        <Menu.Item value="open" disabled={empty_value} onClick={() => Actions.openChannel(index, field)}>
          <TbLayoutSidebarRightExpand />
          {t("open")}
        </Menu.Item>
      )}
      {selectionMode ? (
        <Menu.Item value="deselect_all" onClick={() => Actions.clearChannelSelection(field)}>
          <TbCancel />
          {t("clear_selection")}
        </Menu.Item>
      ) : (
        <Menu.Item value="select" onClick={() => Actions.setChannelSelection(index, true, field)}>
          <TbCopyPlus />
          {t("multiselect")}
        </Menu.Item>
      )}
      {selectionMode && (
        <Menu.Item value="select_to_here" onClick={() => Actions.toggleChannelSelectionTo(index, field)}>
          <TbArrowNarrowRightDashed />
          {t("select_to_here")}
        </Menu.Item>
      )}
      {!empty_value && channel.set && (
        <Menu.Item
          value="rename"
          onClick={() => {
            const newName = prompt("New name", channel.get(index));
            if (newName === null) return;

            channel.set?.(index, newName);
          }}
        >
          <TbTextSpellcheck />
          {t("rename")}
        </Menu.Item>
      )}
      <Menu.Item value="move_right" onClick={() => Actions.moveChannelsRight(index, field)}>
        <TbArrowBigRightLines />
        {t("move_channels_right")}
      </Menu.Item>
      <Menu.Item value="copy" onClick={() => Actions.copyToClipboard(index, field)}>
        <TbCopy />
        {t("copy_clipboard")}
      </Menu.Item>
      <Menu.Item value="replace" onClick={() => Actions.replaceFromClipboard(index, field)}>
        <TbTransitionBottom />
        {t("replace_clipboard")}
      </Menu.Item>
      {empty && empty_value && swap && (
        <Menu.Item value="ripple_delete" onClick={() => Actions.rippleDelete(index, field)}>
          <TbArrowBarToLeft />
          {t("ripple_delete")}
        </Menu.Item>
      )}
      {!empty_value && digital?.set && (
        <RadioWatch on={() => digital.get(index)}>
          {(is_digital) => (
            <Menu.Item value="toggle_digital" onClick={() => Actions.setChannelDigital(!is_digital, index, field)}>
              <TbRadio />
              {is_digital ? t("switch_to_analogue") : t("switch_to_digital")}
            </Menu.Item>
          )}
        </RadioWatch>
      )}
      {empty && !empty_value && (
        <Menu.Item
          value="delete"
          color="fg.error"
          _hover={{ bg: "bg.error", color: "fg.error" }}
          onClick={() => Actions.delete(index, field)}
        >
          <TbTrash />
          {t("delete")}
        </Menu.Item>
      )}
    </>
  );
}

function Channel(props: { field: UI.Field.Channels; index: number }) {
  const { field, index } = props;
  const { digital, freq, offset, mode, channel, squelch_rx, dmr_slot, dmr_color_code } = field;

  const channel_value = useRadioOn(() => channel.get(index));
  const is_digital = useRadioOn(() => digital?.get(index));
  const freq_value = useRadioOn(() => freq?.get(index));
  const offset_value = useRadioOn(() => offset?.get(index));
  const squelch_rx_value = useRadioOn(() => squelch_rx?.get(index));

  return (
    <Stack overflow="hidden" flexGrow="1">
      <HStack>
        <Box fontWeight="bolder" fontSize="lg">
          {freq_value ? freq_value / 1_000_000 : "-"}
        </Box>
        {is_digital ? (
          <Box>DMR</Box>
        ) : (
          <RadioWatch on={() => mode && mode.options[mode.get(index)]}>
            {(mode_value) => (mode_value ? <Box>{mode_value}</Box> : null)}
          </RadioWatch>
        )}
        {offset_value ? <Box>{`${offset_value > 0 ? "+" : ""}${offset_value / 1_000_000}`}</Box> : null}
        <Box fontSize="2xs" textOverflow="ellipsis" overflow="hidden" flexGrow="1" textAlign="end">
          {channel_value}
        </Box>
      </HStack>
      {is_digital ? (
        <Box>
          <RadioWatch
            on={() => ({
              slot: dmr_slot ? dmr_slot.options[dmr_slot.get(index)] : undefined,
              cc: dmr_color_code?.get(index),
            })}
          >
            {({ slot, cc }) => {
              return [slot && SlotNames[slot], cc !== undefined && `CC-${cc}`].filter(Boolean).join(", ");
            }}
          </RadioWatch>
        </Box>
      ) : (
        <Box>
          {(() => {
            if (!squelch_rx_value || squelch_rx_value.mode === "Off") return t("no_squelch");

            if (squelch_rx_value.mode === "CTCSS") return `CTCSS ${squelch_rx_value.freq}`;
            if (squelch_rx_value.mode === "DCS")
              return `DCS D${squelch_rx_value.code.toString().padStart(3, "0")}${squelch_rx_value.polarity}`;

            return "?";
          })()}
        </Box>
      )}
    </Stack>
  );
}

function ChannelButton(props: {
  field: UI.Field.Channels;
  index: number;
  buttonProps?: ButtonProps;
  onChannelOpen?(): void;
}) {
  const { field, index, buttonProps } = props;
  const { empty } = field;

  const selectionMode = useStore(Store, (s) => Boolean(s.selectedChannels.get(field.id)?.size));
  const selected = useStore(Store, (s) => s.selectedChannels.get(field.id)?.has(index));

  const empty_value = useRadioOn(() => empty?.get(index));

  return (
    <Menu.Root unmountOnExit lazyMount>
      <Menu.Context>
        {(menuCtx) => (
          <Button
            {...menuCtx.getContextTriggerProps()}
            variant={selected ? "solid" : empty_value ? "subtle" : "outline"}
            color={empty_value ? "fg.subtle" : undefined}
            p="3"
            fontFamily="monospace"
            width="full"
            height="full"
            textAlign="start"
            alignItems={empty_value ? undefined : "start"}
            onClick={(e) => {
              if (selectionMode) {
                if (e.shiftKey) {
                  Actions.toggleChannelSelectionTo(index, field);
                } else {
                  Actions.toggleChannelSelection(index, field);
                }
              } else if (e.shiftKey) {
                Actions.setChannelSelection(index, true, field);
              } else if (!empty_value) {
                Actions.openChannel(index, field);
              } else {
                return;
              }

              e.preventDefault();
              e.stopPropagation();
            }}
            {...buttonProps}
          >
            {empty_value ? `${index + 1}` : <Channel {...props} />}
          </Button>
        )}
      </Menu.Context>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <ChannelMenuItems index={index} field={field} />
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

function ChannelCard(props: { field: UI.Field.Channels; index: number }) {
  const { field, index } = props;
  const { empty, channel } = field;

  const open = useStore(Store, (s) => s.openedChannel?.field_id === field.id && s.openedChannel.index === index);

  const empty_value = useRadioOn(() => empty?.get(index));
  const channel_value = useRadioOn(() => channel.get(index));

  if (empty_value) {
    return (
      <Popover.Root lazyMount unmountOnExit>
        <Popover.Context>
          {(popoverCtx) => (
            <Box {...(popoverCtx.getTriggerProps() as object)} width="full" height="full">
              <ChannelButton
                {...props}
                buttonProps={{
                  "aria-expanded": popoverCtx.open,
                }}
              />
            </Box>
          )}
        </Popover.Context>
        <Portal>
          <Popover.Positioner>
            <Popover.Content>
              <Popover.Arrow />
              <Popover.Body>
                <Popover.Title fontWeight="medium">{t("channel_empty_title")}</Popover.Title>
                <Text my="4">{t("channel_empty_body")}</Text>
                <Button onClick={() => empty!.init(index)}>{t("initialize")}</Button>
              </Popover.Body>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>
    );
  }

  return (
    <Drawer.Root
      lazyMount
      unmountOnExit
      open={open}
      onOpenChange={(e) => {
        if (!e.open) Actions.closeChannel();
      }}
    >
      <Drawer.Context>
        {(drawerCtx) => (
          <ChannelButton
            {...props}
            buttonProps={{
              "aria-expanded": drawerCtx.open,
            }}
          />
        )}
      </Drawer.Context>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header>
              <HStack flexGrow="1">
                <Drawer.Title flexGrow="1">{channel_value}</Drawer.Title>
                <Menu.Root unmountOnExit lazyMount>
                  <Menu.Trigger asChild>
                    <IconButton rounded="full" variant="ghost">
                      <TbMenu2 />
                    </IconButton>
                  </Menu.Trigger>
                  <Menu.Positioner>
                    <Menu.Content>
                      <ChannelMenuItems index={index} field={field} />
                    </Menu.Content>
                  </Menu.Positioner>
                </Menu.Root>
              </HStack>
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

  const [measureRef, { width }] = useMeasure();
  const listRef = useRef<HTMLDivElement>(null);

  const gap = 8;

  const length = useRadioOn(() => {
    if (!field.empty) return field.size;

    for (let i = field.size - 1; i >= 0; i -= 1) {
      if (!field.empty.get(i)) return Math.min(field.size, i + 2);
    }

    return 1;
  });

  const cardSize = { width: Math.max(200, width / 3 - gap), height: 80 };
  const cardsPerRow = Math.max(1, Math.floor((width + gap) / (cardSize.width + gap)));

  const virtualizer = useWindowVirtualizer({
    count: Math.ceil(length / cardsPerRow),
    estimateSize: () => cardSize.height,
    scrollMargin: listRef.current?.offsetTop,
    overscan: 1,
    gap,
  });

  return (
    <Box ref={measureRef} width="full">
      <Box ref={listRef} position="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          return (
            <HStack
              key={row.index}
              style={{
                position: "absolute",
                width: "100%",
                height: row.size,
                top: 0,
                left: 0,
                transform: `translateY(${row.start - listRef.current!.offsetTop}px)`,
              }}
            >
              {new Array(cardsPerRow).fill(0).map((_, c) => {
                const index = row.index * cardsPerRow + c;
                if (index >= length) return null;

                return (
                  <Box key={index} style={{ width: cardSize.width, height: cardSize.height }}>
                    <ChannelCard field={field} index={index} />
                  </Box>
                );
              })}
            </HStack>
          );
        })}
      </Box>
    </Box>
  );
}
