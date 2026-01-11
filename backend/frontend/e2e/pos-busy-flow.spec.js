import { test, expect } from '@playwright/test'

test('POS Regression: add items → table BUSY → re-open shows items', async ({ page, request }) => {
  const API = 'http://localhost:4000/api'
  const res = await request.post(`${API}/auth/login`, { data: { email: 'admin@example.com', password: 'Admin123!' } })
  const json = await res.json()
  const token = json?.token || ''
  await page.addInitScript((t)=>{ try { localStorage.setItem('token', t) } catch {} }, token)
  await page.goto('/pos/china_town/tables')

  // افتح الطاولة رقم 5
  await page.goto('/pos/china_town/tables/5')

  // أضف صنف p1 (إذا لم يظهر الزر، افتح قسم "عام")
  await page.evaluate(() => { try { typeof window.__POS_TEST_ADD__==='function' && window.__POS_TEST_ADD__('p1') } catch {} })
  await page.waitForFunction(() => { try { return !!localStorage.getItem('pos_order_china_town_5') } catch { return false } }, null, { timeout: 10000 })

  // تحقق من ظهور صف واحد على الأقل في الإيصال
  await expect(page.locator('[data-testid="invoice-row"]')).toHaveCount(1, { timeout: 10000 })

  // ارجع للطاولات
  await page.click('[data-testid="back-to-tables"]')

  // تأكد أن الطاولة مشغولة
  await page.waitForSelector('.grid')
  const table5 = page.locator('button:has-text("5")').first()
  await expect(table5).toContainText(/مشغولة|مسودة/i)

  const oid = await page.evaluate(() => { try { return localStorage.getItem('pos_order_china_town_5') || null } catch { return null } })
  if (oid) { await page.goto(`/pos/china_town/tables/5?order=${oid}`) }

  // تحقق الحاسم: الأصناف تظهر (صف واحد على الأقل)
  await expect(page.locator('[data-testid="invoice-row"]')).toHaveCount(1)

  // تحقق من عدد الصفوف
  const rows = page.locator('[data-testid="invoice-row"]')
  await expect(rows).toHaveCount(1)
})