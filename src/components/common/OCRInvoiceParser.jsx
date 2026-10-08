import React, { useState } from 'react'
import { parseInvoiceText } from '../../lib/safeInput'

export default function OCRInvoiceParser({ onParsedData }) {
  const [text, setText] = useState('')
  const [fields, setFields] = useState(null)
  const [error, setError] = useState('')
  const [applied, setApplied] = useState(false)
  function extract() {
    setError(''); setApplied(false)
    try {
      const values = parseInvoiceText(text)
      setFields(values)
      if (!Object.keys(values).length) setError('No labelled fields found. Enter the details manually or paste lines such as Model: ABC and Serial number: 123.')
    } catch (err) { setError(err.message) }
  }
  return (
    <section className="card" style={{ padding: 16, marginBottom: 16 }} aria-label="Invoice text import">
      <h3>Import details from invoice text</h3>
      <p>Paste text copied from your invoice. Review the detected values before applying them. Image and scanned PDF recognition is not configured.</p>
      <label htmlFor="invoice-text">Invoice text</label>
      <textarea id="invoice-text" className="inp" rows={4} maxLength={100000} value={text}
        onChange={e => { setText(e.target.value); setFields(null); setApplied(false); setError('') }} />
      <button type="button" className="btn-ghost" disabled={!text.trim()} onClick={extract}>Find details</button>
      {error && <p role="alert">{error}</p>}
      {fields && Object.keys(fields).length > 0 && <>
        <dl>{Object.entries(fields).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{value}</dd></div>)}</dl>
        <button type="button" className="btn-primary" disabled={applied} onClick={() => { onParsedData?.(fields); setApplied(true) }}>Apply reviewed values</button>
      </>}
      {applied && <p role="status">Values applied. Review the asset form before saving.</p>}
    </section>
  )
}
