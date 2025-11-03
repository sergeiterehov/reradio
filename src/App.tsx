import { useStore } from "zustand";
import { ButtonGroup, Fieldset, HStack, Icon, IconButton, Link, Progress, Stack, Tabs, Text } from "@chakra-ui/react";
import { TbBrandGithub, TbEdit, TbEye, TbRadar2 } from "react-icons/tb";
import { Actions, Store } from "./store";
import { AnyField } from "./components/fields";
import { RadioSelector } from "./components/RadioSelector";
import { ChromeOnly } from "./components/ChormeOnly";
import { Hello } from "./components/Hello";
import { useEffect, useSyncExternalStore } from "react";
import { Toaster, toaster } from "./components/ui/toaster";
import { TaskProgress } from "./components/TaskProgress";

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
    <Stack gap="3">
      <Toaster />
      <ChromeOnly />
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
          <IconButton colorPalette="blue" rounded="full" onClick={() => Actions.download()}>
            <TbEye />
          </IconButton>
          <IconButton colorPalette="green" rounded="full" onClick={() => Actions.upload()}>
            <TbEdit />
          </IconButton>
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
  );
}

export default App;
