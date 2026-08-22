import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function run() {
  const { data: asset } = await supabase.from('assets').select('id').limit(1).single()
  if (!asset) {
    console.log("No assets found");
    return;
  }
  
  console.log("Attempting to delete asset ID:", asset.id);
  const { data, error } = await supabase.from('assets').delete().eq('id', asset.id).select()
  console.log("Error:", error);
  console.log("Data:", data);
}

run()
