import { RadioWatch } from "@/components/RadioWatch";
import { useRadioOn } from "@/components/useRadioOn";
import { Store, Actions } from "@/store";
import { type UI } from "@/utils/ui";
import { Menu } from "@chakra-ui/react";
import { t } from "i18next";
import {
  TbLayoutSidebarRightExpand,
  TbCancel,
  TbCopyPlus,
  TbArrowNarrowRightDashed,
  TbTextSpellcheck,
  TbArrowBigRightLines,
  TbCopy,
  TbTransitionBottom,
  TbArrowBarToLeft,
  TbRadio,
  TbTrash,
} from "react-icons/tb";
import { useStore } from "zustand";

export function ChannelMenuItems(props: { field: UI.Field.Channels; index: number }) {
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
