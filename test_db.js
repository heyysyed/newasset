
const { createClient } = require('@supabase/supabase-js');
// we can read supabase config from src/lib/supabase.js
const fs = require('fs');
const content = fs.readFileSync('src/lib/supabase.js', 'utf8');
const urlMatch = content.match(/SUPABASE_URL = '(.*?)'/);
const keyMatch = content.match(/SUPABASE_ANON_KEY = '(.*?)'/);
if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1]);
  supabase.from('assets').select('site').limit(20).then(res => {
    console.log(res.data);
  });
} else {
  console.log('Cannot find credentials');
}

