import React from 'react'
import CategoryManager from '../components/admin/CategoryManager'

export default function CategoriesPage() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-0 m-0">Categories</h1>
          <p className="text-text-2 mt-1">Manage asset classifications and types across operations</p>
        </div>
      </div>
      <CategoryManager />
    </div>
  )
}
