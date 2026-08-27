/**
 * Intelligence Contract
 * Standardizes the return structure for all intelligence engines.
 */

export const DomainStatus = {
  SUCCESS: 'success',
  PARTIAL: 'partial',
  INSUFFICIENT_DATA: 'insufficient_data',
  PERMISSION_DENIED: 'permission_denied',
  ERROR: 'error'
}

export const ConfidenceLevel = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
}

/**
 * Validates and standardizes a single intelligence domain's payload.
 */
export function createDomainContract(params = {}) {
  const data = params.data || {}
  return {
    status: params.status || DomainStatus.SUCCESS,
    value: params.value ?? null,
    confidence: params.confidence || ConfidenceLevel.LOW,
    source: params.source || 'N/A',
    methodology: params.methodology || 'N/A',
    recordCount: params.recordCount || 0,
    filters: params.filters || {},
    generatedAt: params.generatedAt || new Date().toISOString(),
    actions: params.actions || [],
    error: params.error || null,
    data: data,
    ...data // Allow spreading domain-specific data for backward compatibility
  }
}

/**
 * Validates and standardizes the global intelligence aggregator payload.
 */
export function createGlobalContract(params = {}) {
  return {
    status: params.status || DomainStatus.SUCCESS,
    generatedAt: params.generatedAt || new Date().toISOString(),
    filters: params.filters || {},
    
    kpis: params.kpis || [],
    health: params.health || {},
    risk: params.risk || {},
    financial: params.financial || {},
    maintenance: params.maintenance || {},
    inventory: params.inventory || {},
    exceptions: params.exceptions || [],
    trends: params.trends || [],
    confidence: params.confidence || ConfidenceLevel.LOW,
    dataQuality: params.dataQuality || {},
    
    methodology: params.methodology || 'Aggregated Enterprise Intelligence',
    actions: params.actions || [],
    error: params.error || null
  }
}


