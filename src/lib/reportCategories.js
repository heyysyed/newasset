import {
  Sparkles, Building2, Wrench, Clock, Layers, ShoppingCart, Truck, ShieldCheck, Tag
} from 'lucide-react'

export const CONSTRUCTION_REPORT_CATEGORIES = [
  {
    id: 'executive',
    title: '1. Executive & Project Overview',
    subtitle: 'Portfolio valuation, cross-site benchmarks & executive KPIs',
    color: '#0ea5e9',
    icon: Sparkles
  },
  {
    id: 'fixed_assets',
    title: '2. Fixed Assets',
    subtitle: 'Asset valuation, depreciation schedules, additions & disposals',
    color: '#8b5cf6',
    icon: Building2
  },
  {
    id: 'maintenance',
    title: '3. Equipment & Maintenance',
    subtitle: 'Work orders, breakdown history, MTTR, MTBF & availability',
    color: '#ef4444',
    icon: Wrench
  },
  {
    id: 'pm_maintenance',
    title: '4. Preventive Maintenance',
    subtitle: 'PM schedules, compliance %, SLA delays & inspection checklists',
    color: '#14b8a6',
    icon: Clock
  },
  {
    id: 'inventory',
    title: '5. Inventory & Materials',
    subtitle: 'Materials, spare parts, burn rate, stockouts & cycle counts',
    color: '#f59e0b',
    icon: Layers
  },
  {
    id: 'procurement',
    title: '6. Procurement & Purchase',
    subtitle: 'Purchase orders, RFQs, vendor scorecards & GRN receipts',
    color: '#6366f1',
    icon: ShoppingCart
  },
  {
    id: 'logistics',
    title: '7. Logistics & Asset Movement',
    subtitle: 'Inter-site transfers, freight lead times & RFID gate passes',
    color: '#a855f7',
    icon: Truck
  },
  {
    id: 'safety',
    title: '8. Safety, Compliance & Warranty',
    subtitle: 'Statutory fitness permits, geofence audits & warranty radar',
    color: '#22c55e',
    icon: ShieldCheck
  },
  {
    id: 'fleet',
    title: '9. Fleet & Vehicles',
    subtitle: 'Heavy machinery tracking, vehicle booking & driver logs',
    color: '#06b6d4',
    icon: Tag
  }
]
