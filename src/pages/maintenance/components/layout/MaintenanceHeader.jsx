import React, { useState, useEffect } from 'react';
import { Search, Plus, QrCode, HardHat, Wrench } from 'lucide-react';

export default function MaintenanceHeader() {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Debounced search simulation for Phase 2.1
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchQuery) {
        console.log("Global search for:", searchQuery);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [searchQuery]);

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      padding: '16px 24px',
      background: 'var(--bg-0)',
      borderBottom: '1px solid var(--border)',
      gap: 20
    }}>
      {/* Title Area */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ 
          width: 40, height: 40, borderRadius: 8, 
          background: 'var(--accent)', color: 'white', 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>
          <Wrench size={20} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-0)', lineHeight: 1.2 }}>
            Maintenance
          </h1>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2 }}>
            Asset maintenance & reliability command center
          </p>
        </div>
      </div>

      {/* Search Area */}
      <div style={{ flex: 1, maxWidth: 400 }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input 
            type="text" 
            placeholder="Search assets, tickets, work orders..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px 12px 8px 36px', 
              borderRadius: 20, 
              border: '1px solid var(--border)',
              background: 'var(--bg-2)',
              color: 'var(--text-1)',
              fontSize: '0.9rem'
            }}
          />
        </div>
      </div>

      {/* Primary Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn-ghost" style={{ padding: '8px', borderRadius: 8 }} title="Scan Asset">
          <QrCode size={18} />
        </button>
        <button className="btn-ghost" style={{ padding: '8px 12px', gap: 6, borderRadius: 8, display: 'flex', alignItems: 'center' }}>
          <Plus size={16} /> New Ticket
        </button>
        <button className="btn-primary" style={{ padding: '8px 16px', gap: 8, borderRadius: 8, display: 'flex', alignItems: 'center' }}>
          <HardHat size={16} /> New Work Order
        </button>
      </div>
    </div>
  );
}


