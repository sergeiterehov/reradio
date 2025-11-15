import { Stack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { TbRadar2 } from "react-icons/tb";

export function Hello() {
  const { t } = useTranslation();

  return (
    <Stack height="calc(100vh - 60px)" justify="center" align="center" color="fg.subtle">
      <TbRadar2 size={128} />
      <Text>{t("hello_steps")}</Text>
      <Text fontSize="xs">{t("build_number", { replace: { number: import.meta.env.VITE_BUILD || "-" } })}</Text>
    </Stack>
  );
}
