import type { UI } from "@/drivers/ui";
import { Field, Input } from "@chakra-ui/react";
import { useRadioOn } from "../useRadioOn";
import { useCallback, useEffect, useState } from "react";

export function CharsField(props: { field: UI.Field.Chars }) {
  const { field } = props;
  const value = useRadioOn(field.get) as number[];

  const padChar = field.pad[0];
  const padIndex = Math.max(0, field.abc.indexOf(padChar));

  const getText = useCallback((val: number[]) => val.map((c) => field.abc[c]).join(""), [field.abc]);

  const [text, setText] = useState(getText(field.get() as number[]));
  useEffect(() => setText(getText(value)), [value, getText]);

  return (
    <Field.Root>
      <Field.Label>{field.name}</Field.Label>
      <Input
        placeholder="Empty"
        value={text}
        onChange={(e) => {
          const newText = e.currentTarget.value;
          setText(field.uppercase ? newText.toUpperCase() : newText);
        }}
        maxLength={field.length}
        onBlur={() => {
          const bytes = text
            .padEnd(field.length, padChar)
            .substring(0, field.length)
            .split("")
            .map((c) => {
              const index = field.abc.indexOf(c);
              if (index === -1) return padIndex;
              return index;
            });

          try {
            field.set(bytes);
          } finally {
            setText(getText(field.get() as number[]));
          }
        }}
      />
      <Field.HelperText>{field.description}</Field.HelperText>
    </Field.Root>
  );
}
