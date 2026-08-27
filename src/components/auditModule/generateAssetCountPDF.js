import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const BLACK = [0, 0, 0]
const DARK_GRAY = [50, 50, 50]
const LIGHT_GRAY = [240, 240, 240]
const BORDER_GRAY = [200, 200, 200]
const WHITE = [255, 255, 255]

export default async function generateAssetCountPDF(assignment, items, logoUrl) {
  const doc = new jsPDF('p', 'mm', 'a4')
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const m = 12
  const cw = W - m * 2 // content width
  let y = 0

  const site = assignment.site || {}
  const verified = items.filter(i => i.status === 'verified').length
  const unverified = items.filter(i => i.status === 'unverified').length
  const pendingCount = items.filter(i => i.status === 'pending').length
  const operational = items.filter(i => i.condition === 'operational').length
  const damaged = items.filter(i => ['damaged', 'needs_repair', 'non_functional'].includes(i.condition)).length
  const missing = items.filter(i => i.condition === 'missing').length
  const pct = items.length > 0 ? Math.round((verified / items.length) * 100) : 0

  // ════════════════════════════════════════════════════════
  // HEADER (LOGO ONLY ON LEFT)
  // ════════════════════════════════════════════════════════
  // Logo (left)
  if (logoUrl) {
    try {
      const img = await loadImage(logoUrl)
      doc.addImage(img, 'PNG', m, 4, 34, 22)
    } catch {}
  }

  // Report title (right-aligned)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...BLACK)
  doc.text('ASSET COUNT AUDIT REPORT', W - m, 12, { align: 'right' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...DARK_GRAY)
  doc.text(`Report Ref: ACA-${(assignment.id || '').slice(0, 8).toUpperCase()}`, W - m, 17, { align: 'right' })

  // Top header dividing double lines
  doc.setDrawColor(...BLACK)
  doc.setLineWidth(0.8)
  doc.line(m, 29, W - m, 29)
  doc.setLineWidth(0.2)
  doc.line(m, 30.5, W - m, 30.5)

  y = 35

  // ════════════════════════════════════════════════════════
  // AUDIT DETAILS — Clean B&W Grid
  // ════════════════════════════════════════════════════════
  const detailRows = [
    ['Audit Title:', assignment.title || '—', 'Report Date:', new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })],
    ['Site / Location:', site.name || '—', 'Due Date:', assignment.due_date ? new Date(assignment.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'],
    ['Auditor Name:', assignment.auditor?.full_name || '—', 'Completion Status:', (assignment.status || '').replace('_', ' ').toUpperCase()],
    ['Audit Type:', 'Physical Asset Count Verification', 'Assigned By:', assignment.assigner?.full_name || '—'],
    ['Site GPS:', site.latitude && site.longitude ? `${Number(site.latitude).toFixed(6)}, ${Number(site.longitude).toFixed(6)}` : 'Not configured', 'Geo-Fence:', site.radius_meters ? `${site.radius_meters} meters` : '—'],
    ['Completed On:', assignment.completed_at ? new Date(assignment.completed_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'In Progress', 'Total Assets Audited:', String(items.length)],
  ]

  autoTable(doc, {
    startY: y,
    body: detailRows,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: { top: 2, bottom: 2, left: 2, right: 2 }, font: 'helvetica', lineWidth: 0 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 32, textColor: BLACK, fontSize: 8 },
      1: { cellWidth: cw / 2 - 32, textColor: DARK_GRAY },
      2: { fontStyle: 'bold', cellWidth: 32, textColor: BLACK, fontSize: 8 },
      3: { cellWidth: cw / 2 - 32, textColor: DARK_GRAY },
    },
    margin: { left: m, right: m },
    didDrawCell: function(data) {
      if (data.section === 'body') {
        doc.setDrawColor(...BORDER_GRAY)
        doc.setLineWidth(0.15)
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height)
      }
    },
  })
  y = doc.lastAutoTable.finalY + 6

  // ════════════════════════════════════════════════════════
  // SUMMARY BOXES (CLEAN BLACK & WHITE OUTLINED CARDS)
  // ════════════════════════════════════════════════════════
  const boxW = (cw - 5 * 4) / 5
  const boxH = 18
  const boxes = [
    { label: 'TOTAL', value: items.length },
    { label: 'VERIFIED', value: verified },
    { label: 'OPERATIONAL', value: operational },
    { label: 'DAMAGED', value: damaged },
    { label: 'MISSING', value: missing },
  ]

  boxes.forEach((b, i) => {
    const bx = m + i * (boxW + 4)
    // Box border
    doc.setDrawColor(...BLACK)
    doc.setLineWidth(0.4)
    doc.setFillColor(...WHITE)
    doc.roundedRect(bx, y, boxW, boxH, 1, 1, 'FD')

    // Value
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...BLACK)
    doc.text(String(b.value), bx + boxW / 2, y + 9, { align: 'center' })

    // Label
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK_GRAY)
    doc.text(b.label, bx + boxW / 2, y + 15, { align: 'center' })
  })

  y += boxH + 6

  // ════════════════════════════════════════════════════════
  // ASSET TABLE (HIGH CONTRAST B&W PRINT)
  // ════════════════════════════════════════════════════════
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...BLACK)
  doc.text('ASSET VERIFICATION DETAILS', m, y)
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`Completion Audit Rate: ${pct}% (${verified} of ${items.length} items verified)`, W - m, y, { align: 'right' })
  y += 3

  const COND = { operational: 'OK', damaged: 'DMG', needs_repair: 'REPAIR', non_functional: 'N/F', missing: 'MISSING' }
  const tableRows = items.map((item, idx) => [
    idx + 1,
    item.asset?.asset_code || '—',
    item.asset?.asset_name || '—',
    item.asset?.make || '—',
    COND[item.condition] || '—',
    item.geo_verified ? 'YES' : (item.scan_latitude ? 'NO' : '—'),
    item.status === 'verified' ? 'PASS' : item.status === 'unverified' ? 'UNVF' : 'PEND',
    item.scanned_at ? new Date(item.scanned_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—',
  ])

  autoTable(doc, {
    startY: y,
    head: [['#', 'ASSET CODE', 'ASSET NAME', 'MAKE', 'COND.', 'ON-SITE', 'RESULT', 'SCANNED AT']],
    body: tableRows,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, font: 'helvetica', overflow: 'linebreak', textColor: BLACK, lineWidth: 0.15, strokeColor: BLACK },
    headStyles: { fillColor: LIGHT_GRAY, textColor: BLACK, fontStyle: 'bold', fontSize: 7, halign: 'center', lineWidth: 0.3, strokeColor: BLACK },
    alternateRowStyles: { fillColor: WHITE },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 28, fontStyle: 'bold', fontSize: 7 },
      2: { cellWidth: 42 },
      3: { cellWidth: 24 },
      4: { cellWidth: 16, halign: 'center', fontSize: 7 },
      5: { cellWidth: 14, halign: 'center', fontSize: 7 },
      6: { cellWidth: 14, halign: 'center', fontSize: 7, fontStyle: 'bold' },
      7: { cellWidth: cw - 145, halign: 'center', fontSize: 6.5 },
    },
    margin: { left: m, right: m },
  })
  y = doc.lastAutoTable.finalY + 8

  // ════════════════════════════════════════════════════════
  // SELFIE VERIFICATION
  // ════════════════════════════════════════════════════════
  if (assignment.selfie_url) {
    if (y > H - 55) { doc.addPage(); y = 16 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...BLACK)
    doc.text('AUDITOR VERIFICATION', m, y)
    y += 4
    try {
      const selfie = await loadImage(assignment.selfie_url)
      doc.setDrawColor(...BLACK)
      doc.setLineWidth(0.4)
      doc.roundedRect(m, y, 22, 22, 1, 1)
      doc.addImage(selfie, 'JPEG', m + 1, y + 1, 20, 20)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...BLACK)
      doc.text(`Auditor: ${assignment.auditor?.full_name || '—'}`, m + 28, y + 7)
      doc.setFont('helvetica', 'normal')
      doc.text(`Completed: ${assignment.completed_at ? new Date(assignment.completed_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}`, m + 28, y + 13)
      doc.setFontSize(7.5)
      doc.text('✓ Identity verified via live photo capture', m + 28, y + 19)
      y += 28
    } catch { y += 2 }
  }

  // ════════════════════════════════════════════════════════
  // SIGN-OFF & APPROVAL (BLACK & WHITE PRINT READY)
  // ════════════════════════════════════════════════════════
  if (y > H - 48) { doc.addPage(); y = 16 }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BLACK)
  doc.text('SIGN-OFF & APPROVAL', m, y)
  y += 5

  const sw = (cw - 8) / 3
  const sigs = [
    { title: 'PREPARED BY', sub: 'Auditor' },
    { title: 'REVIEWED BY', sub: 'Site Supervisor' },
    { title: 'APPROVED BY', sub: 'Head of Department' },
  ]

  sigs.forEach((s, i) => {
    const sx = m + i * (sw + 4)

    // Box outline
    doc.setDrawColor(...BLACK)
    doc.setLineWidth(0.4)
    doc.rect(sx, y, sw, 38)

    // Title bar
    doc.setFillColor(...LIGHT_GRAY)
    doc.rect(sx, y, sw, 7, 'F')
    doc.setDrawColor(...BLACK)
    doc.line(sx, y + 7, sx + sw, y + 7)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...BLACK)
    doc.text(s.title, sx + sw / 2, y + 4.8, { align: 'center' })

    // Sub label
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...DARK_GRAY)
    doc.text(`(${s.sub})`, sx + sw / 2, y + 11.5, { align: 'center' })

    // Sig line
    doc.setDrawColor(...BLACK)
    doc.setLineWidth(0.3)
    doc.line(sx + 6, y + 25, sx + sw - 6, y + 25)

    // Labels
    doc.setFontSize(6)
    doc.setTextColor(...DARK_GRAY)
    doc.text('Signature', sx + sw / 2, y + 23, { align: 'center' })
    doc.text('Name: ___________________', sx + 4, y + 30)
    doc.text('Date: ___________________', sx + 4, y + 35)
  })

  // ════════════════════════════════════════════════════════
  // FOOTER ON ALL PAGES
  // ════════════════════════════════════════════════════════
  const totalPages = doc.internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    // Solid line
    doc.setDrawColor(...BLACK)
    doc.setLineWidth(0.4)
    doc.line(m, H - 12, W - m, H - 12)

    // Left: System title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...BLACK)
    doc.text('ASSETPRO — AUDIT COMMAND CENTER', m, H - 7)

    // Center: generated date
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...DARK_GRAY)
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, W / 2, H - 7, { align: 'center' })

    // Right: page numbers
    doc.setFont('helvetica', 'bold')
    doc.text(`Page ${p} of ${totalPages}`, W - m, H - 7, { align: 'right' })
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


