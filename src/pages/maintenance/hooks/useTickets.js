import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketService } from '../services/ticketService';
import { useAuth } from '../../../context/AuthContext';

export function useTickets() {
  return useQuery({
    queryKey: ['maintenance_tickets'],
    queryFn: async () => {
      const { data, error } = await ticketService.getTickets();
      if (error) throw new Error(error.message || 'Failed to fetch tickets');
      return data || [];
    }
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await ticketService.create(payload, user?.id);
      if (error) throw new Error(error.message || 'Failed to create ticket');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance_tickets'] });
      // Invalidate overview so KPIs update
      queryClient.invalidateQueries({ queryKey: ['maintenance_kpis'] }); 
      queryClient.invalidateQueries({ queryKey: ['maintenance_sla'] });
    },
    onError: (err) => {
      console.error(err.message);
      alert(err.message);
    }
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, updates, action = 'updated' }) => {
      const { data, error } = await ticketService.update(id, updates, user?.id, action);
      if (error) throw new Error(error.message || 'Failed to update ticket');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance_tickets'] });
      // Invalidate overview so KPIs update
      queryClient.invalidateQueries({ queryKey: ['maintenance_kpis'] }); 
      queryClient.invalidateQueries({ queryKey: ['maintenance_sla'] });
    },
    onError: (err) => {
      console.error(err.message);
      alert(err.message);
    }
  });
}


