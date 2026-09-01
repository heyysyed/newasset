import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase.from('assets').select('site').limit(10)
  console.log('Assets sites:', data)

  const { data: sitesData } = await supabase.from('sites').select('*').limit(10)
  console.log('Sites:', sitesData.map(s => ({ code: s.site_code, name: s.name })))
}
test()
