import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Generate a PDF report for a completed maintenance audit submission.
 *
 * @param {Object} submission - The maintenance_audit_submissions record (with joined data)
 * @param {string} logoUrl - Company logo URL or base64
 */
export default async function generateAuditPDF(submission, logoUrl) {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = 15

  // ── Company Logo ──────────────────────────────────────────
  if (logoUrl) {
    try {
      const img = await loadImage(logoUrl)
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(margin - 1, y - 1, 42, 20, 2, 2, 'F')
      doc.addImage(img, 'PNG', margin, y, 40, 18)
    } catch {
      // Skip logo if it fails to load
    }
  }

  // ── Title ─────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('MAINTENANCE AUDIT REPORT', pageWidth / 2, y + 8, { align: 'center' })

  y += 24

  // ── Metadata table ────────────────────────────────────────
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')

  const meta = [
    ['Date', new Date(submission.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })],
    ['Time', new Date(submission.submitted_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })],
    ['Asset', `${submission.asset?.asset_code || ''} — ${submission.asset?.asset_name || ''}`],
    ['Site', submission.assignment?.site?.name || submission.asset?.site || ''],
    ['Checklist', submission.checklist?.name || ''],
    ['Frequency', (submission.checklist?.frequency || '').toUpperCase()],
    ['GPS Coordinates', submission.submission_latitude && submission.submission_longitude
      ? `${Number(submission.submission_latitude).toFixed(6)}, ${Number(submission.submission_longitude).toFixed(6)}`
      : 'N/A'],
    ['Status', (submission.approval_status || '').replace(/_/g, ' ').toUpperCase()],
  ]

  autoTable(doc, {
    startY: y,
    body: meta,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 3, font: 'helvetica' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 38, fillColor: [240, 245, 255] },
      1: { cellWidth: pageWidth - margin * 2 - 38 },
    },
    margin: { left: margin, right: margin },
  })

  y = doc.lastAutoTable.finalY + 8

  // ── Checklist Results (grouped by section) ─────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('INSPECTION DETAILS', margin, y)
  y += 4

  const results = submission.results || []

  // Group items by section
  const sections = []
  const sectionSet = new Set()
  for (const item of results) {
    const sec = item.section || 'General'
    if (!sectionSet.has(sec)) {
      sectionSet.add(sec)
      sections.push(sec)
    }
  }

  const tableBody = []
  let itemNum = 0
  for (const sec of sections) {
    // Section header row
    tableBody.push([{ content: sec, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [230, 240, 255], fontSize: 8.5, textColor: [30, 80, 180] } }])
    const sectionItems = results.filter(r => (r.section || 'General') === sec)
    for (const item of sectionItems) {
      itemNum++
      const pass = item.answer === 'pass' ? '✓' : ''
      const fail = item.answer === 'fail' ? '✓' : ''
      const na = item.answer === 'na' ? '✓' : ''
      tableBody.push([
        itemNum,
        item.question || '',
        pass,
        fail,
        na,
        item.remarks || '',
      ])
    }
  }

  autoTable(doc, {
    startY: y,
    head: [['#', 'Inspection Item', 'Pass', 'Fail', 'N/A', 'Remarks / Actions Required']],
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2.5, font: 'helvetica', lineWidth: 0.2 },
    headStyles: { fillColor: [43, 127, 255], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: pageWidth - margin * 2 - 78 },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 12, halign: 'center' },
      5: { cellWidth: 34 },
    },
    margin: { left: margin, right: margin },
    didParseCell: function(data) {
      // Color pass/fail cells
      if (data.section === 'body' && data.column.index === 2 && data.cell.text[0] === '✓') {
        data.cell.styles.textColor = [34, 160, 70]
        data.cell.styles.fontStyle = 'bold'
      }
      if (data.section === 'body' && data.column.index === 3 && data.cell.text[0] === '✓') {
        data.cell.styles.textColor = [220, 50, 50]
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  y = doc.lastAutoTable.finalY + 8

  // ── Notes ─────────────────────────────────────────────────
  if (submission.notes) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Additional Notes:', margin, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const lines = doc.splitTextToSize(submission.notes, pageWidth - margin * 2)
    doc.text(lines, margin, y)
    y += lines.length * 4 + 6
  }

  // ── Check if we need a new page for signatures ────────────
  if (y > 210) {
    doc.addPage()
    y = 20
  }

  // ── Signature Blocks ──────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('VERIFICATION & APPROVAL', margin, y)
  y += 6

  const sigBlockWidth = (pageWidth - margin * 2 - 10) / 3
  const sigBlocks = [
    {
      title: 'PREPARED BY',
      name: submission.prepared_name || submission.preparer?.full_name || '',
      signature: submission.prepared_signature,
      date: submission.prepared_at,
    },
    {
      title: 'CHECKED BY',
      name: submission.checker_name || submission.checker_profile?.full_name || '',
      signature: submission.checker_signature,
      date: submission.checked_at,
    },
    {
      title: 'HOD APPROVAL',
      name: submission.hod_name || submission.hod_profile?.full_name || '',
      signature: submission.hod_signature,
      date: submission.approved_at,
    },
  ]

  sigBlocks.forEach((block, i) => {
    const x = margin + i * (sigBlockWidth + 5)

    // Box
    doc.setDrawColor(200)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(x, y, sigBlockWidth, 50, 2, 2, 'FD')

    // Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(43, 127, 255)
    doc.text(block.title, x + sigBlockWidth / 2, y + 6, { align: 'center' })

    // Signature image
    if (block.signature && block.signature.startsWith('data:')) {
      try {
        doc.addImage(block.signature, 'PNG', x + 5, y + 9, sigBlockWidth - 10, 20)
      } catch {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(7)
        doc.setTextColor(150)
        doc.text('(pending)', x + sigBlockWidth / 2, y + 22, { align: 'center' })
      }
    } else {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(7)
      doc.setTextColor(150)
      doc.text('(pending)', x + sigBlockWidth / 2, y + 22, { align: 'center' })
    }

    // Line
    doc.setDrawColor(180)
    doc.line(x + 5, y + 33, x + sigBlockWidth - 5, y + 33)

    // Name
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(60)
    doc.text(block.name || '—', x + sigBlockWidth / 2, y + 38, { align: 'center' })

    // Date
    doc.setFontSize(6.5)
    doc.setTextColor(130)
    doc.text(
      block.date ? new Date(block.date).toLocaleDateString('en-GB') : '—',
      x + sigBlockWidth / 2, y + 44, { align: 'center' }
    )
  })

  // Reset text color
  doc.setTextColor(0)

  // ── Footer ────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(
      `Generated on ${new Date().toLocaleDateString('en-GB')} | Page ${p} of ${pages}`,
      pageWidth / 2, doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    )
  }

  return doc
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = url
  })
}


