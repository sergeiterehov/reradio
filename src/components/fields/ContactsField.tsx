"use client";

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
  SegmentGroup,
  Table,
} from "@chakra-ui/react";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { Store } from "@/store";
import { useWindowScroll } from "react-use";
import { MeasureBox } from "../ui/MeasureBox";
import { TbHelp, TbTrash, TbUsersGroup, TbUserSquareRounded } from "react-icons/tb";
import { useTranslation } from "react-i18next";
import { Tooltip } from "../ui/tooltip";
import { DMR_ALL_CALL_ID } from "@/utils/radio";
import { useRadioOn } from "../useRadioOn";

const cardSize = { width: 200, height: 40 };

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
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Arrow />
            <Popover.Body>
              <ContactDetails {...props} index={index} />
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Root>
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
    </Menu.Root>
  );
}

export function ContactsField(props: { field: UI.Field.Contacts }) {
  const { field } = props;

  useWindowScroll();

  const length = useRadioOn(() => {
    for (let i = field.size; i > 1; i -= 1) {
      if (field.get(i - 2)) return i;
    }
    return field.size;
  });

  return (
    <MeasureBox display="flex" width="full">
      {({ width }, container) => {
        const gap = 8;
        const overscroll = 100;

        const cardsPerRow = Math.max(1, Math.floor((width + gap) / (cardSize.width + gap)));
        const height = Math.ceil(length / cardsPerRow) * (cardSize.height + gap) - gap;

        const containerRect = container.getBoundingClientRect();

        const nodes: React.ReactNode[] = [];

        for (let i = 0; i < length; i += 1) {
          const row = Math.floor(i / cardsPerRow);
          const top = row * (cardSize.height + gap);
          const bottom = top + cardSize.height;

          if (bottom < -containerRect.top - overscroll) continue;
          if (top > -containerRect.top + window.innerHeight + overscroll) break;

          nodes.push(
            <div
              key={i}
              style={{
                position: "absolute",
                width: cardSize.width,
                height: cardSize.height,
                top: Math.floor(i / cardsPerRow) * (cardSize.height + gap),
                left: (i % cardsPerRow) * (cardSize.width + gap),
              }}
            >
              <ContactCard field={field} index={i} />
            </div>
          );
        }

        return (
          <Box position="relative" height={height}>
            {nodes}
          </Box>
        );
      }}
    </MeasureBox>
  );
}

type RowType = UI.DMRContact & { index: number };

const columnHelper = createColumnHelper<RowType>();

function ContactsField_Table(props: { field: UI.Field.Contacts }) {
  const { field } = props;

  const listRef = useRef<HTMLElement | null>(null);

  const [data, setData] = useState<RowType[]>([]);

  const table = useReactTable({
    data,
    columns: useMemo(
      () => [
        columnHelper.accessor("index", {
          header: "#",
          size: 40,
          cell: (info) => info.getValue() + 1,
        }),
        columnHelper.accessor("type", {
          header: "Type",
          size: 150,
          cell: (info) => info.getValue(),
        }),
        columnHelper.accessor("name", {
          header: "Name",
          size: 300,
          cell: (info) => info.getValue(),
        }),
        columnHelper.accessor("id", {
          header: "ID",
          size: 120,
          cell: (info) => info.getValue(),
        }),
      ],
      []
    ),
    getCoreRowModel: getCoreRowModel(),
  });

  const { rows } = table.getRowModel();

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 37,
    overscan: 5,
    scrollMargin: listRef.current?.offsetTop || 0,
  });

  const radio = useStore(Store, (s) => s.radio);

  useEffect(() => {
    const updateData = () => {
      const _data: RowType[] = [];
      for (let i = 0; i < field.size; i += 1) {
        const contact = field.get(i);
        if (!contact) continue;
        _data.push({ ...contact, index: i });
      }
      setData(_data);
    };
    updateData();
    return radio.subscribe_ui(updateData);
  }, [radio, field]);

  return (
    <Box ref={listRef}>
      <Table.Root native size="sm" variant="outline" style={{ display: "grid" }}>
        <thead style={{ position: "sticky", display: "grid", top: 0, zIndex: 1 }}>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} style={{ display: "flex", width: "100%" }}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  style={{
                    display: "flex",
                    width: header.getSize(),
                  }}
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody
          style={{
            position: "relative",
            display: "grid",
            height: `${virtualizer.getTotalSize()}px`,
          }}
        >
          {virtualizer.getVirtualItems().map((_row) => {
            const row = rows[_row.index];
            return (
              <tr
                key={row.id}
                style={{
                  display: "flex",
                  position: "absolute",
                  height: `${_row.size}px`,
                  width: "100%",
                  transform: `translateY(${_row.start}px)`,
                }}
                onClick={() => field.set?.(row.original.index, { id: 111, type: "Individual", name: "TEST" })}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} style={{ display: "flex", width: cell.column.getSize() }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </Table.Root>
    </Box>
  );
}
