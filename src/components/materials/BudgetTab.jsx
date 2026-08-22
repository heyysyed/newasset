import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, AlertTriangle, IndianRupee,
  TrendingUp, Building2, Calendar, FileText, PieChart
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import ModalShell from './ModalShell';
import { fmtCurrency as fmtCur } from './helpers';

function getDefaultPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = d => d.toISOString().split('T')[0];
  return { period_start: fmt(start), period_end: fmt(end) };
}

function getBarColor(pct) {
  if (pct > 100) return 'var(--red)';
  if (pct >= 80) return 'var(--amber)';
  return 'var(--green)';
}

function getBarBg(pct) {
  if (pct > 100) return 'var(--red-dim)';
  if (pct >= 80) return 'var(--amber-dim)';
  return 'var(--green-dim)';
}

export default function BudgetTab({ sites, onRefresh }) {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [spendMap, setSpendMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const defaults = getDefaultPeriod();
  const [form, setForm] = useState({
    site: '',
    budget_amount: '',
    period_start: defaults.period_start,
    period_end: defaults.period_end,
    notes: ''
  });

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('material_site_budgets')
        .select('*')
        .order('period_start', { ascending: false });

      if (error) throw error;
      setBudgets(data || []);

      // Batch fetch all spend transactions instead of N+1 loop
      if (data?.length) {
        const earliest = data.reduce((min, b) => b.period_start < min ? b.period_start : min, data[0].period_start);
        const latest = data.reduce((max, b) => b.period_end > max ? b.period_end : max, data[0].period_end);

        const { data: allTxns, error: txErr } = await supabase
          .from('material_transactions')
          .select('to_site, unit_cost, quantity, created_at')
          .in('transaction_type', ['purchase', 'requisition'])
          .gte('created_at', earliest)
          .lte('created_at', latest + 'T23:59:59');

        const map = {};
        for (const b of data) {
          map[b.id] = 0;
          if (!txErr && allTxns) {
            for (const t of allTxns) {
              if (t.to_site === b.site && t.created_at >= b.period_start && t.created_at <= b.period_end + 'T23:59:59') {
                map[b.id] += (Number(t.quantity) || 0) * (Number(t.unit_cost) || 0);
              }
            }
          }
        }
        setSpendMap(map);
      } else {
        setSpendMap({});
      }
    } catch (err) {
      console.error('Failed to fetch budgets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);

  const openCreate = () => {
    const d = getDefaultPeriod();
    setEditingBudget(null);
    setForm({ site: '', budget_amount: '', period_start: d.period_start, period_end: d.period_end, notes: '' });
    setModalOpen(true);
  };

  const openEdit = (b) => {
    setEditingBudget(b);
    setForm({
      site: b.site,
      budget_amount: b.budget_amount,
      period_start: b.period_start,
      period_end: b.period_end,
      notes: b.notes || ''
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.site || !form.budget_amount) return;
    setSaving(true);

    const period_start = form.period_start || defaults.period_start;
    const period_end = form.period_end || defaults.period_end;

    const payload = {
      site: form.site,
      budget_amount: Number(form.budget_amount),
      period_start,
      period_end,
      notes: form.notes,
      updated_at: new Date().toISOString()
    };

    try {
      if (editingBudget) {
        const { error } = await supabase
          .from('material_site_budgets')
          .update(payload)
          .eq('id', editingBudget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('material_site_budgets')
          .insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }

      setModalOpen(false);
      fetchBudgets();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Save budget error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('material_site_budgets')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      setDeleteTarget(null);
      fetchBudgets();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Delete budget error:', err);
    } finally {
      setSaving(false);
    }
  };

  // Computed summaries
  const totalBudget = budgets.reduce((s, b) => s + Number(b.budget_amount || 0), 0);
  const totalSpend = Object.values(spendMap).reduce((s, v) => s + v, 0);
  const overallUtil = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;
  const overBudgetSites = budgets.filter(b => {
    const spend = spendMap[b.id] || 0;
    return spend > Number(b.budget_amount);
  });

  const fmtDate = (d) => {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Over-budget Alert */}
      {overBudgetSites.length > 0 && (
        <div style={{
          background: 'var(--red-dim)', border: '1px solid var(--red)',
          borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12
        }}>
          <AlertTriangle size={20} style={{ color: 'var(--red)', flexShrink: 0 }} />
          <div style={{ color: 'var(--red)' }}>
            <strong>Over-budget alert:</strong>{' '}
            {overBudgetSites.map(b => b.site).join(', ')} {overBudgetSites.length === 1 ? 'has' : 'have'} exceeded the allocated budget.
          </div>
        </div>
      )}

      {/* Summary Row */}
      <div className="mat-sub-stats">
        <div className="mat-sub-stat" data-accent="accent">
          <div className="mat-sub-stat-icon" style={{ background: 'var(--accent-glow)' }}>
            <IndianRupee size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div className="mat-sub-stat-val">{fmtCur(totalBudget)}</div>
            <div className="mat-sub-stat-label">Total Budget</div>
          </div>
        </div>
        <div className="mat-sub-stat" data-accent={totalSpend > totalBudget ? 'red' : 'green'}>
          <div className="mat-sub-stat-icon" style={{ background: totalSpend > totalBudget ? 'var(--red-dim)' : 'var(--green-dim)' }}>
            <TrendingUp size={18} style={{ color: totalSpend > totalBudget ? 'var(--red)' : 'var(--green)' }} />
          </div>
          <div>
            <div className="mat-sub-stat-val">{fmtCur(totalSpend)}</div>
            <div className="mat-sub-stat-label">Total Spend</div>
          </div>
        </div>
        <div className="mat-sub-stat" data-accent={overallUtil > 100 ? 'red' : overallUtil > 80 ? 'amber' : 'green'}>
          <div className="mat-sub-stat-icon" style={{ background: getBarColor(overallUtil) === 'var(--green)' ? 'var(--green-dim)' : getBarColor(overallUtil) === 'var(--amber)' ? 'var(--amber-dim)' : 'var(--red-dim)' }}>
            <PieChart size={18} style={{ color: getBarColor(overallUtil) }} />
          </div>
          <div>
            <div className="mat-sub-stat-val" style={{ color: getBarColor(overallUtil) }}>{overallUtil.toFixed(1)}%</div>
            <div className="mat-sub-stat-label">Overall Utilization</div>
          </div>
        </div>
      </div>

      {/* Header + Add */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 12px' }}>
        <h3 style={{ color: 'var(--text-0)', margin: 0, letterSpacing: '0.03em' }}>
          Site Budgets
        </h3>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={15} /><span className="btn-label">Add Budget</span>
        </button>
      </div>

      {/* Budget Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', }}>
          Loading budgets...
        </div>
      ) : budgets.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <Building2 size={36} style={{ color: 'var(--text-3)', marginBottom: 12 }} />
          <div style={{ color: 'var(--text-2)' }}>
            No site budgets configured yet. Click "Add Budget" to get started.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))', gap: 16 }}>
          {budgets.map(b => {
            const budget = Number(b.budget_amount || 0);
            const spend = spendMap[b.id] || 0;
            const remaining = budget - spend;
            const utilPct = budget > 0 ? (spend / budget) * 100 : 0;
            const barColor = getBarColor(utilPct);
            const barBg = getBarBg(utilPct);

            return (
              <div className="card" key={b.id} style={{ padding: '20px 22px', position: 'relative' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ color: 'var(--text-0)', marginBottom: 4 }}>
                      {b.site}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', }}>
                      <Calendar size={12} />
                      {fmtDate(b.period_start)} - {fmtDate(b.period_end)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {utilPct > 100 && (
                      <span className="badge" style={{ background: 'var(--red-dim)', color: 'var(--red)', marginRight: 4 }}>
                        Over Budget
                      </span>
                    )}
                    <button className="btn-ghost" onClick={() => openEdit(b)} style={{ padding: 6 }}>
                      <Edit2 size={14} />
                    </button>
                    <button className="btn-ghost" onClick={() => setDeleteTarget(b)} style={{ padding: 6, color: 'var(--red)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Budget vs Spend */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <div className="lbl" style={{ marginBottom: 2 }}>Budget</div>
                    <div style={{ color: 'var(--text-0)' }}>{fmtCur(budget)}</div>
                  </div>
                  <div>
                    <div className="lbl" style={{ marginBottom: 2 }}>Spent</div>
                    <div style={{ color: barColor }}>{fmtCur(spend)}</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ background: barBg, borderRadius: 6, height: 8, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{
                    width: `${Math.min(utilPct, 100)}%`,
                    height: '100%',
                    background: barColor,
                    borderRadius: 6,
                    transition: 'width 0.4s ease'
                  }} />
                </div>

                {/* Bottom row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: remaining >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {remaining >= 0 ? 'Remaining: ' : 'Overrun: '}{fmtCur(Math.abs(remaining))}
                  </div>
                  <div style={{
                    color: barColor, }}>
                    {utilPct.toFixed(1)}%
                  </div>
                </div>

                {/* Notes */}
                {b.notes && (
                  <div style={{
                    marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)',
                    display: 'flex', alignItems: 'flex-start', gap: 6,
                    color: 'var(--text-3)', }}>
                    <FileText size={12} style={{ marginTop: 2, flexShrink: 0 }} />
                    {b.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <ModalShell onClose={() => setModalOpen(false)} accent="var(--accent)">
          <h3 style={{ color: 'var(--text-0)', margin: '0 0 20px' }}>
            {editingBudget ? 'Edit Budget' : 'Create Site Budget'}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Site */}
            <div>
              <label className="lbl" style={{ display: 'block', marginBottom: 6 }}>Site</label>
              <select
                className="sel"
                value={form.site}
                onChange={e => setForm(f => ({ ...f, site: e.target.value }))}
                style={{ width: '100%' }}
              >
                <option value="">Select site...</option>
                {(sites || []).map(s => {
                  const name = typeof s === 'string' ? s : s.name || s.site_name || s.label || '';
                  return <option key={name} value={name}>{name}</option>;
                })}
              </select>
            </div>

            {/* Budget Amount */}
            <div>
              <label className="lbl" style={{ display: 'block', marginBottom: 6 }}>Budget Amount (\u20B9)</label>
              <input
                className="inp"
                type="number"
                placeholder="0.00"
                value={form.budget_amount}
                onChange={e => setForm(f => ({ ...f, budget_amount: e.target.value }))}
                style={{ width: '100%' }}
              />
            </div>

            {/* Period */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="lbl" style={{ display: 'block', marginBottom: 6 }}>Period Start</label>
                <input
                  className="inp"
                  type="date"
                  value={form.period_start}
                  onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label className="lbl" style={{ display: 'block', marginBottom: 6 }}>Period End</label>
                <input
                  className="inp"
                  type="date"
                  value={form.period_end}
                  onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="lbl" style={{ display: 'block', marginBottom: 6 }}>Notes</label>
              <textarea
                className="inp"
                rows={3}
                placeholder="Optional notes..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button className="btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving || !form.site || !form.budget_amount}
              >
                {saving ? 'Saving...' : editingBudget ? 'Update Budget' : 'Create Budget'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ModalShell onClose={() => setDeleteTarget(null)} accent="var(--red)">
          <h3 style={{ color: 'var(--text-0)', margin: '0 0 12px' }}>
            Delete Budget
          </h3>
          <p style={{ color: 'var(--text-2)', margin: '0 0 20px' }}>
            Are you sure you want to delete the budget for <strong>{deleteTarget.site}</strong> ({fmtDate(deleteTarget.period_start)} - {fmtDate(deleteTarget.period_end)})?
            This action cannot be undone.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className="btn-danger" onClick={handleDelete} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete Budget'}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
