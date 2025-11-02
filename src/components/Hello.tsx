import { Stack, Text } from "@chakra-ui/react";
import { TbRadar2 } from "react-icons/tb";

export function Hello() {
  return (
    <Stack height="calc(100vh - 60px)" justify="center" align="center" color="fg.subtle">
      <TbRadar2 size={128} />
      <Text>Select your model, read, change, write, enjoy!</Text>
      <Text fontSize="xs">Build: {import.meta.env.VITE_BUILD || "-"}</Text>
    </Stack>
  );
}
