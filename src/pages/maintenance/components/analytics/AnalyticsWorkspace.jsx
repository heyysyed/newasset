import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { supabase, fetchAllVendors } from '../../../../lib/supabase';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { Loader2 } from 'lucide-react';

const CHART_COLORS = ['#4f7eff', '#34d399', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function AnalyticsWorkspace() {
  const { currentCompany } = useAuth();
  const cc = currentCompany?.code;

  const [allLogs, setAllLogs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [cc]);

  async function fetchData() {
    setLoading(true);
    try {
      let q = supabase.from('maintenance_logs').select('cost, performed_at, asset_id, vendor_id, assets(asset_name, category)');
      
      const [al, v] = await Promise.all([
        q,
        fetchAllVendors()
      ]);
      setAllLogs(al.data || []);
      setVendors(v || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
  };

  const monthlySpend = useMemo(() => {
    const map = {};
    allLogs.forEach(l => {
      if (!l.performed_at || !l.cost) return;
      const m = new Date(l.performed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      map[m] = (map[m] || 0) + Number(l.cost);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).slice(-12);
  }, [allLogs]);

  const spendByVendor = useMemo(() => {
    const map = {};
    allLogs.forEach(l => {
      if (!l.cost) return;
      const vName = l.vendor_id ? vendors.find(v => v.id === l.vendor_id)?.name || 'Unknown' : 'In-house';
      map[vName] = (map[vName] || 0) + Number(l.cost);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [allLogs, vendors]);

  const spendByAsset = useMemo(() => {
    const map = {};
    allLogs.forEach(l => {
      if (!l.cost) return;
      const name = l.assets?.asset_name || 'Unknown';
      map[name] = (map[name] || 0) + Number(l.cost);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [allLogs]);

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} /></div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-0)', margin: '0 0 4px 0' }}>Analytics</h1>
          <p style={{ margin: 0, color: 'var(--text-2)', fontSize: '0.9rem' }}>Insights into maintenance spend and performance.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ textTransform: 'uppercase', marginBottom: 16 }}>Monthly Spend</h3>
          {monthlySpend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlySpend}>
                <XAxis dataKey="name" tick={{ }} />
                <YAxis tick={{ }} />
                <Tooltip formatter={v => formatCurrency(v)} />
                <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: 40 }}>No data yet</p>}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ textTransform: 'uppercase', marginBottom: 16 }}>Spend by Vendor</h3>
          {spendByVendor.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={spendByVendor} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} >
                  {spendByVendor.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: 40 }}>No data yet</p>}
        </div>

        <div className="card" style={{ padding: 20, gridColumn: '1 / -1' }}>
          <h3 style={{ textTransform: 'uppercase', marginBottom: 16 }}>Top 10 Assets by Maintenance Cost</h3>
          {spendByAsset.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={spendByAsset} layout="vertical">
                <XAxis type="number" tick={{ }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ }} />
                <Tooltip formatter={v => formatCurrency(v)} />
                <Bar dataKey="value" fill="#34d399" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: 40 }}>No data yet</p>}
        </div>
      </div>
    </div>
  );
}
