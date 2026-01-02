import type { UI } from "@/utils/ui";
import {
  Drawer,
  Button,
  Stack,
  HStack,
  Box,
  Portal,
  Text,
  IconButton,
  Popover,
  Menu,
  type ButtonProps,
} from "@chakra-ui/react";
import { RadioWatch } from "../../RadioWatch";
import { useRadioOn } from "../../useRadioOn";
import { TbMenu2 } from "react-icons/tb";
import { useRef } from "react";
import { t } from "i18next";
import { Actions, Store } from "@/store";
import { useStore } from "zustand";
import { useMeasure } from "react-use";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { ChannelForm, SlotNames } from "./ChannelForm";
import { ChannelMenuItems } from "./ChannelMenuItems";

function Channel(props: { field: UI.Field.Channels; index: number }) {
  const { field, index } = props;
  const { digital, freq, offset, mode, channel, squelch_rx, dmr_slot, dmr_color_code } = field;

  const channel_value = useRadioOn(() => channel.get(index));
  const is_digital = useRadioOn(() => digital?.get(index));
  const freq_value = useRadioOn(() => freq?.get(index));
  const offset_value = useRadioOn(() => offset?.get(index));
  const squelch_rx_value = useRadioOn(() => squelch_rx?.get(index));

  return (
    <Stack overflow="hidden" flexGrow="1">
      <HStack>
        <Box fontWeight="bolder" fontSize="lg">
          {freq_value ? freq_value / 1_000_000 : "-"}
        </Box>
        {is_digital ? (
          <Box>DMR</Box>
        ) : (
          <RadioWatch on={() => mode && mode.options[mode.get(index)]}>
            {(mode_value) => (mode_value ? <Box>{mode_value}</Box> : null)}
          </RadioWatch>
        )}
        {offset_value ? <Box>{`${offset_value > 0 ? "+" : ""}${offset_value / 1_000_000}`}</Box> : null}
        <Box fontSize="2xs" textOverflow="ellipsis" overflow="hidden" flexGrow="1" textAlign="end">
          {channel_value}
        </Box>
      </HStack>
      {is_digital ? (
        <Box>
          <RadioWatch
            on={() => ({
              slot: dmr_slot ? dmr_slot.options[dmr_slot.get(index)] : undefined,
              cc: dmr_color_code?.get(index),
            })}
          >
            {({ slot, cc }) => {
              return [slot && SlotNames[slot], cc !== undefined && `CC-${cc}`].filter(Boolean).join(", ");
            }}
          </RadioWatch>
        </Box>
      ) : (
        <Box>
          {(() => {
            if (!squelch_rx_value || squelch_rx_value.mode === "Off") return t("no_squelch");

            if (squelch_rx_value.mode === "CTCSS") return `CTCSS ${squelch_rx_value.freq}`;
            if (squelch_rx_value.mode === "DCS")
              return `DCS D${squelch_rx_value.code.toString().padStart(3, "0")}${squelch_rx_value.polarity}`;

            return "?";
          })()}
        </Box>
      )}
    </Stack>
  );
}

