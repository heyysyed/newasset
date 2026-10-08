import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAssetScan, safeDocumentUrl, escapeHtml, parseInvoiceText, validateDocument } from '../../src/lib/safeInput.js'
test('QR accepts asset identifiers but never arbitrary navigation targets', () => {
  const id='10000000-0000-0000-0000-000000000001'
  for(const input of [id,`https://example.test/#/scan/${id}`,`https://example.test/assets/${id}?a=1`]) assert.equal(parseAssetScan(input),id)
  for(const input of ['javascript:alert(1)','https://evil.test','../../admin','//evil.test/','<script>']) assert.equal(parseAssetScan(input),null)
})
test('document links reject executable and credential-bearing URLs', () => {
  assert.equal(safeDocumentUrl('https://files.test/doc.pdf'),'https://files.test/doc.pdf')
  for(const input of ['javascript:alert(1)','data:text/html,a','https://user:password@files.test/a','/somewhere']) assert.equal(safeDocumentUrl(input),undefined)
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
})
test('invoice extraction only returns observed, explicitly labelled values', () => {
  assert.deepEqual(parseInvoiceText('CRANE INVOICE.pdf'),{})
  assert.deepEqual(parseInvoiceText('Model: Crane 50T\nSerial number: ABC123\nGrand Total: INR 4,50,000.00'),{model:'Crane 50T',serial_no:'ABC123',purchase_cost:450000})
  assert.equal(parseInvoiceText('Grand Total: ₹ 0').purchase_cost,0)
  assert.equal(parseInvoiceText('Grand Total: -100').purchase_cost,undefined)
  assert.equal(parseInvoiceText('Grand Total: 1,2,3').purchase_cost,undefined)
  assert.throws(()=>parseInvoiceText('x'.repeat(100001)))
})
test('file validation rejects empty, oversized, and executable uploads', () => {
  validateDocument({type:'application/pdf',size:100})
  for(const file of [{type:'image/svg+xml',size:100},{type:'image/png',size:0},{type:'application/pdf',size:11*1024*1024}]) assert.throws(()=>validateDocument(file))
})
