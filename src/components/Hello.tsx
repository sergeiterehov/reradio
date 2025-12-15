import { Demos } from "@/drivers/library";
import { Actions, Store } from "@/store";
import { Button, Heading, HStack, IconButton, Link, Stack, Tabs, Text } from "@chakra-ui/react";
import { Buffer } from "buffer";
import { useTranslation } from "react-i18next";
import { TbBrandGithub, TbBrandTelegram } from "react-icons/tb";

export function Hello() {
  const { t } = useTranslation();

  return (
    <HStack justify="center" h="calc(100vh - 100px)">
      <HStack gap="10" alignItems="start">
        <Stack gap="4">
          <Stack>
            {[...Demos.keys()].map((R, i, all) => (
              <Button
                variant="subtle"
                rounded="xl"
                height="auto"
                py="1"
                px="3"
                justifyContent="start"
                style={{ opacity: 1 - i / all.length }}
                onClick={async () => {
                  Actions.changeRadio(R);
                  const radio = Store.getState().radio;
                  Demos.get(R)!().then(({ default: img }) => radio.load(Buffer.from(img, "hex")));
                }}
              >{`${R.Info.vendor} ${R.Info.model}`}</Button>
            ))}
          </Stack>
        </Stack>
        <Stack maxW={250} gap="4" color="fg.muted">
          <Text>{t("about_short")}</Text>
          <HStack>
            <IconButton asChild rounded="full" variant="subtle">
              <Link href="https://t.me/reradio" target="_blank" rel="noopener noreferrer">
                <TbBrandTelegram />
              </Link>
            </IconButton>
            <IconButton asChild rounded="full" variant="subtle">
              <Link href="https://github.com/sergeiterehov/reradio" target="_blank" rel="noopener noreferrer">
                <TbBrandGithub />
              </Link>
            </IconButton>
          </HStack>
          <Text fontSize="xs">{t("build_number", { replace: { number: import.meta.env.VITE_BUILD || "-" } })}</Text>
        </Stack>
      </HStack>
    </HStack>
  );
}
