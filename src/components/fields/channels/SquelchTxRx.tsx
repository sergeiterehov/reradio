import { Tooltip } from "@/components/ui/tooltip";
import { useRadioOn } from "@/components/useRadioOn";
import { type UI } from "@/utils/ui";
import { Stack, Field, NativeSelect, InputGroup, NumberInput, Button } from "@chakra-ui/react";
import { t } from "i18next";
import { useState } from "react";
import { TbHelp } from "react-icons/tb";

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

export function SquelchTxRx(props: {
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
