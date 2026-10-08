import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function ScheduledReports() {
  const { user, currentCompany } = useAuth()
  const [schedules,setSchedules]=useState([]), [jobs,setJobs]=useState([])
  const [error,setError]=useState(''), [busy,setBusy]=useState(false), [message,setMessage]=useState('')
  const [draft,setDraft]=useState({name:'',module:'assets',frequency:'weekly',recipients:''})
  async function load() {
    const [scheduleResult,jobResult]=await Promise.all([
      supabase.from('report_delivery_schedules').select('*').eq('company_code',currentCompany.code).order('created_at',{ascending:false}),
      supabase.from('report_delivery_jobs').select('id,schedule_id,status,attempts,finished_at,error_message,scheduled_for').order('scheduled_for',{ascending:false}).limit(50),
    ])
    if(scheduleResult.error || jobResult.error) throw new Error('Report delivery is unavailable. Apply the report migration and configure the delivery worker.')
    setSchedules(scheduleResult.data||[]);setJobs(jobResult.data||[])
  }
  useEffect(()=>{load().catch(err=>setError(err.message))},[currentCompany.code])
  async function save(event) {
    event.preventDefault();setError('');setMessage('');setBusy(true)
    try {
      const recipients=[...new Set(draft.recipients.split(',').map(v=>v.trim()).filter(Boolean))]
      if(!recipients.length || recipients.length>20 || recipients.some(v=>!/^\S+@[^\s@]+\.[^\s@]+$/.test(v))) throw new Error('Enter between 1 and 20 valid email addresses.')
      const {error}=await supabase.from('report_delivery_schedules').insert({name:draft.name.trim(),module:draft.module,frequency:draft.frequency,recipients,company_code:currentCompany.code,created_by:user.id,enabled:false})
      if(error) throw new Error('Schedule could not be saved. Check your company permissions and try again.')
      await load();setDraft({...draft,name:'',recipients:''});setMessage('Schedule saved paused. Enable it after the delivery worker is configured.')
    } catch(err) { setError(err.message) } finally { setBusy(false) }
  }
  async function toggle(schedule) {
    setBusy(true);setError('')
    try {
      const {data,error}=await supabase.from('report_delivery_schedules').update({enabled:!schedule.enabled}).eq('id',schedule.id).select('id')
      if(error || !data?.length) throw new Error('Schedule could not be updated. Check your permissions.')
      await load()
    } catch(err) {setError(err.message)} finally {setBusy(false)}
  }
  return <section className="card" style={{padding:20}}>
    <h2>Scheduled reports</h2>
    <p>CSV reports for your company. Delivery requires the configured server worker and a verified sender. Times are shown in your local timezone.</p>
    <p>Older schedules saved in general settings are not active here; recreate them after reviewing their recipients.</p>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <form onSubmit={save} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
      <label>Report name<input className="inp" required maxLength={120} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
      <label>Module<select className="sel" value={draft.module} onChange={e=>setDraft({...draft,module:e.target.value})}><option value="assets">Assets</option><option value="maintenance">Maintenance</option></select></label>
      <label>Frequency<select className="sel" value={draft.frequency} onChange={e=>setDraft({...draft,frequency:e.target.value})}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
      <label>Recipients (comma separated)<input className="inp" required value={draft.recipients} onChange={e=>setDraft({...draft,recipients:e.target.value})}/></label>
      <button className="btn-primary" disabled={busy}>{busy?'Saving…':'Save paused schedule'}</button>
    </form>
    <button className="btn-ghost" onClick={()=>load().catch(err=>setError(err.message))}>Refresh delivery status</button>
    {!schedules.length && <p>No delivery schedules saved for this company.</p>}
    {schedules.map(schedule=>{
      const latest=jobs.find(job=>job.schedule_id===schedule.id)
      return <article key={schedule.id} style={{padding:12,borderTop:'1px solid var(--border)'}}>
        <h3>{schedule.name}</h3><p>{schedule.frequency} · {schedule.enabled?'Enabled':'Paused'} · {schedule.recipients.join(', ')}</p>
        <p>Next eligible run: {new Date(schedule.next_run_at).toLocaleString()}</p>
        <p>Last delivery: {latest?`${latest.status} (${latest.attempts} attempt(s))`:'Not delivered yet'}</p>
        {latest?.error_message && <p>{latest.error_message}</p>}
        <button className="btn-ghost" disabled={busy} onClick={()=>toggle(schedule)}>{schedule.enabled?'Pause':'Enable'}</button>
      </article>
    })}
  </section>
}
