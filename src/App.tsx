import { useStore } from "zustand";
import { ButtonGroup, Fieldset, HStack, Icon, IconButton, Link, Stack, Tabs, Text } from "@chakra-ui/react";
import { TbBrandGithub, TbDeviceMobileSearch, TbDeviceMobileUp, TbRadar2 } from "react-icons/tb";
import { Actions, Store } from "./store";
import { AnyField } from "./components/fields/AnyField";
import { RadioSelector } from "./components/RadioSelector";
import { ChromeOnly } from "./components/ChormeOnly";
import { Hello } from "./components/Hello";
import { useEffect, useSyncExternalStore } from "react";
import { Toaster, toaster } from "./components/ui/toaster";
import { TaskProgress } from "./components/TaskProgress";
import { Tooltip } from "./components/ui/tooltip";

function App() {
  const radio = useStore(Store, (s) => s.radio);

  const ui = radio.ui();
  useSyncExternalStore(radio.subscribe_ui, () => radio.ui().fields.length);

  // Вывод не отловленных ошибок
  useEffect(() => {
    const controller = new AbortController();

    window.addEventListener(
      "error",
      (e) => {
        toaster.error({ title: "Unexpected error", description: String(e.error) });
      },
      { signal: controller.signal }
    );
    window.addEventListener(
      "unhandledrejection",
      (e) => {
        toaster.error({ title: "Unexpected error", description: String(e.reason) });
      },
      { signal: controller.signal }
    );

    return () => controller.abort();
  }, []);

  return (
    <Stack alignItems="center">
      <Toaster />
      <ChromeOnly />
      <Stack gap="3" maxW="920px" width="100%">
        <HStack p="2" gap="4">
          <HStack>
            <Icon size="lg">
              <TbRadar2 />
            </Icon>
            <Text fontWeight="bold" fontSize="lg">
              ReRadio
            </Text>
          </HStack>
          <RadioSelector />
          <ButtonGroup variant="surface">
            <Tooltip content="Receive settings from the radio">
              <IconButton colorPalette="blue" rounded="full" onClick={() => Actions.download()}>
                <TbDeviceMobileSearch />
              </IconButton>
            </Tooltip>
            <Tooltip content="Send to radio">
              <IconButton colorPalette="green" rounded="full" onClick={() => Actions.upload()}>
                <TbDeviceMobileUp />
              </IconButton>
            </Tooltip>
          </ButtonGroup>
          <TaskProgress />
          <IconButton asChild rounded="full" variant="ghost">
            <Link href="https://github.com/sergeiterehov/reradio" target="_blank" rel="noopener noreferrer">
              <TbBrandGithub />
            </Link>
          </IconButton>
        </HStack>
        {(() => {
          if (!ui?.fields.length) return <Hello />;

          const tabs = [...new Set(ui.fields.map((f) => f.tab))];

          return (
            <Tabs.Root lazyMount unmountOnExit variant="subtle" defaultValue={tabs[0]} orientation="vertical" px="3">
              <Tabs.List flexShrink="0">
                {tabs.map((tab) => (
                  <Tabs.Trigger key={tab} value={String(tab)}>
                    {tab ?? "Misc"}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>

              {tabs.map((tab) => {
                return (
                  <Tabs.Content key={tab} value={String(tab)}>
                    <Fieldset.Root>
                      <Fieldset.Content>
                        {ui.fields
                          .filter((f) => f.tab === tab)
                          .map((field) => (
                            <AnyField key={field.id} field={field} />
                          ))}
                      </Fieldset.Content>
                    </Fieldset.Root>
                  </Tabs.Content>
                );
              })}
            </Tabs.Root>
          );
        })()}
      </Stack>
    </Stack>
  );
}

export default App;
