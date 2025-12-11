import { Store } from "@/store";
import { type UI } from "@/utils/ui";
import { Box, Drawer, Fieldset, IconButton, Table } from "@chakra-ui/react";
import { useRef, useState, useEffect } from "react";
import { useStore } from "zustand";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import { AnyField } from "./AnyField";
import { TbTrash } from "react-icons/tb";

type RowType = { [k in string]?: string };

const columnHelper = createColumnHelper<RowType>();

export function TableField(props: { field: UI.Field.Table }) {
  const { field } = props;

  const { t } = useTranslation();

  const listRef = useRef<HTMLElement | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [data, setData] = useState<RowType[]>([]);

  const table = useReactTable({
    data,
    columns: Object.entries(field.header()).map(([col, meta]) =>
      columnHelper.accessor(col, {
        header: meta.name || col,
        size: 150,
        cell: (info) => info.getValue(),
      })
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
      for (let i = 0; i < field.size(); i += 1) {
        const row = field.get(i);
        _data.push(row);
      }
      setData(_data);
    };
    updateData();
    return radio.subscribe_ui(updateData);
  }, [radio, field]);

  return (
    <Drawer.Root lazyMount unmountOnExit>
      <Drawer.Context>
        {(drawer) => (
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
                      onClick={() => {
                        setActiveIndex(_row.index);
                        drawer.setOpen(true);
                      }}
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
        )}
      </Drawer.Context>
      <Drawer.Positioner>
        <Drawer.Backdrop />
        <Drawer.Content>
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <Drawer.Title flexGrow={1}>{t("editing")}</Drawer.Title>
            {field.delete && (
              <Drawer.Context>
                {(drawer) => (
                  <IconButton
                    variant="ghost"
                    rounded="full"
                    colorPalette="red"
                    onClick={() => {
                      field.delete?.(activeIndex);
                      drawer.setOpen(false);
                    }}
                  >
                    <TbTrash />
                  </IconButton>
                )}
              </Drawer.Context>
            )}
          </Drawer.Header>
          <Drawer.Body>
            <Fieldset.Root>
              <Fieldset.Content>
                {field.set_ui?.(activeIndex).map((_field) => (
                  <AnyField key={_field.id} field={_field} />
                ))}
              </Fieldset.Content>
            </Fieldset.Root>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
