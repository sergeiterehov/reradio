import { Library } from "@/drivers/library";
import type { Radio } from "@/drivers/radio";
import { Actions, Store } from "@/store";
import {
  Box,
  Button,
  createListCollection,
  HStack,
  IconButton,
  Portal,
  Select,
  Separator,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { TbHistory, TbPlus, TbTrash } from "react-icons/tb";
import { useStore } from "zustand";

function HistoryList() {
  const { t } = useTranslation();

  const history = useStore(Store, (s) => s.history);
  const ui = useStore(Store, (s) => s.ui);

  const radios = new Map(Library.map((R) => [R.Info.id, R]));

  useEffect(() => {
    Actions.refreshHistory();
  }, []);

  return (
    <Select.Context>
      {(select) => (
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
              <HStack
                key={img.id}
                bg="bg.subtle"
                p="2"
                rounded="lg"
                cursor="pointer"
                _hover={{ bg: "bg.muted" }}
                onClick={() => {
                  Actions.openFromHistory(img.id);
                  select.setOpen(false);
                }}
              >
                {img.name ? <Text>{img.name}</Text> : null}
                <Text flexGrow="1">{`${R.Info.vendor} ${R.Info.model}`}</Text>
                <Text color="fg.subtle" fontSize="xs">
                  {new Date(img.timestamp).toLocaleString()}
                </Text>
              </HStack>
            );
          })}
        </Stack>
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
              css={{ "& .chakra-tabs__content": { flexGrow: 1, p: 4 } }}
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
