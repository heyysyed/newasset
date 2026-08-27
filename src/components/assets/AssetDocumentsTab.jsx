import React, { useState } from 'react'
import { FileText, Eye, Trash2 } from 'lucide-react'
import { SectionCard, EmptyState } from '../../pages/AssetDetail'

// Minimal stub for auth/api needs, would normally be passed as props.
// Here we'll expect them as props for the extraction.
export default function AssetDocumentsTab({ documents, can, uploadAssetDocument, deleteAssetDocument, setDocuments, setDocUploading, docUploading, user, id }) {
  if (!documents) return null

  const expiringCount = documents.filter(d => d.expiry_date && new Date(d.expiry_date) < new Date(Date.now() + 30 * 86400000)).length
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {documents.length > 0 && (
        <div style={{ padding: 14, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', gap: 20 }}>
          <div>
            <span style={{ color: 'var(--text-3)', textTransform: 'uppercase', }}>Total Documents</span>
            <div style={{ color: 'var(--text-1)' }}>{documents.length}</div>
          </div>
          {expiringCount > 0 && (
            <div>
              <span style={{ color: 'var(--text-3)', textTransform: 'uppercase', }}>Expiring Soon</span>
              <div style={{ color: 'var(--red)' }}>{expiringCount}</div>
            </div>
          )}
        </div>
      )}

      <SectionCard title="Compliance & Documents" icon={FileText} accentColor="var(--purple)">
        {/* Upload Form */}
        {can('edit') && (
          <div style={{ marginBottom: 20, padding: 16, background: 'var(--bg-1)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 12px 0', }}>Upload Document</h4>
            <form onSubmit={async (e) => {
              e.preventDefault()
              const form = e.target
              const file = form.file.files[0]
              if (!file) return alert('Please select a file')
              const meta = {
                document_type: form.doc_type.value,
                document_number: form.doc_number.value,
                issue_date: form.issue_date.value || null,
                expiry_date: form.expiry_date.value || null
              }
              setDocUploading(true)
              try {
                const doc = await uploadAssetDocument(id, file, meta, user.id)
                setDocuments(prev => [...prev, doc].sort((a,b) => new Date(a.expiry_date||'9999-01-01') - new Date(b.expiry_date||'9999-01-01')))
                form.reset()
              } catch(err) { alert('Upload failed: ' + err.message) }
              finally { setDocUploading(false) }
            }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 150 }}>
                <label className="lbl">Document Type</label>
                <select name="doc_type" className="sel" required style={{ width: '100%', height: 38 }}>
                  <option value="Insurance">Insurance</option>
                  <option value="Registration">Registration</option>
                  <option value="Warranty">Warranty</option>
                  <option value="Manual">Manual</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <label className="lbl">Doc Number (Opt)</label>
                <input type="text" name="doc_number" className="inp" placeholder="Policy #, etc" style={{ height: 38 }} />
              </div>
              <div style={{ flex: 1, minWidth: 130 }}>
                <label className="lbl">Issue Date (Opt)</label>
                <input type="date" name="issue_date" className="inp" style={{ height: 38 }} />
              </div>
              <div style={{ flex: 1, minWidth: 130 }}>
                <label className="lbl">Expiry Date (Opt)</label>
                <input type="date" name="expiry_date" className="inp" style={{ height: 38 }} />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label className="lbl">File (PDF/Image)</label>
                <input type="file" name="file" className="inp" accept=".pdf,image/*" required style={{ height: 38 }} />
              </div>
              <button type="submit" className="btn-primary" disabled={docUploading} style={{ height: 38, padding: '0 24px' }}>
                {docUploading ? 'Uploading...' : 'Upload'}
              </button>
            </form>
          </div>
        )}

        {/* List */}
        {documents.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {documents.map(doc => {
              const isExpiring = doc.expiry_date && new Date(doc.expiry_date) < new Date(Date.now() + 30 * 86400000)
              const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date()
              const badgeColor = isExpired ? 'var(--red)' : isExpiring ? 'var(--amber)' : 'var(--green)'
              const badgeText = isExpired ? 'Expired' : isExpiring ? 'Expiring Soon' : 'Active'
              
              return (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--bg-1)', borderRadius: 12, border: `1px solid ${isExpiring || isExpired ? badgeColor+'40' : 'var(--border)'}` }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
                    <FileText size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-0)', textDecoration: 'none' }}>{doc.document_type}</a>
                      {doc.expiry_date && <span style={{ padding: '2px 8px', borderRadius: 8, background: `${badgeColor}15`, color: badgeColor, }}>{badgeText}</span>}
                    </div>
                    <div style={{ color: 'var(--text-3)', display: 'flex', gap: 12 }}>
                      {doc.document_number && <span>#{doc.document_number}</span>}
                      {doc.expiry_date && <span>Expires: {new Date(doc.expiry_date).toLocaleDateString()}</span>}
                      <span>By: {doc.profiles?.full_name}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href={doc.file_url} target="_blank" rel="noreferrer" className="btn-ghost" style={{ padding: '6px 10px' }}><Eye size={14} /></a>
                    {can('delete') && <button onClick={() => deleteAssetDocument(doc.id).then(() => setDocuments(docs => docs.filter(d => d.id !== doc.id)))} className="btn-danger" style={{ padding: '6px 10px' }}><Trash2 size={14} /></button>}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
           <EmptyState icon={FileText} title="No documents" description="Upload insurance, registration, manuals, or warranty certificates." />
        )}
      </SectionCard>
    </div>
  )
}


