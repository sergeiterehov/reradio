import { useStore } from "zustand";
import { ButtonGroup, HStack, Icon, IconButton, Progress, Tabs, Text } from "@chakra-ui/react";
import { TbEdit, TbEye, TbRadar2 } from "react-icons/tb";
import { Actions, Store } from "./store";
import { AnyField } from "./components/fields";

function App() {
  const radio = useStore(Store, (s) => s.radio);
  const progress = useStore(Store, (s) => s.progress);

  const ui = radio?.ui();

  return (
    <>
      <HStack>
        <HStack>
          <Icon size="lg">
            <TbRadar2 />
          </Icon>
          <Text fontWeight="bold" fontSize="lg">
            ReRadio
          </Text>
        </HStack>
        <Text>{radio ? [radio.vendor, radio.model].join(" ") : "ReRadio"}</Text>
        <ButtonGroup variant="ghost">
          <IconButton colorPalette="blue" onClick={() => Actions.download()}>
            <TbEye />
          </IconButton>
          <IconButton colorPalette="green" onClick={() => Actions.upload()}>
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
      </HStack>
      {(() => {
        if (!ui) return;

        const tabs = [...new Set(ui.map((f) => f.tab))];

        return (
          <Tabs.Root variant="subtle" defaultValue={tabs[0]} orientation="vertical">
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
                  {ui
                    .filter((f) => f.tab === tab)
                    .map((field) => (
                      <AnyField key={field.id} field={field} />
                    ))}
                </Tabs.Content>
              );
            })}
          </Tabs.Root>
        );
      })()}
    </>
  );
}

export default App;
