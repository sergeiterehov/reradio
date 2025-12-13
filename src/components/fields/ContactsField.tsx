import type { UI } from "@/utils/ui";
import {
  Box,
  Button,
  Field,
  Fieldset,
  HStack,
  Input,
  InputGroup,
  Menu,
  NativeSelect,
  NumberInput,
  Popover,
  Portal,
  SegmentGroup,
} from "@chakra-ui/react";
import { useMeasure } from "react-use";
import { TbHelp, TbTrash, TbUsersGroup, TbUserSquareRounded } from "react-icons/tb";
import { useTranslation } from "react-i18next";
import { Tooltip } from "../ui/tooltip";
import { DMR_ALL_CALL_ID } from "@/utils/radio";
import { useRadioOn } from "../useRadioOn";
import { useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

let idLastFormat: "10" | "HEX" = "10";

function ContactDetails(props: { field: UI.Field.Contacts; index: number }) {
  const { field, index } = props;

  const [format, setFormat] = useState(idLastFormat);
  idLastFormat = format;

  const { t } = useTranslation();
  const contact = useRadioOn(() => field.get(index));

  if (!contact) return;

  return (
    <Fieldset.Root>
      <Fieldset.Content>
        <Field.Root>
          <Field.Label>{t("contact_name")}</Field.Label>
          <HStack>
            <Input
              flexGrow={1}
              value={contact.name}
              onChange={(e) => field.set?.(index, { ...contact, name: e.currentTarget.value as UI.DMRContactType })}
            />
            <Field.Root width="auto">
              <SegmentGroup.Root
                value={contact.type}
                onValueChange={(e) => field.set?.(index, { ...contact, type: e.value as UI.DMRContactType })}
              >
                <SegmentGroup.Indicator />
                <SegmentGroup.Items
                  items={[
                    { value: "Individual", label: <TbUserSquareRounded /> },
                    { value: "Group", label: <TbUsersGroup /> },
                  ]}
                />
              </SegmentGroup.Root>
            </Field.Root>
          </HStack>
        </Field.Root>
        <Field.Root>
          <Field.Label>
            {t("dmr_contact_id")}
            <Tooltip content={t("dmr_contact_id_tooltip")}>
              <TbHelp />
            </Tooltip>
          </Field.Label>
          <InputGroup
            flex="1"
            endElement={
              <NativeSelect.Root size="xs" variant="plain" width="auto" me="-1">
                <NativeSelect.Field
                  fontSize="sm"
                  value={format}
                  onChange={(e) => setFormat(e.currentTarget.value as typeof format)}
                >
                  <option value="10">10</option>
                  <option value="HEX">HEX</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            }
          >
            {format === "HEX" ? (
              <Input
                value={contact.id.toString(16)}
                onChange={(e) =>
                  field.set?.(index, {
                    ...contact,
                    id: Number.parseInt(e.currentTarget.value.replaceAll(/[^0-9a-f]/g, ""), 16),
                  })
                }
              />
            ) : (
              <NumberInput.Root
                width="full"
                value={String(contact.id)}
                onValueChange={(e) => field.set?.(index, { ...contact, id: e.valueAsNumber })}
                min={1}
                max={DMR_ALL_CALL_ID}
              >
                <NumberInput.Input />
              </NumberInput.Root>
            )}
          </InputGroup>
        </Field.Root>
      </Fieldset.Content>
    </Fieldset.Root>
  );
}

function ContactCard(props: { field: UI.Field.Contacts; index: number }) {
  const { field, index } = props;

  const { t } = useTranslation();
  const contact = useRadioOn(() => field.get(index));

  if (!contact) {
    return (
      <Button
        width="full"
        height="full"
        variant="subtle"
        color="fg.subtle"
        onClick={() => field.set?.(index, { id: index + 1, type: "Individual", name: "" })}
      >
        {index + 1} / {field.size}
      </Button>
    );
  }

  return (
    <Menu.Root lazyMount unmountOnExit>
      <Popover.Root lazyMount unmountOnExit>
        <Popover.Context>
          {(popover) => (
            <Menu.Context>
              {(menu) => (
                <Box width="full" height="full" {...(menu.getContextTriggerProps() as object)}>
                  <Button
                    width="full"
                    height="full"
                    variant="outline"
                    color={!contact.name ? "fg.muted" : undefined}
                    fontWeight={contact.type === "Group" ? "bolder" : undefined}
                    justifyContent="start"
                    aria-expanded={popover.open}
                    {...popover.getTriggerProps()}
                  >
                    {contact.type === "Group" ? (
                      <TbUsersGroup />
                    ) : contact.type === "Individual" ? (
                      <TbUserSquareRounded />
                    ) : null}
                    {contact.id === DMR_ALL_CALL_ID ? t("all_call") : contact.name || `#${contact.id}`}
                  </Button>
                </Box>
              )}
            </Menu.Context>
          )}
        </Popover.Context>
        <Portal>
          <Popover.Positioner>
            <Popover.Content>
              <Popover.Arrow />
              <Popover.Body>
                <ContactDetails {...props} index={index} />
              </Popover.Body>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            {field.delete && (
              <Menu.Item
                value="delete"
                color="fg.error"
                _hover={{ bg: "bg.error", color: "fg.error" }}
                onClick={() => field.delete?.(index)}
              >
                <TbTrash />
                Delete
              </Menu.Item>
            )}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

export function ContactsField(props: { field: UI.Field.Contacts }) {
  const { field } = props;

  const [measureRef, { width }] = useMeasure();
  const listRef = useRef<HTMLDivElement>(null);

  const gap = 8;

  const length = useRadioOn(() => {
    for (let i = field.size; i > 1; i -= 1) {
      if (field.get(i - 2)) return i;
    }
    return field.size;
  });

  const cardSize = { width: Math.max(200, width / 3 - gap), height: 50 };
  const cardsPerRow = Math.max(1, Math.floor((width + gap) / (cardSize.width + gap)));

  const virtualizer = useWindowVirtualizer({
    count: Math.ceil(length / cardsPerRow),
    estimateSize: () => cardSize.height,
    scrollMargin: listRef.current?.offsetTop,
    overscan: 1,
    gap,
  });

  return (
    <Box ref={measureRef} width="full">
      <Box ref={listRef} position="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          return (
            <HStack
              key={row.index}
              style={{
                position: "absolute",
                width: "100%",
                height: row.size,
                top: 0,
                left: 0,
                transform: `translateY(${row.start - listRef.current!.offsetTop}px)`,
              }}
            >
              {new Array(cardsPerRow).fill(0).map((_, c) => {
                const index = row.index * cardsPerRow + c;
                if (index >= length) return null;

                return (
                  <Box key={index} style={{ width: cardSize.width, height: cardSize.height }}>
                    <ContactCard field={field} index={index} />
                  </Box>
                );
              })}
            </HStack>
          );
        })}
      </Box>
    </Box>
  );
}
