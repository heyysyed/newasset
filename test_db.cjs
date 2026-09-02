
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://brsrxabeuuicpitjxmrk.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyc3J4YWJldXVpY3BpdGp4bXJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MDEzNDEsImV4cCI6MjA5MDA3NzM0MX0.Xmfknnjdrxt4SsIdjkXndkALXna_YFRzIUWe_5De06A');
supabase.from('assets').select('site').limit(20).then(res => {
  console.log('Assets site values:', [...new Set(res.data.map(r => r.site))]);
});
supabase.from('sites').select('name').limit(10).then(res => {
  console.log('Sites table values:', res.data.map(r => r.name));
});

