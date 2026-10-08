import React, { useState } from 'react'
import { PlusCircle, MapPin, MoreVertical, Edit2, Trash2, Map as MapIcon, List, AlertTriangle } from 'lucide-react'
import MobilePageHeader from './MobilePageHeader'
import MobileEmptyState from './MobileEmptyState'
import MobileCard from './MobileCard'
import MobileActionSheet from './MobileActionSheet'

import MobileSiteCard from './MobileSiteCard'

export default function MobileSitesPage({
  sites,
  loading,
  can,
  isAdmin,
  isMod,
  openNew,
  openEdit,
  handleDelete,
  openDrawer,
  getSiteAnalytics,
}) {
  const [actionSite, setActionSite] = useState(null)
  
  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[...Array(3)].map((_, i) => (
          <div key={`skel3-${i}`} className="h-44 bg-bg-1 border border-border rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-bg-0 pb-28">
      
      {/* ── Main List ── */}
      <div className="px-4 py-4 flex flex-col gap-3">
        {sites.length === 0 ? (
          <MobileEmptyState
            icon={MapPin}
            title="No Sites Configured"
            description="Add your first site to map your assets."
            action={openNew}
            actionLabel="Add Site"
          />
        ) : (
          sites.map(site => {
            const analytics = getSiteAnalytics(site.name)
            return (
              <MobileSiteCard
                key={site.id}
                site={site}
                analytics={analytics}
                onViewSite={() => openDrawer(site)}
                onMoreClick={(s) => setActionSite(s)}
              />
            )
          })
        )}
      </div>

      {/* ── FAB Add Button ── */}
      {(isAdmin || isMod || can('add')) && (
        <button
          onClick={openNew}
          className="fixed bottom-[88px] right-4 w-14 h-14 bg-accent text-white rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform z-40"
          aria-label="Add Site"
        >
          <PlusCircle size={24} />
        </button>
      )}

      {/* ── Action Sheet ── */}
      <MobileActionSheet
        isOpen={!!actionSite}
        onClose={() => setActionSite(null)}
        title={actionSite?.name || 'Site Actions'}
        groups={[
          {
            items: [
              { icon: Edit2, label: 'Edit Site', onClick: () => openEdit(actionSite), disabled: !(isAdmin || isMod) },
            ]
          },
          ...(isAdmin || isMod ? [{
            destructive: true,
            items: [
              { icon: Trash2, label: 'Delete Site', danger: true, onClick: () => { handleDelete(actionSite.id, actionSite.name); setActionSite(null) } },
            ]
          }] : [])
        ]}
      />
    </div>
  )
}


