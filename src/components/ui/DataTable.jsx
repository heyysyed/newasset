import React, { useState } from 'react'
import { ChevronUp, ChevronDown, MoreHorizontal, Settings2 } from 'lucide-react'

export default function DataTable({ 
  columns = [], 
  data = [], 
  keyField = 'id',
  loading = false,
  emptyState = null,
  mobileRenderer = null,
  onRowClick = null,
  rowClassName = () => '',
}) {
  const [sortConfig, setSortConfig] = useState(null)

  // Quick client-side sort if data is small (otherwise server-side should pass sorted data)
  const sortedData = React.useMemo(() => {
    if (!sortConfig) return data
    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortConfig])

  const requestSort = (key, sortable) => {
    if (!sortable) return
    let direction = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  // Loading State
  if (loading) {
    return (
      <div className="bg-bg-0 border border-border rounded-xl shadow-sm overflow-hidden animate-pulse">
        <div className="h-11 bg-bg-1 border-b border-border" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex p-4 border-b border-border/50 gap-4">
            <div className="h-4 bg-bg-2 rounded w-1/4" />
            <div className="h-4 bg-bg-2 rounded w-1/4" />
            <div className="h-4 bg-bg-2 rounded w-1/4" />
          </div>
        ))}
      </div>
    )
  }

  // Empty State
  if (!data || data.length === 0) {
    return (
      <div className="bg-bg-0 border border-border rounded-xl shadow-sm">
        {emptyState || (
          <div className="p-8 text-center text-text-3 text-body-medium text-small">
            No records found
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-bg-0 border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto custom-scrollbar relative">
        <table className="w-full text-left text-small whitespace-nowrap">
          <thead className="bg-bg-1 text-text-2 sticky top-0 z-10 border-b border-border shadow-[0_1px_0_var(--border)]">
            <tr>
              {columns.map((col, idx) => (
                <th 
                  key={idx} 
                  className={\px-4 py-3  text-[0.8rem] uppercase tracking-wider \ \\}
                  onClick={() => requestSort(col.accessor, col.sortable)}
                  style={{ width: col.width }}
                >
                  <div className="flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && sortConfig?.key === col.accessor && (
                      sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-accent" /> : <ChevronDown size={12} className="text-accent" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedData.map((row, idx) => (
              <tr 
                key={row[keyField] || idx}
                onClick={() => onRowClick && onRowClick(row)}
                className={\group transition-colors hover:bg-bg-1/50 \ \\}
              >
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className={\px-4 py-3 \\}>
                    {col.render ? col.render(row) : row[col.accessor]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Renderer */}
      <div className="md:hidden divide-y divide-border/60">
        {sortedData.map((row, idx) => (
          <div 
            key={row[keyField] || idx} 
            className={\p-4 \ \\}
            onClick={() => onRowClick && onRowClick(row)}
          >
            {mobileRenderer ? mobileRenderer(row) : (
              // Fallback mobile renderer
              <div className="flex flex-col gap-1">
                <div className="text-text-0 text-small">{row[columns[0]?.accessor]}</div>
                <div className="text-caption text-text-3">{row[columns[1]?.accessor]}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}


