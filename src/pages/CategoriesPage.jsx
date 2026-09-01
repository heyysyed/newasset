import React from 'react'
import CategoryManager from '../components/admin/CategoryManager'
import { Tags } from 'lucide-react'

export default function CategoriesPage() {
  return (
    <div style={{ width: '100%' }}>
      {/* ── Header (Premium Style) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-[var(--bg-0)] p-4 md:p-6 rounded-2xl border border-[var(--border)] shadow-sm mb-6 gap-4">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center shrink-0 shadow-sm shadow-[var(--accent-glow)]">
            <Tags size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[var(--text-0)] m-0 leading-tight">
              Categories
            </h1>
            <p className="text-xs text-[var(--text-3)] tracking-wider m-0 mt-1 font-medium leading-tight hidden md:block">
              Manage asset classifications and types across operations
            </p>
          </div>
        </div>
      </div>
      <CategoryManager />
    </div>
  )
}
