import { bands } from "@/bands";
import { Stack, HStack, Heading, Link, Box, Separator, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { Fragment } from "react/jsx-runtime";

export function FrequencySelector(props: { onSelect: (config: { freq: number }) => void }) {
  const { onSelect } = props;

  const { t } = useTranslation();

  return (
    <Stack gap="4">
      {bands.map((b) => {
        return (
          <Fragment key={b.id}>
            <Stack>
              <HStack>
                <Heading size="md" flexGrow="1">
                  {b.name}
                </Heading>
                <Text fontFamily="monospace">
                  <Link
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelect({ freq: b.freqMin });
                    }}
                  >
                    {(b.freqMin / 1_000_000).toString()}
                  </Link>
                  {" - "}
                  <Link
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelect({ freq: b.freqMax });
                    }}
                  >
                    {(b.freqMax / 1_000_000).toString()}
                  </Link>
                  {` ${t("mhz")}`}
                </Text>
              </HStack>
              <Text>{b.description}</Text>
              {b.channels && (
                <Stack>
                  {b.channels.map((ch) => {
                    return (
                      <HStack key={ch.number}>
                        <Text>{ch.name}</Text>
                        <Box flexGrow="1" borderBottom="dotted" borderColor="fg.subtle" />
                        <Link
                          fontFamily="monospace"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onSelect({ freq: ch.freq });
                          }}
                        >
                          {(ch.freq / 1_000_000).toFixed(6)}
                        </Link>
                      </HStack>
                    );
                  })}
                </Stack>
              )}
              <Text fontSize="xs">{b.hint}</Text>
            </Stack>
            <Separator />
          </Fragment>
        );
      })}
    </Stack>
  );
}
