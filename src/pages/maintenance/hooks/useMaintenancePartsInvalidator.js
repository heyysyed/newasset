/**
 * useMaintenancePartsInvalidator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * A parts write from a maintenance screen changes data that four other surfaces
 * are showing: the Inventory page (stock levels), the asset's Parts tab (what is
 * fitted), the asset cost roll-up (combined value) and the maintenance dashboard
 * (work order cost). This hook invalidates all of them in one call.
 *
 * The parts half reuses `usePartsInvalidator()` from the inventory module so the
 * key literals are shared — see PARTS_KEYS in src/components/inventory/partsUI.jsx.
 * If those literals ever drift, install-from-maintenance would stop refreshing
 * Inventory, so they are imported rather than retyped.
 */

import { useQueryClient } from '@tanstack/react-query'
import { usePartsInvalidator, PARTS_KEYS } from '../../../components/inventory/partsUI'
import { MAINTENANCE_INVALIDATION_KEYS } from '../queryKeys'

export function useMaintenancePartsInvalidator() {
  const qc = useQueryClient()
  const invalidateParts = usePartsInvalidator()

  /**
   * @param {object} scope
   * @param {string} [scope.assetId]     asset the part went in to / came out of
   * @param {string} [scope.workOrderId] work order the cost was booked against
   */
  return function invalidateMaintenanceParts({ assetId, workOrderId } = {}) {
    // Inventory / asset parts / cost roll-up / where-used / lifecycle
    const extra = []
    if (assetId) {
      extra.push([...PARTS_KEYS.assetComponents, assetId])
      extra.push([...PARTS_KEYS.assetCost, assetId])
    }
    if (workOrderId) {
      extra.push([...PARTS_KEYS.workOrderParts, workOrderId])
    }
    invalidateParts(extra)

    // Maintenance's own surfaces
    MAINTENANCE_INVALIDATION_KEYS.forEach(queryKey => qc.invalidateQueries({ queryKey }))

    // The asset drawer inside maintenance reads open work orders for the asset
    if (assetId) qc.invalidateQueries({ queryKey: ['open-work-orders', assetId] })
  }
}

export default useMaintenancePartsInvalidator
