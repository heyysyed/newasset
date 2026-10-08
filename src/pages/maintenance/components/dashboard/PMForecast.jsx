import React, { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import { scheduleService } from '../../services/scheduleService';
import toast from 'react-hot-toast';

export default function PMForecast({ schedules, isLoading }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);

  const generateTasks = async () => {
    setGenerating(true);
    const target = new Date();
    target.setDate(target.getDate() + 30);
    try {
      const { count, error } = await scheduleService.generateDuePMTasks(target.toISOString().slice(0, 10), user?.id);
      if (error) throw error;
      toast.success(`${Number(count) || 0} preventive-maintenance task(s) generated`);
      navigate('/maintenance/tickets');
    } catch (error) {
      toast.error(error.message || 'Could not generate preventive-maintenance tasks');
    } finally {
      setGenerating(false);
    }
  };
  if (isLoading) {
    return (
      <div className="bg-[var(--bg-0)] border border-[var(--border)] rounded-2xl p-5 md:p-6 shadow-sm">
        <div className="skeleton w-36 h-6 mb-5 rounded"></div>
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          {[1, 2, 3].map(i => <div key={`skel-${i}`} className="skeleton h-24 rounded-xl"></div>)}
        </div>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];
  
  let overdue = 0;
  let today = 0;
  let upcoming = 0;

  (schedules || []).forEach(s => {
    if (!s.next_due_date) return;
    const due = s.next_due_date.split('T')[0];
    if (due < todayStr) overdue++;
    else if (due === todayStr) today++;
    else upcoming++;
  });

  return (
    <div className="bg-[var(--bg-0)] border border-[var(--border)] rounded-2xl p-5 md:p-6 shadow-sm flex flex-col h-full">
      <div className="flex items-center gap-2.5 mb-5">
        <CalendarClock size={20} className="text-[var(--text-1)]" />
        <h3 className="m-0 text-lg font-bold text-[var(--text-0)]">
          PM Forecast
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-3 md:gap-4 flex-1">
        <div className="bg-[var(--bg-1)] p-3 rounded-xl flex flex-col items-center justify-center border-t-4 border-[var(--status-danger)] shadow-sm">
          <div className={`text-2xl md:text-3xl font-bold leading-none ${overdue > 0 ? 'text-[var(--status-danger)]' : 'text-[var(--text-2)]'}`}>{overdue}</div>
          <div className="text-[10px] md:text-xs font-bold text-[var(--text-3)] mt-2 tracking-wider text-center leading-tight">OVERDUE</div>
        </div>
        
        <div className="bg-[var(--bg-1)] p-3 rounded-xl flex flex-col items-center justify-center border-t-4 border-[var(--status-warning)] shadow-sm">
          <div className={`text-2xl md:text-3xl font-bold leading-none ${today > 0 ? 'text-[var(--status-warning)]' : 'text-[var(--text-2)]'}`}>{today}</div>
          <div className="text-[10px] md:text-xs font-bold text-[var(--text-3)] mt-2 tracking-wider text-center leading-tight">DUE TODAY</div>
        </div>

        <div className="bg-[var(--bg-1)] p-3 rounded-xl flex flex-col items-center justify-center border-t-4 border-[var(--accent)] shadow-sm">
          <div className={`text-2xl md:text-3xl font-bold leading-none ${upcoming > 0 ? 'text-[var(--accent)]' : 'text-[var(--text-2)]'}`}>{upcoming}</div>
          <div className="text-[10px] md:text-xs font-bold text-[var(--text-3)] mt-2 tracking-wider text-center leading-tight">UPCOMING <span className="hidden sm:inline">(30D)</span></div>
        </div>
      </div>

      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        <button onClick={() => navigate('/maintenance/preventive')} className="flex-1 btn-primary py-2.5 text-sm rounded-lg font-semibold shadow-sm">
          View Schedule
        </button>
        <button onClick={generateTasks} disabled={generating} className="flex-1 bg-[var(--bg-2)] hover:bg-[var(--bg-3)] text-[var(--text-1)] transition-colors py-2.5 text-sm rounded-lg font-semibold disabled:opacity-60">
          {generating ? 'Generating…' : 'Generate Tasks'}
        </button>
      </div>
    </div>
  );
}


