import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://brsrxabeuuicpitjxmrk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyc3J4YWJldXVpY3BpdGp4bXJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MDEzNDEsImV4cCI6MjA5MDA3NzM0MX0.Xmfknnjdrxt4SsIdjkXndkALXna_YFRzIUWe_5De06A';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('get_table_schema', { table_name: 'inventory_transactions' });
  if (error) {
    // If no rpc, let's just select 1 row
    const { data: d2 } = await supabase.from('inventory_transactions').select('*').limit(1);
    console.log('Columns:', Object.keys(d2?.[0] || {}));
  } else {
    console.log(data);
  }
}
run();
