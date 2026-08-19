import { useState, useMemo } from 'react';
import {
  AlertTriangle, Clock, ShieldCheck, Eye,
  Pencil, Package, Timer, MapPin,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ModalShell from './ModalShell';
import { fmtDate } from './helpers';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

function statusOf(daysLeft) {
  if (daysLeft === null) return null;
  if (daysLeft < 0) return { label: 'EXPIRED', color: 'var(--red)', dim: 'var(--red-dim)', key: 'expired' };
  if (daysLeft < 30) return { label: 'EXPIRING SOON', color: 'var(--amber)', dim: 'var(--amber-dim)', key: 'expiring' };
  if (daysLeft <= 90) return { label: 'MONITOR', color: 'var(--cyan)', dim: 'var(--cyan-dim)', key: 'monitor' };
  return { label: 'OK', color: 'var(--green)', dim: 'var(--green-dim)', key: 'ok' };
}

/* ── set expiry modal ─────────────────────────────────────── */

export function SetExpiryModal({ item, onSave, onClose }) {
  const [batchNo, setBatchNo] = useState(item?.batch_no || '');
  const [mfgDate, setMfgDate] = useState(item?.manufactured_date || '');
  const [expDate, setExpDate] = useState(item?.expiry_date || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('material_site_stock')
        .update({
          batch_no: batchNo || null,
          manufactured_date: mfgDate || null,
          expiry_date: expDate || null
        })
        .eq('id', item.id);

      if (err) throw err;
      if (onSave) await onSave();
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const materialName = item?.materials?.material_name || item?.material_name || 'Unknown';

  return (
    <ModalShell onClose={onClose} accent="var(--accent)">
      <h3 style={{ fontFamily: 'Oswald', fontSize: 18, color: 'var(--text-0)', margin: '0 0 4px' }}>
        Set Expiry Details
      </h3>
      <p style={{ fontFamily: 'DM Sans', fontSize: 13, color: 'var(--text-2)', margin: '0 0 20px' }}>
        {materialName} &mdash; {item?.site || ''}
      </p>

      {error && (
        <div style={{
          background: 'var(--red-dim)', border: '1px solid var(--red)',
          borderRadius: 8, padding: '8px 12px', marginBottom: 16,
          fontFamily: 'DM Sans', fontSize: 13, color: 'var(--red)'
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="lbl" style={{ fontFamily: 'DM Sans', fontSize: 12, color: 'var(--text-2)', marginBottom: 4, display: 'block' }}>
            Batch No
          </label>
          <input
            className="inp"
            type="text"
            value={batchNo}
            onChange={e => setBatchNo(e.target.value)}
            placeholder="e.g. BT-2026-0412"
            style={{ width: '100%', fontFamily: 'DM Mono', fontSize: 13 }}
          />
        </div>

        <div>
          <label className="lbl" style={{ fontFamily: 'DM Sans', fontSize: 12, color: 'var(--text-2)', marginBottom: 4, display: 'block' }}>
            Manufactured Date
          </label>
          <input
            className="inp"
            type="date"
            value={mfgDate}
            onChange={e => setMfgDate(e.target.value)}
            style={{ width: '100%', fontFamily: 'DM Mono', fontSize: 13 }}
          />
        </div>

        <div>
          <label className="lbl" style={{ fontFamily: 'DM Sans', fontSize: 12, color: 'var(--text-2)', marginBottom: 4, display: 'block' }}>
            Expiry Date
          </label>
          <input
            className="inp"
            type="date"
            value={expDate}
            onChange={e => setExpDate(e.target.value)}
            style={{ width: '100%', fontFamily: 'DM Mono', fontSize: 13 }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
        <button className="btn-ghost" onClick={onClose} style={{ fontFamily: 'DM Sans', fontSize: 13 }}>
          Cancel
        </button>
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ fontFamily: 'DM Sans', fontSize: 13, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </ModalShell>
  );
}

/* ── summary card ─────────────────────────────────────────── */

function SummaryCard({ icon: Icon, label, count, color, dim, accent }) {
  return (
    <div className="mat-sub-stat" data-accent={accent || 'accent'}>
      <div className="mat-sub-stat-icon" style={{ background: dim }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <div className="mat-sub-stat-val">{count}</div>
        <div className="mat-sub-stat-label">{label}</div>
      </div>
    </div>
  );
}

/* ── main component ───────────────────────────────────────── */

export default function ExpiryTracker({ stock, onRefresh }) {
  const [editItem, setEditItem] = useState(null);

  /* filter to items with expiry_date, enrich with status */
  const tracked = useMemo(() => {
    if (!stock) return [];
    return stock
      .filter(s => s.expiry_date)
      .map(s => {
        const daysLeft = daysUntil(s.expiry_date);
        return { ...s, daysLeft, status: statusOf(daysLeft) };
      })
      .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
  }, [stock]);

  /* summary counts */
  const summary = useMemo(() => {
    const counts = { total: tracked.length, expired: 0, expiring: 0, ok: 0 };
    tracked.forEach(t => {
      if (t.status.key === 'expired') counts.expired++;
      else if (t.status.key === 'expiring') counts.expiring++;
      else counts.ok++;
    });
    return counts;
  }, [tracked]);

  const hasAlerts = summary.expired > 0 || summary.expiring > 0;

  return (
    <div>
      {/* ── alert banner ── */}
      {hasAlerts && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, margin: '14px 16px 0',
          padding: '10px 14px', borderRadius: 10,
          background: summary.expired > 0 ? 'var(--red-dim)' : 'var(--amber-dim)',
          border: `1px solid ${summary.expired > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
          fontFamily: 'DM Sans', fontSize: '0.8rem'
        }}>
          <AlertTriangle size={16} style={{ color: summary.expired > 0 ? 'var(--red)' : 'var(--amber)', flexShrink: 0 }} />
          <span style={{ color: 'var(--text-1)' }}>
            {summary.expired > 0 && <strong style={{ color: 'var(--red)' }}>{summary.expired} expired. </strong>}
            {summary.expiring > 0 && <span style={{ color: 'var(--amber)' }}>{summary.expiring} expiring soon.</span>}
          </span>
        </div>
      )}

      {/* ── summary cards ── */}
      <div className="mat-sub-stats">
        <SummaryCard icon={Eye} label="Total Tracked" count={summary.total} color="var(--accent)" dim="var(--accent-glow)" accent="accent" />
        <SummaryCard icon={AlertTriangle} label="Expired" count={summary.expired} color="var(--red)" dim="var(--red-dim)" accent="red" />
        <SummaryCard icon={Clock} label="Expiring Soon" count={summary.expiring} color="var(--amber)" dim="var(--amber-dim)" accent="amber" />
        <SummaryCard icon={ShieldCheck} label="OK" count={summary.ok} color="var(--green)" dim="var(--green-dim)" accent="green" />
      </div>

      {/* ── table + mobile ── */}
      {tracked.length === 0 ? (
        <div className="card" style={{
          padding: '48px 20px', textAlign: 'center',
          fontFamily: 'DM Sans', fontSize: 14, color: 'var(--text-3)'
        }}>
          <Package size={32} style={{ color: 'var(--text-3)', marginBottom: 8, opacity: 0.4 }} />
          <div>No stock items with expiry dates set.</div>
          <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-3)' }}>
            Use the edit icon on stock rows to set expiry information.
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="card desktop-table" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Timer size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontFamily: 'Oswald', fontSize: 16, color: 'var(--text-0)', margin: 0 }}>
                Expiry Overview
              </h3>
              <span style={{ fontFamily: 'DM Sans', fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>
                Sorted by soonest expiry
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Material', 'Code', 'Site', 'Batch No', 'Qty', 'Manufactured', 'Expiry Date', 'Days Left', 'Status', ''].map(h => (
                      <th key={h} style={{
                        fontFamily: 'DM Sans', fontSize: 11, fontWeight: 600,
                        color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em',
                        padding: '10px 14px', textAlign: 'left', whiteSpace: 'nowrap',
                        borderBottom: '1px solid var(--border)', background: 'var(--bg-1)'
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tracked.map(row => {
                    const mat = row.materials || {};
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={tdStyle}>
                          <span style={{ fontFamily: 'DM Sans', fontWeight: 500, color: 'var(--text-0)' }}>
                            {mat.material_name || '—'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontFamily: 'DM Mono', fontSize: 12, color: 'var(--text-2)' }}>
                            {mat.material_code || '—'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontFamily: 'DM Sans', color: 'var(--text-1)' }}>{row.site || '—'}</span>
                        </td>
                      <td style={tdStyle}>
                        <span style={{ fontFamily: 'DM Mono', fontSize: 12, color: 'var(--text-2)' }}>
                          {row.batch_no || '—'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <span style={{ fontFamily: 'DM Mono', fontSize: 13, color: 'var(--text-0)' }}>
                          {row.quantity ?? '—'}
                        </span>
                        {mat.unit && (
                          <span style={{ fontFamily: 'DM Sans', fontSize: 11, color: 'var(--text-3)', marginLeft: 4 }}>
                            {mat.unit}
                          </span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontFamily: 'DM Mono', fontSize: 12, color: 'var(--text-2)' }}>
                          {fmtDate(row.manufactured_date)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontFamily: 'DM Mono', fontSize: 12, color: row.status.color, fontWeight: 500 }}>
                          {fmtDate(row.expiry_date)}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <span style={{
                          fontFamily: 'DM Mono', fontSize: 13, fontWeight: 600,
                          color: row.status.color
                        }}>
                          {row.daysLeft < 0 ? `${Math.abs(row.daysLeft)}d overdue` : `${row.daysLeft}d`}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span
                          className="badge"
                          style={{
                            fontFamily: 'DM Sans', fontSize: 11, fontWeight: 600,
                            padding: '3px 10px', borderRadius: 6,
                            background: row.status.dim, color: row.status.color,
                            whiteSpace: 'nowrap', letterSpacing: '0.03em'
                          }}
                        >
                          {row.status.label}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', width: 40 }}>
                        <button
                          onClick={() => setEditItem(row)}
                          title="Set expiry details"
                          style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: 'var(--text-3)', padding: 4, borderRadius: 6,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

          {/* Mobile Cards */}
          <div className="mobile-cards" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tracked.map(row => {
              const mat = row.materials || {};
              return (
                <div key={row.id} className="card" style={{
                  padding: '14px 16px',
                  borderLeft: `3px solid ${row.status.color}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span className="badge" style={{
                      background: row.status.dim, color: row.status.color,
                      fontSize: 11, fontWeight: 600, letterSpacing: '0.03em',
                    }}>
                      {row.status.label}
                    </span>
                    <span style={{ fontFamily: 'DM Mono', fontSize: 13, fontWeight: 600, color: row.status.color }}>
                      {row.daysLeft < 0 ? `${Math.abs(row.daysLeft)}d overdue` : `${row.daysLeft}d left`}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 3 }}>{mat.material_name || '—'}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontFamily: 'DM Mono', marginBottom: 10 }}>{mat.material_code || ''}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: '0.78rem' }}>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginBottom: 1 }}>Site</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={11} style={{ color: 'var(--text-3)' }} />{row.site || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginBottom: 1 }}>Qty</div>
                      <div style={{ fontFamily: 'DM Mono', fontWeight: 600 }}>{row.quantity ?? '—'} {mat.unit || ''}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginBottom: 1 }}>Batch</div>
                      <div style={{ fontFamily: 'DM Mono', fontSize: 12 }}>{row.batch_no || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginBottom: 1 }}>Expiry</div>
                      <div style={{ fontFamily: 'DM Mono', fontSize: 12, color: row.status.color, fontWeight: 500 }}>{fmtDate(row.expiry_date)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button onClick={() => setEditItem(row)} className="btn-ghost" style={{ padding: '4px 10px', fontSize: '0.72rem' }}>
                      <Pencil size={12} /> Edit Expiry
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── edit modal ── */}
      {editItem && (
        <SetExpiryModal
          item={editItem}
          onSave={onRefresh}
          onClose={() => setEditItem(null)}
        />
      )}
    </div>
  );
}

/* ── shared td style ──────────────────────────────────────── */

const tdStyle = {
  padding: '10px 14px',
  fontFamily: 'DM Sans',
  fontSize: 13,
  color: 'var(--text-1)',
  whiteSpace: 'nowrap'
};
