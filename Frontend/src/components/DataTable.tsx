import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table'
import { Table } from 'react-bootstrap'

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    onAction?: (row: TData, action: string) => void
  }
}

interface DataTableProps<T> {
  columns: ColumnDef<T, any>[]
  data: T[]
  getRowId?: (row: T) => string
}

export function DataTable<T>({ columns, data, getRowId }: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: getRowId ?? undefined,
  })

  return (
    <Table responsive hover className="align-middle">
      <thead className="table-dark">
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id} style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
