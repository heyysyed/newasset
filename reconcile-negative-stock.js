import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envFile = fs.readFileSync('.env', 'utf8')
const env = {}
envFile.split('\n').forEach(line => {
  const match = line.trim().match(/^VITE_([^=]+)=(.*)$/)
  if (match) {
    env['VITE_' + match[1]] = match[2].trim().replace(/^['"](.*)['"]$/, '$1')
  }
})

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function run() {
  const { data, error } = await supabase.from('inventory_items').select('id, item_code, item_name, current_stock').lt('current_stock', 0)
  
  if (error) {
    console.error('Error fetching inventory:', error)
    return
  }
  
  console.log(`Found ${data.length} items with negative stock.`)
  if (data.length > 0) {
    console.log(data)
  }

  // Auto-reconcile
  if (data.length > 0) {
    console.log('Reconciling to 0...')
    for (const item of data) {
      const { error: updErr } = await supabase.from('inventory_items').update({ current_stock: 0 }).eq('id', item.id)
      if (updErr) console.error(`Error updating ${item.id}:`, updErr)
      else console.log(`Updated ${item.item_code} to 0`)
    }
  }
  
  console.log('Attempting to add constraint...')
  // Now apply the check constraint if possible. But since I can't use raw SQL via JS client without an RPC, I will create an RPC call or execute it in a migration script.
}

run()
