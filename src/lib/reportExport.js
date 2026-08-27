import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { formatCurrency } from './depreciation'

// Helper to format values
function formatReportValue(val, format) {
  if (val === null || val === undefined) return '—'
  if (format === 'currency') return formatCurrency(val)
  if (format === 'date') return new Date(val).toLocaleDateString('en-IN')
  return String(val)
}

/**
 * PDF Export Function
 */
export async function exportReportToPDF({ title, summary = {}, columns = [], rows = [], user = null, logoUrl = null }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Colors
  const darkBg = [15, 23, 42]     // #0f172a
  const accentBlue = [14, 165, 233] // #0ea5e9
  const textDark = [30, 41, 59]   // #1e293b

  // Header Banner
  doc.setFillColor(...darkBg)
  doc.rect(0, 0, 297, 24, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('ASSETPRO AUDIT & VERIFICATION PLATFORM', 14, 12)

  doc.setFontSize(9)
  doc.setTextColor(...accentBlue)
  doc.text(`ENTERPRISE REPORT: ${title.toUpperCase()}`, 14, 18)

  doc.setTextColor(148, 163, 184)
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')} | User: ${user?.full_name || 'System Admin'}`, 200, 18)

  // Summary Metrics Bar
  let startY = 32
  const summaryEntries = Object.entries(summary)
  if (summaryEntries.length > 0) {
    doc.setFillColor(241, 245, 249)
    doc.roundedRect(14, startY, 269, 14, 3, 3, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...textDark)

    let posX = 20
    summaryEntries.slice(0, 4).forEach(([key, val]) => {
      const label = key.replace(/([A-Z])/g, ' $1').toUpperCase()
      const displayVal = typeof val === 'number' && key.toLowerCase().includes('val') ? formatCurrency(val) : String(val)
      doc.text(`${label}: ${displayVal}`, posX, startY + 9)
      posX += 65
    })
    startY += 20
  }

  // Data Table
  const tableHeaders = columns.map(c => c.label)
  const tableRows = rows.map(r => columns.map(c => formatReportValue(r[c.key], c.format)))

  autoTable(doc, {
    startY: startY,
    head: [tableHeaders],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: darkBg,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: textDark,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // Footer page numbering
      const totalPages = doc.internal.getNumberOfPages()
      doc.setFontSize(8)
      doc.setTextColor(148, 163, 184)
      doc.text(`Page ${data.pageNumber} of ${totalPages} — Confidential Enterprise Report`, 14, 202)
    },
  })

  doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`)
}

/**
 * Excel Export Function
 */
export function exportReportToExcel({ title, summary = {}, columns = [], rows = [] }) {
  const wb = XLSX.utils.book_new()

  // 1. Summary Sheet
  const summaryData = [
    ['ASSETPRO REPORT SUMMARY'],
    ['Report Title', title],
    ['Generated At', new Date().toLocaleString('en-IN')],
    [''],
    ['METRIC', 'VALUE'],
    ...Object.entries(summary).map(([k, v]) => [k.replace(/([A-Z])/g, ' $1').toUpperCase(), v]),
  ]
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
  summaryWs['!cols'] = [{ wch: 25 }, { wch: 35 }]
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

  // 2. Data Sheet
  const headers = columns.map(c => c.label)
  const dataRows = rows.map(r => columns.map(c => formatReportValue(r[c.key], c.format)))
  const dataWs = XLSX.utils.aoa_to_sheet([headers, ...dataRows])

  // Column width formatting
  dataWs['!cols'] = columns.map(c => ({ wch: Math.max(12, c.label.length + 4) }))
  XLSX.utils.book_append_sheet(wb, dataWs, 'Report Data')

  XLSX.writeFile(wb, `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`)
}

/**
 * CSV Export Function
 */
export function exportReportToCSV({ title, columns = [], rows = [] }) {
  const headers = columns.map(c => `"${c.label}"`).join(',')
  const csvRows = rows.map(r =>
    columns.map(c => {
      let val = formatReportValue(r[c.key], c.format)
      val = val.replace(/"/g, '""')
      return `"${val}"`
    }).join(',')
  )

  const csvString = [headers, ...csvRows].join('\n')
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}


