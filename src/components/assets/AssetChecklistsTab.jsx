import React from 'react'
import { ClipboardList, CheckCircle2, Download } from 'lucide-react'
import { SectionCard, EmptyState } from '../../pages/AssetDetail'

const FREQ = [
  { key: 'daily', label: 'Daily', color: 'var(--status-danger)', bg: 'var(--status-danger-soft)', gradient: 'linear-gradient(135deg, var(--status-danger-soft), var(--status-danger-soft))' },
  { key: 'weekly', label: 'Weekly', color: 'var(--status-warning)', bg: 'var(--status-warning-soft)', gradient: 'linear-gradient(135deg, var(--status-warning-soft), var(--status-warning-soft))' },
  { key: 'monthly', label: 'Monthly', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(59,130,246,0.03))' },
]
const APPROVAL = {
  pending_checker: { label: 'Pending Checker', color: 'var(--status-warning)', bg: 'var(--status-warning-soft)' },
  pending_hod: { label: 'Pending HOD', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  approved: { label: 'Approved', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  rejected: { label: 'Rejected', color: 'var(--status-danger)', bg: 'var(--status-danger-soft)' },
}

export default function AssetChecklistsTab({ asset, linkedChecklists, checklistHistory }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Linked checklists by frequency */}
      <SectionCard title="Linked Checklists" icon={ClipboardList} accentColor="var(--accent)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {FREQ.map(f => {
            const cl = linkedChecklists[f.key]
            return (
              <div key={f.key} style={{
                padding: '18px 16px', borderRadius: 14, border: `1.5px solid ${cl ? f.color + '30' : 'var(--border)'}`,
                background: cl ? f.gradient : 'var(--bg-1)', textAlign: 'center',
                position: 'relative', overflow: 'hidden',
              }}>
                {cl && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: f.color }} />}
                <div style={{
                  width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${f.color}15`, margin: '0 auto 10px',
                }}>
                  <ClipboardList size={16} style={{ color: f.color }} />
                </div>
                <div style={{ color: f.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  {f.label}
                </div>
                {cl ? (
                  <>
                    <p style={{ color: 'var(--text-0)', margin: '0 0 4px' }}>{cl.name}</p>
                    <p style={{ color: 'var(--text-3)', margin: 0 }}>{(cl.items || []).length} items</p>
                  </>
                ) : (
                  <p style={{ color: 'var(--text-3)', fontStyle: 'italic', margin: 0 }}>Not linked</p>
                )}
              </div>
            )
          })}
        </div>
      </SectionCard>

      {/* Performed checklist history */}
      <SectionCard
        title={`Performed Checklists`}
        icon={CheckCircle2}
        accentColor="var(--green)"
        actions={<span style={{ color: 'var(--text-3)', }}>{checklistHistory.length} records</span>}
      >
        {checklistHistory.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No checklists performed yet" description="Completed inspection checklists for this asset will appear here." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {checklistHistory.map(sub => {
              const ap = APPROVAL[sub.approval_status] || APPROVAL.pending_checker
              const freq = sub.checklist?.frequency || 'monthly'
              const fc = FREQ.find(f => f.key === freq) || FREQ[2]
              const passCount = (sub.results || []).filter(r => r.answer === 'pass').length
              const failCount = (sub.results || []).filter(r => r.answer === 'fail').length
              const totalItems = (sub.results || []).length
              const passPct = totalItems > 0 ? Math.round((passCount / totalItems) * 100) : 0
              return (
                <div key={sub.id} style={{
                  padding: '14px 16px', borderRadius: 12,
                  display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
                  background: 'var(--bg-1)', border: '1px solid var(--border)',
                }} onClick={async () => {
                  try {
                    const { default: generateAuditPDF } = await import('../auditModule/generateAuditPDF.js')
                    const { default: logo } = await import('../../assets/logo.png')
                    const doc = await generateAuditPDF({
                      ...sub,
                      asset: { asset_code: asset.asset_code, asset_name: asset.asset_name, site: asset.site },
                    }, logo)
                    doc.save(`checklist-${asset.asset_code}-${new Date(sub.submitted_at).toISOString().split('T')[0]}.pdf`)
                  } catch (e) { console.error(e) }
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: fc.bg, color: fc.color, flexShrink: 0,
                  }}>
                    <ClipboardList size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-0)' }}>
                        {sub.checklist?.name || 'Checklist'}
                      </span>
                      <span style={{ padding: '2px 7px', borderRadius: 6, background: fc.bg, color: fc.color, textTransform: 'uppercase' }}>
                        {fc.label}
                      </span>
                      <span style={{ padding: '2px 7px', borderRadius: 6, background: ap.bg, color: ap.color, }}>
                        {ap.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)' }}>
                      <span>By: {sub.prepared_name || '-'}</span>
                      <span style={{ color: 'var(--green)', }}>{passCount} Pass</span>
                      {failCount > 0 && <span style={{ color: 'var(--red)', }}>{failCount} Fail</span>}
                      <span>{totalItems} items</span>
                    </div>
                    {/* Mini pass/fail bar */}
                    <div style={{ height: 4, background: 'var(--bg-4)', borderRadius: 3, marginTop: 6, overflow: 'hidden', maxWidth: 200 }}>
                      <div style={{ height: '100%', width: `${passPct}%`, background: failCount > 0 ? 'linear-gradient(90deg, var(--green), var(--amber))' : 'var(--green)', borderRadius: 3 }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: 'var(--text-2)', }}>
                      {new Date(sub.submitted_at).toLocaleDateString('en-GB')}
                    </div>
                    <div style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end', marginTop: 4 }}>
                      <Download size={10} /> PDF
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>
    </div>
  )
}


