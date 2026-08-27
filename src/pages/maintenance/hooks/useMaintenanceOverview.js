import { useQuery } from '@tanstack/react-query';
import { overviewService } from '../services/overviewService';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase'; // Need this just to fetch config for SLA

// Note: SLA logic ideally lives in an SLA Engine utility.
// We will mock/calculate SLA here for Phase 2.2 based on standard config.

const DEFAULT_SLA_CONFIG = {
  low: { resolution_hours: 168 }, // 7 days
  medium: { resolution_hours: 72 }, // 3 days
  high: { resolution_hours: 24 }, // 1 day
  critical: { resolution_hours: 4 } // 4 hours
};

export function useMaintenanceOverview() {
  const [slaConfig, setSlaConfig] = useState(DEFAULT_SLA_CONFIG);

  useEffect(() => {
    // Fetch real SLA config from Phase 1 table
    async function fetchConfig() {
      try {
        const { data } = await supabase
          .from('maintenance_config')
          .select('config_data')
          .eq('config_key', 'sla_settings')
          .single();
        if (data && data.config_data) {
          setSlaConfig(data.config_data);
        }
      } catch (err) {
        console.error("Failed to load SLA config, using defaults", err);
      }
    }
    fetchConfig();
  }, []);

  const kpiQuery = useQuery({
    queryKey: ['maintenance', 'overview', 'kpis'],
    queryFn: () => overviewService.getKPIs(),
    staleTime: 60000 // 1 minute
  });

  const slaRecordsQuery = useQuery({
    queryKey: ['maintenance', 'overview', 'sla_records'],
    queryFn: () => overviewService.getActiveSLARecords(),
    staleTime: 30000 // 30 seconds
  });

  const activeWorkOrdersQuery = useQuery({
    queryKey: ['maintenance', 'overview', 'active_wos'],
    queryFn: () => overviewService.getActiveWorkOrders(),
    staleTime: 60000
  });

  const pmForecastQuery = useQuery({
    queryKey: ['maintenance', 'overview', 'pm_forecast'],
    queryFn: () => overviewService.getPMForecast(),
    staleTime: 300000 // 5 minutes
  });

  const costQuery = useQuery({
    queryKey: ['maintenance', 'overview', 'costs'],
    queryFn: () => overviewService.getCostSnapshot(),
    staleTime: 300000 // 5 minutes
  });

  // Calculate SLA status dynamically for the UI
  const calculateSLAStatus = (record) => {
    if (!record.created_at || !record.priority) return { status: 'UNKNOWN', remainingMs: 0 };
    
    const priority = record.priority.toLowerCase();
    const config = slaConfig[priority] || DEFAULT_SLA_CONFIG[priority] || DEFAULT_SLA_CONFIG.medium;
    
    const created = new Date(record.created_at).getTime();
    const deadline = created + (config.resolution_hours * 60 * 60 * 1000);
    const now = Date.now();
    
    const remainingMs = deadline - now;
    
    if (remainingMs < 0) return { status: 'BREACHED', remainingMs };
    if (remainingMs < (4 * 60 * 60 * 1000)) return { status: 'AT_RISK', remainingMs }; // At risk if < 4 hours
    return { status: 'WITHIN_SLA', remainingMs };
  };

  // Process SLA Records for the Attention Queue
  let attentionQueue = [];
  let slaBreachedCount = 0;
  let slaAtRiskCount = 0;

  if (slaRecordsQuery.data) {
    const allRecords = [
      ...slaRecordsQuery.data.tickets.map(t => ({ ...t, type: 'TICKET' })),
      ...slaRecordsQuery.data.workOrders.map(wo => ({ ...wo, type: 'WORK_ORDER' }))
    ];

    attentionQueue = allRecords.map(record => {
      const { status, remainingMs } = calculateSLAStatus(record);
      if (status === 'BREACHED') slaBreachedCount++;
      if (status === 'AT_RISK') slaAtRiskCount++;
      return { ...record, slaStatus: status, remainingMs };
    }).filter(record => 
      record.slaStatus === 'BREACHED' || 
      record.slaStatus === 'AT_RISK' || 
      record.priority === 'CRITICAL' ||
      record.status === 'awaiting_approval'
    ).sort((a, b) => a.remainingMs - b.remainingMs);
  }

  const isLoading = kpiQuery.isLoading || slaRecordsQuery.isLoading;
  const isError = kpiQuery.isError || slaRecordsQuery.isError;
  const refetchAll = () => {
    kpiQuery.refetch();
    slaRecordsQuery.refetch();
    activeWorkOrdersQuery.refetch();
    pmForecastQuery.refetch();
    costQuery.refetch();
  };

  return {
    kpis: kpiQuery.data,
    slaBreachedCount,
    slaAtRiskCount,
    attentionQueue,
    activeWorkOrders: activeWorkOrdersQuery.data,
    pmForecast: pmForecastQuery.data,
    costs: costQuery.data,
    isLoading,
    isError,
    refetchAll
  };
}


