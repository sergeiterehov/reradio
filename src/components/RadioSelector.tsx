import { Library } from "@/drivers/_library";
import type { Radio } from "@/drivers/_radio";
import { Actions, Store } from "@/store";
import {
  Box,
  Button,
  createListCollection,
  HStack,
  IconButton,
  Menu,
  Portal,
  Select,
  Separator,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TbHistory, TbPlus, TbTextSpellcheck, TbTrash } from "react-icons/tb";
import { useStore } from "zustand";

function HistoryList() {
  const { t } = useTranslation();

  const history = useStore(Store, (s) => s.history);
  const ui = useStore(Store, (s) => s.ui);

  const radios = new Map(Library.map((R) => [R.Info.id, R]));

  const [active_id, setActive_id] = useState<string>();

  useEffect(() => {
    Actions.refreshHistory();
  }, []);

  return (
    <Select.Context>
      {(select) => (
        <Menu.Root unmountOnExit lazyMount>
          <Menu.Context>
            {(menu) => (
              <Stack>
                <HStack mb="1">
                  <Button
                    flexGrow="1"
                    variant="outline"
                    rounded="lg"
                    disabled={!ui?.fields.length}
                    onClick={() => Actions.saveHistory()}
                  >
                    <TbPlus />
                    {t("history_save_current_state")}
                  </Button>
                  <IconButton
                    variant="outline"
                    rounded="lg"
                    disabled={history.length === 0}
                    onClick={() => confirm() && Actions.clearHistory()}
                  >
                    <TbTrash />
                  </IconButton>
                </HStack>
                {history.length === 0 && (
                  <Box color="fg.subtle" p="4" rounded="lg" textAlign="center">
                    {t("history_is_empty")}
                  </Box>
                )}
                {history.map((img) => {
                  const R = radios.get(img.radio_id);
                  if (!R) return null;

                  return (
                    <Button
                      key={img.id}
                      {...menu.getContextTriggerProps()}
                      aria-expanded={menu.open && active_id === img.id}
                      onMouseDown={() => setActive_id(img.id)}
                      variant="subtle"
                      textAlign="start"
                      p="2"
                      rounded="lg"
                      data-state="open"
                      overflow="hidden"
                      _open={{ animation: "fade-in 300ms ease-out" }}
                      onClick={() => {
                        Actions.openFromHistory(img.id);
                        select.setOpen(false);
                      }}
                    >
                      {img.name ? <Text truncate>{img.name}</Text> : null}
                      <Text flexGrow="1" fontWeight="normal">{`${R.Info.vendor} ${R.Info.model}`}</Text>
                      <Text color="fg.subtle" fontSize="xs">
                        {new Date(img.timestamp).toLocaleString()}
                      </Text>
                    </Button>
                  );
                })}
              </Stack>
            )}
          </Menu.Context>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item
                value="rename"
                onClick={() => {
                  const active = history.find((h) => h.id === active_id);
                  if (!active) return;
                  const newName = prompt("New name", active.name);
                  if (newName === null) return;
                  Actions.renameHistoryItem(active.id, newName);
                }}
              >
                <TbTextSpellcheck />
                {t("rename")}
              </Menu.Item>
              <Menu.Item
                value="delete"
                color="fg.error"
                _hover={{ bg: "bg.error", color: "fg.error" }}
                onClick={() => active_id && confirm() && Actions.deleteHistoryItem(active_id)}
              >
                <TbTrash />
                {t("delete")}
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      )}
    </Select.Context>
  );
}

export function RadioSelector() {
  const { t } = useTranslation();

  const radio = useStore(Store, (s) => s.radio);

  const vendors = [...new Set(Library.map((r) => r.Info.vendor))];

  const radios = createListCollection({
    items: Library.map((RadioClass, i) => ({
      RadioClass,
      value: i.toString(),
      label: `${RadioClass.Info.vendor} ${RadioClass.Info.model}`,
      vendor: RadioClass.Info.vendor,
    })),
  });

  return (
    <Select.Root
      unmountOnExit
      lazyMount
      collection={radios}
      value={[Library.indexOf(radio.constructor as typeof Radio).toString()]}
      onValueChange={(e) => {
        const RadioClass = Library.at(Number(e.value[0]));
        if (!RadioClass) return;
        Actions.changeRadio(RadioClass);
      }}
    >
      <Select.HiddenSelect />
      <Select.Control>
        <Select.Trigger rounded="full" cursor="pointer">
          <HStack flexGrow="1" justifyContent="center">
            <Select.ValueText textAlign="center" />
            <Select.Indicator />
          </HStack>
        </Select.Trigger>
      </Select.Control>
      <Portal>
        <Select.Positioner>
          <Select.Content borderRadius="2xl" p="0" shadow="lg">
            <Tabs.Root
              defaultValue={vendors[0]}
              lazyMount
              unmountOnExit
              variant="line"
              orientation="vertical"
              css={{ "& .chakra-tabs__content": { flexGrow: 1, p: 4, overflow: "hidden" } }}
            >
              <Tabs.List py="4">
                <Tabs.Trigger value="history">
                  <TbHistory />
                  {t("history")}
                </Tabs.Trigger>
                <Separator />
                {vendors.map((vendor, i) => (
                  <Tabs.Trigger key={i} value={vendor}>
                    {vendor}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
              <Tabs.Content value="history">
                <HistoryList />
              </Tabs.Content>
              {vendors.map((vendor) => (
                <Tabs.Content key={vendor} value={vendor}>
                  <Stack gap="2">
                    {radios.items
                      .filter((item) => item.vendor === vendor)
                      .map((item) => (
                        <Select.Item
                          item={item}
                          key={item.value}
                          py="1"
                          px="2"
                          fontSize="xs"
                          fontWeight="medium"
                          bg="bg.subtle"
                          borderRadius="md"
                          cursor="pointer"
                          _hover={{ bg: "colorPalette.subtle" }}
                          _selected={{ bg: "colorPalette.muted", _hover: { bg: "colorPalette.muted" } }}
                        >
                          <Box flexGrow="1">{item.RadioClass.Info.model}</Box>
                          <Select.ItemIndicator />
                        </Select.Item>
                      ))}
                  </Stack>
                </Tabs.Content>
              ))}
            </Tabs.Root>
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  );
}
