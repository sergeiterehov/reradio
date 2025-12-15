import { useStore } from "zustand";
import { ButtonGroup, Fieldset, HStack, Icon, IconButton, Link, Skeleton, Stack, Tabs, Text } from "@chakra-ui/react";
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
import { Share } from "./components/Share";

const urlRegex = /^#s\/(?<id>[a-zA-Z_0-9]+)$/;

function App() {
  const radio = useStore(Store, (s) => s.radio);
  const sharing = useStore(Store, (s) => s.sharing);
  const active_task = useStore(Store, (s) => s.task !== undefined);

  useEffect(() => {
    if (!import.meta.env.VITE_CLOUD_API) return;

    const hash = window.location.hash;
    if (!hash) return;
    const match = urlRegex.exec(hash);
    if (!match) return;
    const { id } = match.groups!;
    if (!id) return;

    Actions.fetchSharedSnapshot(id);
  }, []);

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
            {import.meta.env.VITE_CLOUD_API && ui && ui.fields.length > 0 && <Share />}
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

          if (!fields?.length) {
            if (sharing?.loading) {
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

            return <Hello />;
          }

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
