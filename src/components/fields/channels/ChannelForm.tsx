import { bands } from "@/bands";
import { RadioWatch } from "@/components/RadioWatch";
import { useRadioOn } from "@/components/useRadioOn";
import { DMR_ALL_CALL_ID } from "@/utils/radio";
import type { UI } from "@/utils/ui";
import {
  Fieldset,
  Popover,
  Field,
  Spacer,
  Link,
  InputGroup,
  NumberInput,
  SegmentGroup,
  HStack,
  NativeSelect,
  Slider,
  Stack,
  Switch,
  Box,
  Text,
} from "@chakra-ui/react";
import { t } from "i18next";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { TbHelp } from "react-icons/tb";
import { AnyField } from "../AnyField";
import { FrequencySelector } from "./FrequencySelector";
import { SquelchTxRx } from "./SquelchTxRx";
import { Tooltip } from "@/components/ui/tooltip";

// eslint-disable-next-line react-refresh/only-export-components
export const SlotNames: { [K in UI.DMRSlot]: string } = {
  DualSlot: t("dmr_slot_dual"),
  "Slot-1": t("dmr_slot_1"),
  "Slot-2": t("dmr_slot_2"),
};

export function ChannelForm(props: { field: UI.Field.Channels; index: number }) {
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
