import { createClient } from '@supabase/supabase-js'
import { csvReport, validateRecipients } from './lib/report-data.mjs'
function required(name) { if(!process.env[name]) throw new Error(`Configure ${name} in the worker's secure settings.`);return process.env[name] }
if(process.env.REPORT_DELIVERY_ENABLED!=='true') throw new Error('Delivery is disabled. Configure staging and set REPORT_DELIVERY_ENABLED=true only when ready to send.')
const url=new URL(required('SUPABASE_URL'))
if(url.protocol!=='https:') throw new Error('HTTPS is required.')
const sb=createClient(url.href,required('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})
const mailKey=required('RESEND_API_KEY'), from=required('REPORT_FROM_EMAIL')
for(let iteration=0;iteration<20;iteration++) {
 const {data:claim,error}=await sb.rpc('claim_report_delivery')
 if(error) throw new Error('Unable to claim report work. Check database migration and worker access.')
 if(!claim) break
 const {job,schedule}=claim
 let success=false
 try {
  const recipients=validateRecipients(schedule.recipients)
  const columns=schedule.module==='assets'?['asset_code','asset_name','status','site']:['id','title','status','priority','asset_id']
  const table=schedule.module==='assets'?'assets':'maintenance_tickets'
  if(!['assets','maintenance'].includes(schedule.module)) throw new Error('Unsupported report module')
  const rows=[]
  for(let offset=0;;offset+=500) {
   // Service role bypasses RLS. Enforce company + nonarchived scope explicitly.
   let query=sb.from(table).select(schedule.module==='assets'?columns.join(','):columns.join(',')+',assets!inner(company_code,archived_at)')
   query=schedule.module==='assets'?query.eq('company_code',schedule.company_code).is('archived_at',null):query.eq('assets.company_code',schedule.company_code).is('assets.archived_at',null)
   const {data,error:queryError}=await query.order('id').range(offset,offset+499)
   if(queryError) throw new Error('Report data could not be read')
   rows.push(...data)
   if(rows.length>50000) throw new Error('Report exceeds 50,000 rows. Narrow the report before retrying.')
   if(data.length<500) break
  }
  const csv=csvReport(rows,columns)
  if(Buffer.byteLength(csv)>10*1024*1024) throw new Error('Report is larger than the delivery limit')
  const response=await fetch('https://api.resend.com/emails',{
   method:'POST',signal:AbortSignal.timeout(30000),
   headers:{Authorization:`Bearer ${mailKey}`,'Content-Type':'application/json','Idempotency-Key':job.id},
   body:JSON.stringify({from,to:recipients,subject:schedule.name,text:`Your ${schedule.module} report is attached. ${rows.length} records.`,attachments:[{filename:'report.csv',content:Buffer.from(csv).toString('base64')}]})
  })
  if(!response.ok) throw new Error(`Email provider returned HTTP ${response.status}`)
  success=true
 } catch(error) { console.error(`Report ${job.id}: ${error.message}`) }
 const {error:finishError}=await sb.rpc('finish_report_delivery',{p_id:job.id,p_token:job.claim_token,p_success:success})
 if(finishError) throw new Error('Delivery status could not be saved; retry will use the same email idempotency key.')
}
