import type { UI } from "@/utils/ui";
import { Field, HStack, Slider, Text } from "@chakra-ui/react";
import { useRadioOn } from "../useRadioOn";

export function SliderField(props: { field: UI.Field.Slider }) {
  const { field } = props;
  const value = useRadioOn(field.get);

  return (
    <Field.Root>
      <Slider.Root
        w="full"
        min={field.min}
        max={field.max}
        value={[Number(value)]}
        onValueChange={(e) => field.set(e.value[0])}
      >
        <HStack justify="space-between">
          <Slider.Label>{field.name}</Slider.Label>
          <Text>{field.label ? field.label(Number(value)) : String(value)}</Text>
        </HStack>
        <Slider.Control>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumbs />
        </Slider.Control>
      </Slider.Root>
      <Field.HelperText>{field.description}</Field.HelperText>
    </Field.Root>
  );
}
