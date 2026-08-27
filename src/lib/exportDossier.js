import jsPDF from 'jspdf'
import { formatCurrency } from './depreciation'

export function generateAssetDossierPDF(asset, intel) {
  const doc = new jsPDF('p', 'mm', 'a4')
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const m = 15

  const BK = [20, 20, 20]
  const GY = [100, 100, 100]
  const ACC = [37, 99, 235] // blue
  const RED = [220, 38, 38]
  const GRN = [16, 185, 129]

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...BK)
  doc.text('ASSET 360° DOSSIER', m, 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GY)
  doc.text(`Generated: ${today}`, W - m, 20, { align: 'right' })

  doc.setDrawColor(...BK)
  doc.setLineWidth(0.5)
  doc.line(m, 24, W - m, 24)

  let y = 32

  const addSection = (title, items, isFullWidth = false) => {
    if (y > H - 40) { doc.addPage(); y = 20 }
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...ACC)
    doc.text(title.toUpperCase(), m, y)
    y += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...BK)

    const colW = (W - m * 2) / 2
    let isLeft = true
    let itemY = y

    items.forEach(item => {
      if (item.full) {
        if (!isLeft) itemY += 6
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...GY)
        doc.text(item.label + ':', m, itemY)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...(item.color || BK))
        const split = doc.splitTextToSize(item.val || '—', W - m * 2 - 30)
        doc.text(split, m + 30, itemY)
        itemY += split.length * 4 + 2
        isLeft = true
      } else {
        const cx = isLeft ? m : m + colW
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...GY)
        doc.text(item.label + ':', cx, itemY)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...(item.color || BK))
        doc.text(String(item.val || '—'), cx + 30, itemY)
        
        if (!isLeft) itemY += 6
        isLeft = !isLeft
      }
    })
    
    y = isLeft ? itemY : itemY + 6
    y += 4
  }

  // 1. Asset Identity
  addSection('1. Asset Identity', [
    { label: 'Name', val: intel.identity.data.name },
    { label: 'Code', val: intel.identity.data.code },
    { label: 'Category', val: intel.identity.data.category },
    { label: 'Status', val: intel.identity.data.status, color: intel.identity.data.status === 'Active' ? GRN : RED },
    { label: 'Make / Model', val: `${asset.make || '—'} / ${asset.model_no || '—'}` },
    { label: 'Serial No', val: asset.serial_no },
  ])

  // 2. Location
  addSection('2. Location', [
    { label: 'Site', val: intel.location.data.siteName },
    { label: 'Geospatial', val: intel.location.data.precision },
    { label: 'Coordinates', val: intel.location.data.latitude ? `${intel.location.data.latitude}, ${intel.location.data.longitude}` : 'Unavailable' },
    { label: 'Address', val: asset.address || '—', full: true },
  ])

  // 3. Health & Risk
  addSection('3. Health & Risk Assessment', [
    { label: 'Health Score', val: `${intel.health.data.score}% (${intel.health.data.grade})`, color: intel.health.data.score > 70 ? GRN : RED },
    { label: 'Risk Score', val: `${intel.risk.data.score}% (${intel.risk.data.grade})`, color: intel.risk.data.score > 70 ? RED : GRN },
    { label: 'Methodology', val: intel.health.methodology, full: true },
  ])

  // 4. Age & Lifecycle
  addSection('4. Age & Lifecycle', [
    { label: 'Age', val: `${intel.age.data.ageYears} years` },
    { label: 'Lifecycle State', val: intel.age.data.lifecycleState },
    { label: 'Consumed Life', val: `${intel.age.data.consumedLifePercent}%` },
    { label: 'Expected EOL', val: intel.age.data.expectedEndOfLife || '—' },
  ])

  // 5. Maintenance & Warranty
  addSection('5. Maintenance & Reliability', [
    { label: 'Open Tickets', val: intel.maintenance.data.openTickets },
    { label: 'Overdue PMs', val: intel.maintenance.data.overduePMs },
    { label: 'Warranty', val: intel.warranty.data.status },
    { label: 'Warranty Exp.', val: intel.warranty.data.expiryDate || '—' },
  ])

  // 6. Finance (If authorized)
  if (intel.financial.status !== 'INSUFFICIENT_DATA' && intel.financial.data) {
    addSection('6. Financial Intelligence', [
      { label: 'Purchase Value', val: formatCurrency(intel.financial.data.purchaseValue) },
      { label: 'Book Value (NBV)', val: formatCurrency(intel.financial.data.currentBookValue) },
      { label: 'Depreciation', val: `${formatCurrency(intel.financial.data.accumulatedDepreciation)} (${intel.financial.data.depreciationPercent}%)` },
      { label: 'Capital Exposure', val: intel.financial.data.isIdleCapital ? 'IDLE CAPITAL' : (intel.financial.data.isAtRiskCapital ? 'AT-RISK CAPITAL' : 'ACTIVE'), color: intel.financial.data.isIdleCapital ? [245, 158, 11] : (intel.financial.data.isAtRiskCapital ? RED : GRN) },
    ])
  } else {
    addSection('6. Financial Intelligence', [
      { label: 'Notice', val: 'Financial information restricted by RBAC or insufficient data.', full: true }
    ])
  }

  // 7. Today's Attention
  if (intel.attention.length > 0) {
    if (y > H - 50) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...RED)
    doc.text("7. TODAY'S ATTENTION REQUIRED", m, y)
    y += 8

    intel.attention.forEach((att, i) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...BK)
      doc.text(`• ${att.title} (${att.severity})`, m + 2, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...GY)
      const split = doc.splitTextToSize(att.explanation, W - m * 2 - 10)
      doc.text(split, m + 6, y)
      y += split.length * 4 + 2
    })
    y += 4
  }

  // 8. Recommendations
  if (intel.recommendations.length > 0) {
    if (y > H - 50) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...ACC)
    doc.text("8. STRATEGIC RECOMMENDATIONS", m, y)
    y += 8

    intel.recommendations.forEach((rec, i) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...BK)
      const split = doc.splitTextToSize(`• ${rec}`, W - m * 2 - 6)
      doc.text(split, m + 2, y)
      y += split.length * 4 + 2
    })
  }

  // Footer
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...GY)
    doc.text(`AssetPro Intelligence | Page ${i} of ${totalPages}`, W / 2, H - 8, { align: 'center' })
  }

  doc.save(`Asset_Dossier_${asset.asset_code || asset.id}.pdf`)
}


