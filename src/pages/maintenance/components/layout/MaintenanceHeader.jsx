import React, { useState, useEffect } from 'react';
import { Search, Plus, QrCode, HardHat, Wrench } from 'lucide-react';

export default function MaintenanceHeader() {
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchQuery) {
        console.log("Global search for:", searchQuery);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [searchQuery]);

  return (
    <div className="pb-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-[var(--bg-0)] p-4 md:p-6 rounded-2xl border border-[var(--border)] shadow-sm gap-4 md:gap-6">
      {/* Mobile Top Header: Title + QR */}
      <div className="flex items-center justify-between w-full md:w-auto">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center shrink-0 shadow-sm shadow-[var(--accent-glow)]">
            <Wrench size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[var(--text-0)] m-0 leading-tight">
              Maintenance
            </h1>
            <p className="text-xs text-[var(--text-3)] uppercase tracking-wider m-0 mt-0.5 font-medium leading-tight hidden sm:block max-w-[200px] md:max-w-none">
              Command Center
            </p>
          </div>
        </div>
        
        {/* QR Button (Mobile Only) */}
        <button className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--bg-1)] border border-[var(--border)] text-[var(--text-1)] active:scale-95 transition-transform">
          <QrCode size={18} />
        </button>
      </div>

      {/* Actions Container */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto flex-1 md:justify-end">
        
        {/* Search */}
        <div className="relative w-full sm:max-w-[240px] lg:max-w-[320px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input 
            type="text" 
            placeholder="Search assets, tickets..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full py-2.5 pl-10 pr-4 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] text-[var(--text-1)] text-sm font-medium focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all placeholder-[var(--text-3)]"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 sm:gap-2">
          {/* QR Button (Desktop Only) */}
          <button className="hidden md:flex flex-shrink-0 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] hover:bg-[var(--bg-2)] transition-colors text-[var(--text-1)]" title="Scan Asset">
            <QrCode size={18} />
          </button>
          
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] hover:bg-[var(--bg-2)] transition-colors text-[var(--text-1)] text-sm font-semibold whitespace-nowrap">
            <Plus size={16} /> <span className="sm:hidden lg:inline">New</span> Ticket
          </button>
          
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:opacity-90 transition-opacity text-white text-sm font-semibold whitespace-nowrap shadow-sm shadow-[var(--accent-glow)]">
            <HardHat size={16} /> <span className="sm:hidden lg:inline">New</span> Work Order
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}


