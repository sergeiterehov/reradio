import type { UI } from "@/drivers/ui";
import { ChannelsField } from "./ChannelsField";
import { SelectField } from "./SelectField";
import { SwitcherField } from "./SwitcherFirld";

export function AnyField(props: { field: UI.Field.Any }) {
  const { field } = props;

  if (field.type === "channels") return <ChannelsField field={field} />;
  if (field.type === "switcher") return <SwitcherField field={field} />;
  if (field.type === "select") return <SelectField field={field} />;

  return null;
}
