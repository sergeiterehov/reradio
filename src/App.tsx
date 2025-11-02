import { useStore } from "zustand";
import { ButtonGroup, HStack, Icon, IconButton, Link, Progress, Stack, Tabs, Text } from "@chakra-ui/react";
import { TbBrandGithub, TbEdit, TbEye, TbRadar2 } from "react-icons/tb";
import { Actions, Store } from "./store";
import { AnyField } from "./components/fields";
import { RadioSelector } from "./components/RadioSelector";
import { ChromeOnly } from "./components/ChormeOnly";

function App() {
  const radio = useStore(Store, (s) => s.radio);
  const progress = useStore(Store, (s) => s.progress);

  const ui = radio?.ui();

  return (
    <Stack gap="3">
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
        {typeof progress === "number" && (
          <Progress.Root width="200px" striped animated value={progress * 100}>
            <Progress.Track>
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>
        )}
        <IconButton asChild rounded="full" variant="ghost">
          <Link href="https://github.com/sergeiterehov/reradio" target="_blank" rel="noopener noreferrer">
            <TbBrandGithub />
          </Link>
        </IconButton>
      </HStack>
      {(() => {
        if (!ui) return;

        const tabs = [...new Set(ui.map((f) => f.tab))];

        return (
          <Tabs.Root variant="subtle" defaultValue={tabs[0]} orientation="vertical" px="3">
            <Tabs.List>
              {tabs.map((tab) => (
                <Tabs.Trigger key={tab} value={String(tab)}>
                  {tab ?? "Misc"}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {tabs.map((tab) => {
              return (
                <Tabs.Content key={tab} value={String(tab)}>
                  <Stack>
                    {ui
                      .filter((f) => f.tab === tab)
                      .map((field) => (
                        <AnyField key={field.id} field={field} />
                      ))}
                  </Stack>
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
