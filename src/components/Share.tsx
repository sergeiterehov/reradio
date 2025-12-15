import { Actions, Store } from "@/store";
import { Button, Clipboard, IconButton, Input, InputGroup, Popover, Portal, Text } from "@chakra-ui/react";
import { TbLock, TbShare2 } from "react-icons/tb";
import { useStore } from "zustand";

export function Share() {
  const sharing = useStore(Store, (s) => s.sharing);

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
              <Popover.Title fontWeight="medium">Поделись настройками</Popover.Title>
              <Text my="4">
                Образ с настройками полностью сохранится в облаке. Можно будет вернутся к нему позже, или поделиться им
                с другими.
              </Text>
              {sharing?.loading !== false ? (
                <Button
                  variant="solid"
                  w="full"
                  loading={sharing?.loading}
                  onClick={() => {
                    Actions.fetchSharedLink();
                  }}
                >
                  Создать ссылку
                </Button>
              ) : "error" in sharing ? (
                <Text color="fg.error">{String(sharing.error)}</Text>
              ) : (
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
              )}
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
