import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://brsrxabeuuicpitjxmrk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyc3J4YWJldXVpY3BpdGp4bXJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MDEzNDEsImV4cCI6MjA5MDA3NzM0MX0.Xmfknnjdrxt4SsIdjkXndkALXna_YFRzIUWe_5De06A'
)

async function test() {
  try {
    const { data, error } = await supabase.from('profiles').select('*').limit(1)
    if (error) throw error
    console.log('Sample profiles row keys:', data ? Object.keys(data[0] || {}) : 'No data')
  } catch (err) {
    console.error('Error fetching profiles:', err)
  }
}

test()
