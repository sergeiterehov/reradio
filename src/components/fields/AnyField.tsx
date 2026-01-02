import type { UI } from "@/utils/ui";
import { ChannelsField } from "./channels/ChannelsField";
import { SelectField } from "./SelectField";
import { SwitcherField } from "./SwitcherField";
import { LabelField } from "./LabelField";
import { SliderField } from "./SliderField";
import { TextField } from "./TextField";
import { CharsField } from "./CharsField";
import { FileField } from "./FileField";
import { ContactsField } from "./ContactsField";
import { TableField } from "./TableField";

export function AnyField(props: { field: UI.Field.Any }) {
  const { field } = props;

  if (field.type === "channels") return <ChannelsField field={field} />;
  if (field.type === "label") return <LabelField field={field} />;
  if (field.type === "switcher") return <SwitcherField field={field} />;
  if (field.type === "select") return <SelectField field={field} />;
  if (field.type === "slider") return <SliderField field={field} />;
  if (field.type === "text") return <TextField field={field} />;
  if (field.type === "chars") return <CharsField field={field} />;
  if (field.type === "file") return <FileField field={field} />;
  if (field.type === "contacts") return <ContactsField field={field} />;
  if (field.type === "table") return <TableField field={field} />;

  return null;
}
