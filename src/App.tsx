import { useStore } from "zustand";
import { ButtonGroup, Fieldset, HStack, Icon, IconButton, Skeleton, Stack, Tabs, Text } from "@chakra-ui/react";
import { TbDeviceMobileSearch, TbDeviceMobileUp, TbRadar2 } from "react-icons/tb";
import { Actions, Store } from "./store";
import { AnyField } from "./components/fields/AnyField";
import { RadioSelector } from "./components/RadioSelector";
import { ChromeOnly } from "./components/ChormeOnly";
import { Hello } from "./components/Hello";
import { useEffect, useState } from "react";
import { Toaster, toaster } from "./components/ui/toaster";
import { TaskProgress } from "./components/TaskProgress";
import { Tooltip } from "./components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { Share } from "./components/Share";

function App() {
  const init = useStore(Store, (s) => s.init);
  const task = useStore(Store, (s) => s.task);
  const ui = useStore(Store, (s) => s.ui);

  const { t } = useTranslation();

  useEffect(() => {
    Actions.init();
  }, []);

  const [activeTab, setActiveTab] = useState<string>("");
  useEffect(() => {
    setActiveTab((prev) => {
      if (!ui) return prev;

      const tabs_set = new Set(ui.fields.map((f) => f.tab));
      if (tabs_set.has(prev)) return prev;

      return tabs_set.values().next().value ?? prev;
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
    <Stack alignItems="center" minW={600}>
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
              <IconButton disabled={Boolean(task)} colorPalette="blue" rounded="full" onClick={() => Actions.read()}>
                <TbDeviceMobileSearch />
              </IconButton>
            </Tooltip>
            <Tooltip content={t("upload_to_radio")}>
              <IconButton disabled={Boolean(task)} colorPalette="green" rounded="full" onClick={() => Actions.write()}>
                <TbDeviceMobileUp />
              </IconButton>
            </Tooltip>
            {import.meta.env.VITE_CLOUD_API && ui && ui.fields.length > 0 && <Share />}
          </ButtonGroup>
          <TaskProgress />
        </HStack>
        {(() => {
          const fields = ui?.fields.filter((f) => f.type !== "none");

          if (task || init !== "DONE") {
            return (
              <HStack gap="5" alignItems="start">
                <Stack width={200} gap="5">
                  <Skeleton height="8" width="90%" />
                  <Skeleton height="8" width="60%" />
                  <Skeleton height="8" width="80%" />
                  <Skeleton height="8" width="40%" />
                </Stack>
                <HStack flex="1" gap="2" flexWrap="wrap">
                  <Skeleton width="30%" height="80px" />
                  <Skeleton width="30%" height="80px" />
                  <Skeleton width="30%" height="80px" />
                  <Skeleton width="30%" height="80px" />
                  <Skeleton width="30%" height="80px" />
                  <Skeleton width="30%" height="80px" />
                  <Skeleton width="30%" height="80px" />
                  <Skeleton width="30%" height="80px" />
                </HStack>
              </HStack>
            );
          }

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
