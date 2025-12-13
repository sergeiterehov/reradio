import { Store } from "@/store";
import { type UI } from "@/utils/ui";
import { Drawer, Fieldset, IconButton, Table } from "@chakra-ui/react";
import { useRef, useState, useEffect, createContext, useContext } from "react";
import { useStore } from "zustand";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { observeWindowOffset, observeWindowRect, useVirtualizer, windowScroll } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import { AnyField } from "./AnyField";
import { TbTrash } from "react-icons/tb";

const row_height = 37;

type RowType = { [k in string]?: string };

const columnHelper = createColumnHelper<RowType>();

const NestedContext = createContext(false);

export function TableField(props: { field: UI.Field.Table }) {
  const { field } = props;

  const { t } = useTranslation();

  const listRef = useRef<HTMLTableSectionElement | null>(null);

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

  const nested = useContext(NestedContext);

  const virtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => row_height,
    scrollMargin: listRef.current?.offsetTop,
    // TODO: Прокидывать реф через контекст. Пока можем отображаться в window или drawer.
    getScrollElement: () => document.querySelector(".chakra-drawer__body"),

    ...(!nested &&
      ({
        getScrollElement: () => (typeof document !== "undefined" ? window : null),
        initialOffset: () => (typeof document !== "undefined" ? window.scrollY : 0),
        observeElementRect: observeWindowRect,
        observeElementOffset: observeWindowOffset,
        scrollToFn: windowScroll,
      } as object)),
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
    <Drawer.Root lazyMount unmountOnExit size={nested ? "sm" : "md"}>
      <Drawer.Context>
        {(drawer) => (
          <Table.Root native size="sm" variant="outline" style={{ display: "grid" }}>
            <thead
              style={{
                position: "sticky",
                display: "grid",
                top: nested ? "calc(0px - var(--chakra-spacing-2))" : 0,
                zIndex: 1,
              }}
            >
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} style={{ display: "flex", width: "100%" }}>
                  {headerGroup.headers.map((header, _, headers) => (
                    <th
                      key={header.id}
                      style={{
                        display: "flex",
                        width: header.getSize(),
                        flexGrow: header === headers.at(-1) ? 1 : undefined,
                      }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody
              ref={listRef}
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
                    aria-selected={drawer.open && activeIndex === _row.index}
                    style={{
                      display: "flex",
                      position: "absolute",
                      height: `${_row.size}px`,
                      width: "100%",
                      transform: `translateY(${_row.start - listRef.current!.offsetTop}px)`,
                    }}
                    onClick={() => {
                      if (!field.set_ui) return;

                      setActiveIndex(_row.index);
                      drawer.setOpen(true);
                    }}
                  >
                    {row.getVisibleCells().map((cell, _, cells) => (
                      <td
                        key={cell.id}
                        style={{
                          display: "flex",
                          width: cell.column.getSize(),
                          flexGrow: cell === cells.at(-1) ? 1 : undefined,
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </Table.Root>
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
          <Drawer.Body position="relative">
            <Fieldset.Root>
              <Fieldset.Content>
                <NestedContext.Provider value={true}>
                  {field.set_ui?.(activeIndex).map((_field) => (
                    <AnyField key={_field.id} field={_field} />
                  ))}
                </NestedContext.Provider>
              </Fieldset.Content>
            </Fieldset.Root>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
