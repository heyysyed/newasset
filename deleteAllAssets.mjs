import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envStr = fs.readFileSync('.env', 'utf-8')
const env = {}
envStr.split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && v.length) env[k.trim()] = v.join('=').trim()
})

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function deleteAll() {
  console.log('Fetching all assets...')
  
  // We need to fetch all because we might have hundreds and there's a limit
  // Let's loop until no more
  let deletedCount = 0;
  
  while (true) {
    const { data, error } = await supabase.from('assets').select('id').limit(1000)
    if (error) {
      console.error('Error fetching:', error)
      break
    }
    if (!data || data.length === 0) {
      console.log('No more assets found.')
      break
    }
    
    console.log(`Found ${data.length} assets to delete in this batch...`)
    
    // We can use `.in` to delete in chunks
    const ids = data.map(d => d.id)
    const chunkSize = 200
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize)
      const { error: delErr } = await supabase.from('assets').delete().in('id', chunk)
      if (delErr) {
        console.error('Error deleting chunk:', delErr)
      } else {
        deletedCount += chunk.length
        console.log(`Deleted ${deletedCount} assets so far...`)
      }
    }
  }
  
  console.log(`Finished deleting. Total deleted: ${deletedCount}`)
}

deleteAll()
