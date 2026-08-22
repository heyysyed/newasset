import React from 'react'
import MobileBottomSheet from './MobileBottomSheet'

/**
 * MobileActionSheet
 *
 * iOS-style contextual action menu.
 * Groups of actions with optional destructive separation.
 *
 * Usage:
 * <MobileActionSheet
 *   isOpen={open}
 *   onClose={() => setOpen(false)}
 *   title="Asset Actions"
 *   groups={[
 *     {
 *       items: [
 *         { icon: Edit2, label: 'Edit Asset', onClick: handleEdit },
 *         { icon: ArrowRightLeft, label: 'Transfer', onClick: handleTransfer },
 *       ]
 *     },
 *     {
 *       destructive: true,
 *       items: [
 *         { icon: Trash2, label: 'Delete Asset', onClick: handleDelete, danger: true },
 *       ]
 *     }
 *   ]}
 * />
 */
export default function MobileActionSheet({ isOpen, onClose, title, groups = [] }) {
  if (!isOpen) return null

  return (
    <MobileBottomSheet isOpen={isOpen} onClose={onClose} title={title} size="auto">
      <div className="px-4 py-3 flex flex-col gap-2 pb-4">
        {groups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <div className="h-px bg-border my-2" />}
            <div className="flex flex-col">
              {group.items.map((item, ii) => {
                const Icon = item.icon
                return (
                  <button
                    key={ii}
                    onClick={() => {
                      onClose()
                      item.onClick?.()
                    }}
                    disabled={item.disabled}
                    className={`flex items-center gap-4 w-full px-3 py-3.5 rounded-xl text-left transition-colors active:scale-[0.98]
                      ${item.danger
                        ? 'text-danger hover:bg-danger-subtle active:bg-danger-subtle'
                        : 'text-text-0 hover:bg-bg-2 active:bg-bg-2'
                      }
                      ${item.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    {Icon && (
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                        ${item.danger ? 'bg-danger-subtle' : 'bg-bg-2'}
                      `}>
                        <Icon size={18} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.925rem] text-body-medium leading-tight">{item.label}</div>
                      {item.description && (
                        <div className="text-caption text-text-3 mt-0.5">{item.description}</div>
                      )}
                    </div>
                    {item.badge && (
                      <span className="text-caption px-2 py-0.5 bg-bg-3 rounded-full text-text-2">
                        {item.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </MobileBottomSheet>
  )
}
