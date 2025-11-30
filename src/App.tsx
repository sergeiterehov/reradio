import { useStore } from "zustand";
import { ButtonGroup, Fieldset, HStack, Icon, IconButton, Link, Stack, Tabs, Text } from "@chakra-ui/react";
import { TbBrandGithub, TbDeviceMobileSearch, TbDeviceMobileUp, TbRadar2 } from "react-icons/tb";
import { Actions, Store } from "./store";
import { AnyField } from "./components/fields/AnyField";
import { RadioSelector } from "./components/RadioSelector";
import { ChromeOnly } from "./components/ChormeOnly";
import { Hello } from "./components/Hello";
import { useEffect, useState } from "react";
import { Toaster, toaster } from "./components/ui/toaster";
import { TaskProgress } from "./components/TaskProgress";
import { Tooltip } from "./components/ui/tooltip";
import type { UI } from "@/utils/ui";
import { useTranslation } from "react-i18next";

function App() {
  const radio = useStore(Store, (s) => s.radio);
  const active_task = useStore(Store, (s) => s.task !== undefined);

  const { t } = useTranslation();

  const [ui, setUI] = useState<UI.Root>();
  useEffect(() => {
    setUI(radio.ui());
    return radio.subscribe_ui_change(() => setUI(radio.ui()));
  }, [radio]);

  const [activeTab, setActiveTab] = useState<string>("");
  useEffect(() => {
    setActiveTab((prev) => {
      if (!ui) return prev;

      const tabs = [...new Set(ui.fields.map((f) => f.tab))];
      return tabs.at(0) ?? prev;
    });
  }, [ui]);

  // Вывод не отловленных ошибок
  useEffect(() => {
    const controller = new AbortController();

    window.addEventListener(
      "error",
      (e) => {
        toaster.error({ title: t("error_unexpected"), description: String(e.error) });
      },
      { signal: controller.signal }
    );
    window.addEventListener(
      "unhandledrejection",
      (e) => {
        toaster.error({ title: t("error_unexpected"), description: String(e.reason) });
      },
      { signal: controller.signal }
    );

    return () => controller.abort();
  }, [t]);

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
            <Tooltip content={t("download_from_radio")}>
              <IconButton disabled={active_task} colorPalette="blue" rounded="full" onClick={() => Actions.download()}>
                <TbDeviceMobileSearch />
              </IconButton>
            </Tooltip>
            <Tooltip content={t("upload_to_radio")}>
              <IconButton disabled={active_task} colorPalette="green" rounded="full" onClick={() => Actions.upload()}>
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
          const fields = ui?.fields.filter((f) => f.type !== "none");

          if (!fields?.length) return <Hello />;

          const tabs = [...new Set(fields.map((f) => f.tab))];

          return (
            <Tabs.Root
              lazyMount
              unmountOnExit
              variant="subtle"
              value={activeTab}
              onValueChange={(e) => setActiveTab(e.value)}
              orientation="vertical"
              px="3"
            >
              <Tabs.List flexShrink="0">
                {tabs.map((tab) => (
                  <Tabs.Trigger key={tab} value={String(tab)}>
                    {tab ?? t("uitab_misc")}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>

              {tabs.map((tab) => {
                if (tab !== activeTab) return null;

                return (
                  <Tabs.Content key={tab} value={String(tab)} flexGrow="1">
                    <Fieldset.Root>
                      <Fieldset.Content>
                        {fields
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
