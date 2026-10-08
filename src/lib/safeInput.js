export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char])
}

export function safeDocumentUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined
  } catch { return undefined }
}

export function parseAssetScan(value) {
  const text = String(value).trim()
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuid.test(text)) return text
  try {
    const url = new URL(text, 'https://asset.invalid')
    if (!['https:', 'http:'].includes(url.protocol)) return null
    const route = url.hash.startsWith('#/') ? url.hash.slice(1) : url.pathname
    const id = route.match(/^\/(?:scan|assets)\/([^/?#]+)(?:[/?#]|$)/)?.[1] || url.searchParams.get('id')
    return id && uuid.test(id) ? id : null
  } catch { return null }
}

export function validateDocument(file) {
  if (!file || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a PDF, JPEG, PNG, or WebP document.')
  }
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('Choose a nonempty document smaller than 10 MB.')
}

// Extract only explicitly labelled text; never manufacture invoice values.
export function parseInvoiceText(text) {
  if (typeof text !== 'string' || text.length > 100000) throw new Error('Invoice text must be under 100,000 characters.')
  const fields = {}
  const patterns = {
    model: /^(?:model(?:\s*(?:no\.?|number))?)\s*[:=]\s*(.+)$/im,
    serial_no: /^(?:serial(?:\s*(?:no\.?|number))?|s\/n)\s*[:=]\s*(.+)$/im,
    asset_code: /^asset\s*code\s*[:=]\s*(.+)$/im,
  }
  for (const [key, pattern] of Object.entries(patterns)) {
    const value = text.match(pattern)?.[1]?.trim()
    if (value) fields[key] = value.slice(0, 200)
  }
  const amount = text.match(/^(?:grand total|invoice total|purchase cost)\s*[:=]\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)\s*$/im)?.[1]
  if (amount && /^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d{1,2})?$/.test(amount)) {
    const cost = Number(amount.replaceAll(',', ''))
    if (Number.isFinite(cost)) fields.purchase_cost = cost
  }
  return fields
}