function ChannelButton(props: {
  field: UI.Field.Channels;
  index: number;
  buttonProps?: ButtonProps;
  onChannelOpen?(): void;
}) {
  const { field, index, buttonProps } = props;
  const { empty } = field;

  const selectionMode = useStore(Store, (s) => Boolean(s.selectedChannels.get(field.id)?.size));
  const selected = useStore(Store, (s) => s.selectedChannels.get(field.id)?.has(index));

  const empty_value = useRadioOn(() => empty?.get(index));

  return (
    <Menu.Root unmountOnExit lazyMount>
      <Menu.Context>
        {(menuCtx) => (
          <Button
            {...menuCtx.getContextTriggerProps()}
            variant={selected ? "solid" : empty_value ? "subtle" : "outline"}
            color={empty_value ? "fg.subtle" : undefined}
            p="3"
            fontFamily="monospace"
            width="full"
            height="full"
            textAlign="start"
            alignItems={empty_value ? undefined : "start"}
            onClick={(e) => {
              if (selectionMode) {
                if (e.shiftKey) {
                  Actions.toggleChannelSelectionTo(index, field);
                } else {
                  Actions.toggleChannelSelection(index, field);
                }
              } else if (e.shiftKey) {
                Actions.setChannelSelection(index, true, field);
              } else if (!empty_value) {
                Actions.openChannel(index, field);
              } else {
                return;
              }

              e.preventDefault();
              e.stopPropagation();
            }}
            {...buttonProps}
          >
            {empty_value ? `${index + 1}` : <Channel {...props} />}
          </Button>
        )}
      </Menu.Context>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <ChannelMenuItems index={index} field={field} />
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

function ChannelCard(props: { field: UI.Field.Channels; index: number }) {
  const { field, index } = props;
  const { empty, channel } = field;

  const open = useStore(Store, (s) => s.openedChannel?.field_id === field.id && s.openedChannel.index === index);

  const empty_value = useRadioOn(() => empty?.get(index));
  const channel_value = useRadioOn(() => channel.get(index));

  if (empty_value) {
    return (
      <Popover.Root lazyMount unmountOnExit>
        <Popover.Context>
          {(popoverCtx) => (
            <Box {...(popoverCtx.getTriggerProps() as object)} width="full" height="full">
              <ChannelButton
                {...props}
                buttonProps={{
                  "aria-expanded": popoverCtx.open,
                }}
              />
            </Box>
          )}
        </Popover.Context>
        <Portal>
          <Popover.Positioner>
            <Popover.Content>
              <Popover.Arrow />
              <Popover.Body>
                <Popover.Title fontWeight="medium">{t("channel_empty_title")}</Popover.Title>
                <Text my="4">{t("channel_empty_body")}</Text>
                <Button onClick={() => empty!.init(index)}>{t("initialize")}</Button>
              </Popover.Body>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>
    );
  }

  return (
    <Drawer.Root
      lazyMount
      unmountOnExit
      open={open}
      onOpenChange={(e) => {
        if (!e.open) Actions.closeChannel();
      }}
    >
      <Drawer.Context>
        {(drawerCtx) => (
          <ChannelButton
            {...props}
            buttonProps={{
              "aria-expanded": drawerCtx.open,
            }}
          />
        )}
      </Drawer.Context>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header>
              <HStack flexGrow="1">
                <Drawer.Title flexGrow="1">{channel_value}</Drawer.Title>
                <Menu.Root unmountOnExit lazyMount>
                  <Menu.Trigger asChild>
                    <IconButton rounded="full" variant="ghost">
                      <TbMenu2 />
                    </IconButton>
                  </Menu.Trigger>
                  <Menu.Positioner>
                    <Menu.Content>
                      <ChannelMenuItems index={index} field={field} />
                    </Menu.Content>
                  </Menu.Positioner>
                </Menu.Root>
              </HStack>
            </Drawer.Header>
            <Drawer.Body>
              <ChannelForm {...props} />
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}

export function ChannelsField(props: { field: UI.Field.Channels }) {
  const { field } = props;

  const [measureRef, { width }] = useMeasure();
  const listRef = useRef<HTMLDivElement>(null);

  const gap = 8;

  const length = useRadioOn(() => {
    if (!field.empty) return field.size;

    for (let i = field.size - 1; i >= 0; i -= 1) {
      if (!field.empty.get(i)) return Math.min(field.size, i + 2);
    }

    return 1;
  });

  const cardSize = { width: Math.max(200, width / 3 - gap), height: 80 };
  const cardsPerRow = Math.max(1, Math.floor((width + gap) / (cardSize.width + gap)));

  const virtualizer = useWindowVirtualizer({
    count: Math.ceil(length / cardsPerRow),
    estimateSize: () => cardSize.height,
    scrollMargin: listRef.current?.offsetTop,
    overscan: 1,
    gap,
  });

  return (
    <Box ref={measureRef} width="full">
      <Box ref={listRef} position="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          return (
            <HStack
              key={row.index}
              style={{
                position: "absolute",
                width: "100%",
                height: row.size,
                top: 0,
                left: 0,
                transform: `translateY(${row.start - listRef.current!.offsetTop}px)`,
              }}
            >
              {new Array(cardsPerRow).fill(0).map((_, c) => {
                const index = row.index * cardsPerRow + c;
                if (index >= length) return null;

                return (
                  <Box key={index} style={{ width: cardSize.width, height: cardSize.height }}>
                    <ChannelCard field={field} index={index} />
                  </Box>
                );
              })}
            </HStack>
          );
        })}
      </Box>
    </Box>
  );
}
