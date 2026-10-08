import { test, expect } from '@playwright/test'
test.beforeEach(async ({page})=>{
  // All backend traffic is controlled fixtures; never mutate the real project.
  await page.route('https://**.supabase.co/**',route=>route.fulfill({status:200,contentType:'application/json',body:'null'}))
})
test('anonymous visitors reach login without runtime exceptions',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('/#/assets')
  await expect(page).toHaveURL(/#\/login/)
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
  expect(errors).toEqual([])
})
test('password recovery is actionable and the login page has no placeholder links',async({page})=>{
  let recoveryRequests=0
  await page.route('**/auth/v1/recover**',route=>{
    recoveryRequests+=1
    return route.fulfill({status:200,contentType:'application/json',body:'{}'})
  })
  await page.goto('/#/login')
  await page.locator('input[type="email"]').fill('user@example.com')
  await page.getByRole('button',{name:'Forgot password?'}).click()
  await expect(page.getByText(/Password reset instructions have been sent/i)).toBeVisible()
  expect(recoveryRequests).toBe(1)
  await expect(page.locator('a[href="#"]')).toHaveCount(0)
})
test('public QR uses the restricted RPC and has no anonymous write controls',async({page})=>{
  const calls=[]
  page.on('request',r=>{if(r.url().includes('supabase.co')) calls.push(r.url())})
  await page.route('**/rest/v1/rpc/get_public_asset',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'10000000-0000-0000-0000-000000000001',asset_code:'EX-001',asset_name:'Excavator',status:'Active'})}))
  await page.goto('/#/scan/10000000-0000-0000-0000-000000000001')
  await expect(page.getByRole('heading',{name:'Excavator'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Record Current Location'})).toHaveCount(0)
  expect(calls.some(url=>url.includes('/rest/v1/assets')||url.includes('/rest/v1/app_settings'))).toBe(false)
})
test('public QR shows a recoverable error for unavailable assets',async({page})=>{
  await page.route('**/rest/v1/rpc/get_public_asset',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'unavailable'})}))
  await page.goto('/#/scan/10000000-0000-0000-0000-000000000001')
  await expect(page.getByRole('heading',{name:'Asset Not Found'})).toBeVisible()
})
test('print sanitization removes active content while preserving printable text',async({page})=>{
  await page.goto('/#/login')
  const result=await page.evaluate(async()=>{
    const {writePrintDocument}=await import('/src/lib/printDocument.js')
    let output=''
    writePrintDocument({opener:{},document:{write:value=>{output=value}}},'<html><body><h1>Asset 1</h1><img src=x onerror="alert(1)"><script>alert(1)</script><iframe srcdoc="x"></iframe></body></html>')
    return output
  })
  expect(result).toContain('Asset 1');expect(result).not.toMatch(/onerror|<script|<iframe/)
})
