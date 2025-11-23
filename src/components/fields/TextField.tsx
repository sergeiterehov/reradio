import type { UI } from "@/utils/ui";
import { Field, Input } from "@chakra-ui/react";
import { useRadioOn } from "../useRadioOn";
import { useEffect, useState } from "react";

export function TextField(props: { field: UI.Field.Text }) {
  const { field } = props;
  const value = useRadioOn(field.get);

  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  return (
    <Field.Root>
      <Field.Label>{field.name}</Field.Label>
      <Input
        placeholder="Empty"
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        onBlur={() => {
          try {
            field.set(text);
          } finally {
            setText(String(field.get()));
          }
        }}
      />
      <Field.HelperText>{field.description}</Field.HelperText>
    </Field.Root>
  );
}
