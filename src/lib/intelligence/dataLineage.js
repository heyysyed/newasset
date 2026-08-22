/**
 * Data Lineage
 * Provides traceability for every major KPI and intelligence result.
 */

export function createLineage(params = {}) {
  return {
    metric: params.metric || 'Unknown Metric',
    value: params.value ?? null,
    sourceTables: params.sourceTables || [],
    sourceFields: params.sourceFields || [],
    recordCount: params.recordCount || 0,
    filters: params.filters || {},
    calculation: params.calculation || 'N/A',
    confidence: params.confidence || 'LOW'
  }
}
