import { Actions, Store } from "@/store";
import { Button, Clipboard, IconButton, Input, InputGroup, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { TbLock, TbShare2 } from "react-icons/tb";
import { useStore } from "zustand";

export function Share() {
  const sharing = useStore(Store, (s) => s.sharing);

  const { t } = useTranslation();

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <IconButton rounded="full">{sharing && "result" in sharing ? <TbLock /> : <TbShare2 />}</IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Arrow />
            <Popover.Body>
              <Popover.Title fontWeight="medium">{t("share_title")}</Popover.Title>
              <Text my="4">{t("share_description")}</Text>
              {sharing && "result" in sharing ? (
                <Clipboard.Root maxW="300px" value={sharing.result}>
                  <InputGroup
                    endElement={
                      <Clipboard.Trigger asChild>
                        <IconButton variant="surface" size="xs" me="-2">
                          <Clipboard.Indicator />
                        </IconButton>
                      </Clipboard.Trigger>
                    }
                  >
                    <Clipboard.Input asChild>
                      <Input />
                    </Clipboard.Input>
                  </InputGroup>
                </Clipboard.Root>
              ) : (
                <Stack>
                  <Button
                    variant="solid"
                    w="full"
                    loading={sharing?.loading}
                    onClick={() => {
                      Actions.fetchSharedLink();
                    }}
                  >
                    {t("share_get_link_btn")}
                  </Button>
                  {sharing && "error" in sharing && (
                    <Text color="fg.error" textAlign="center">
                      {String(sharing.error)}
                    </Text>
                  )}
                </Stack>
              )}
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
