import type { UI } from "@/utils/ui";
import { CloseButton, Field, FileUpload, Input, InputGroup } from "@chakra-ui/react";
import { useRadioOn } from "../useRadioOn";
import { LuFileUp } from "react-icons/lu";

export function FileField(props: { field: UI.Field.File }) {
  const { field } = props;
  const value = useRadioOn(field.get);

  return (
    <Field.Root>
      <Field.Label>{field.name}</Field.Label>
      <FileUpload.Root
        gap="1"
        acceptedFiles={value ? [value] : []}
        onFileChange={(e) => field.set(e.acceptedFiles.at(0))}
      >
        <FileUpload.HiddenInput />
        <InputGroup
          startElement={<LuFileUp />}
          endElement={
            <FileUpload.ClearTrigger asChild>
              <CloseButton
                me="-1"
                size="xs"
                variant="plain"
                focusVisibleRing="inside"
                focusRingWidth="2px"
                pointerEvents="auto"
              />
            </FileUpload.ClearTrigger>
          }
        >
          <Input asChild>
            <FileUpload.Trigger>
              <FileUpload.FileText lineClamp={1} />
            </FileUpload.Trigger>
          </Input>
        </InputGroup>
      </FileUpload.Root>
      <Field.HelperText>{field.description}</Field.HelperText>
    </Field.Root>
  );
}
