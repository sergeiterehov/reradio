import type { UI } from "@/drivers/ui";
import { ChannelsField } from "./ChannelsField";
import { SelectField } from "./SelectField";
import { SwitcherField } from "./SwitcherField";
import { LabelField } from "./LabelField";
import { SliderField } from "./SliderField";

export function AnyField(props: { field: UI.Field.Any }) {
  const { field } = props;

  if (field.type === "channels") return <ChannelsField field={field} />;
  if (field.type === "label") return <LabelField field={field} />;
  if (field.type === "switcher") return <SwitcherField field={field} />;
  if (field.type === "select") return <SelectField field={field} />;
  if (field.type === "slider") return <SliderField field={field} />;

  return null;
}
