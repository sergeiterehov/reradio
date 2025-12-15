import { Library } from "@/drivers/library";
import type { Radio } from "@/drivers/radio";
import { Actions, Store } from "@/store";
import { Box, createListCollection, HStack, Portal, Select, Stack, Tabs } from "@chakra-ui/react";
import { useStore } from "zustand";

export function RadioSelector() {
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
          <Select.Content borderRadius="2xl" p="4" shadow="lg">
            <Tabs.Root defaultValue={vendors[0]} lazyMount unmountOnExit variant="line" orientation="vertical">
              <Tabs.List>
                {vendors.map((vendor, i) => (
                  <Tabs.Trigger key={i} value={vendor}>
                    {vendor}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
              {vendors.map((vendor) => (
                <Tabs.Content key={vendor} value={vendor}>
                  <Stack direction="row" flexWrap="wrap" gap="2">
                    {radios.items
                      .filter((item) => item.vendor === vendor)
                      .map((item) => (
                        <Select.Item
                          item={item}
                          key={item.value}
                          flex="none"
                          py="2"
                          px="4"
                          bg="bg.subtle"
                          cursor="pointer"
                          _hover={{ bg: "colorPalette.subtle" }}
                          _selected={{ bg: "colorPalette.muted", _hover: { bg: "colorPalette.muted" } }}
                          borderRadius="lg"
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
