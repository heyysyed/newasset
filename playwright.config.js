import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir:'tests/browser', fullyParallel:true,
  use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure'},
  projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['Pixel 7']}}],
  webServer:{command:'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',url:'http://127.0.0.1:4173',reuseExistingServer:false,
    env:{VITE_SUPABASE_URL:'https://test-project.supabase.co',VITE_SUPABASE_ANON_KEY:'test-public-key'}},
})
