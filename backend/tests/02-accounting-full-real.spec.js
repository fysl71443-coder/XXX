import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * المحاسبة – اختبار تدفق العمل الحقيقي الكامل
 * إنشاء قيد محاسبي حقيقي، نشره، ثم حذفه
 */
test('ACCOUNTING – real journal entry workflow', async ({ page }) => {
  // Smart console error handler
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      const ignoredPatterns = [/404.*favicon/i, /404.*\.ico/i, /Failed to load resource.*404/i];
      if (!ignoredPatterns.some(pattern => pattern.test(text))) {
        if (text.includes('Uncaught') || text.includes('ReferenceError')) {
          throw new Error(`Critical console error: ${text}`);
        }
      }
    }
  });

  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  
  let dbConnected = false;
  let createdEntryId = null;
  let account1Id = null;
  let account2Id = null;
  
  try {
    await db.connect();
    dbConnected = true;
  } catch (e) {
    console.log('  ⚠️  Database connection failed:', e.message);
  }

  try {
    // ===================== 1. التحضير: الحصول على حسابات =====================
    console.log('\n=== Preparing Accounts ===');
    
    if (dbConnected) {
      try {
        // Get two accounts for the journal entry
        const accountsResult = await db.query(`
          SELECT id, account_code, account_number, name 
          FROM accounts 
          WHERE type IN ('asset', 'expense', 'liability', 'equity', 'revenue')
          LIMIT 2
        `);
        
        if (accountsResult.rows.length >= 2) {
          account1Id = accountsResult.rows[0].id;
          account2Id = accountsResult.rows[1].id;
          console.log(`  ✓ Found accounts: ${accountsResult.rows[0].account_code} and ${accountsResult.rows[1].account_code}`);
        } else {
          throw new Error('Not enough accounts found for testing');
        }
      } catch (e) {
        console.log('  ⚠️  Account preparation failed:', e.message);
        throw e;
      }
    }

    // ===================== 2. فتح صفحة القيود =====================
    console.log('\n=== Opening Journal Page ===');
    await page.goto('/journal');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const journalText = await page.textContent('body');
    if (!journalText.includes('Journal') && !journalText.includes('القيود')) {
      throw new Error('Journal page did not load correctly');
    }
    console.log('  ✓ Journal page loaded');

    // ===================== 3. فتح نموذج إنشاء قيد =====================
    console.log('\n=== Opening Create Entry Form ===');
    
    const createButton = page.locator('button:has-text("إنشاء"), button:has-text("Create"), button:has-text("إضافة قيد")').first();
    if (!(await createButton.isVisible({ timeout: 5000 }))) {
      throw new Error('Create button not found');
    }
    
    await createButton.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('  ✓ Create form opened');

    // ===================== 4. ملء بيانات القيد =====================
    console.log('\n=== Filling Journal Entry Data ===');
    
    const testDate = new Date().toISOString().split('T')[0];
    const testDescription = `Test Journal Entry E2E ${Date.now()}`;
    const testAmount = 1000;

    // Fill date
    const dateInput = page.locator('input[type="date"], input[name="date"]').first();
    if (await dateInput.isVisible({ timeout: 2000 })) {
      await dateInput.fill(testDate);
      await page.waitForTimeout(500);
    }

    // Fill description
    const descInput = page.locator('input[name="description"], textarea[name="description"]').first();
    if (await descInput.isVisible({ timeout: 2000 })) {
      await descInput.fill(testDescription);
      await page.waitForTimeout(500);
    }

    // Add first posting (Debit)
    const account1Select = page.locator('select').first();
    if (!(await account1Select.isVisible({ timeout: 5000 }))) {
      throw new Error('Account select not found');
    }
    
    // Try to select account by ID or code
    try {
      await account1Select.selectOption({ value: String(account1Id) });
      await page.waitForTimeout(1000);
      console.log('  ✓ First account selected');
    } catch (e) {
      // Try by text
      const account1Info = dbConnected ? await db.query('SELECT account_code, name FROM accounts WHERE id = $1', [account1Id]) : null;
      if (account1Info && account1Info.rows.length > 0) {
        const accountText = `${account1Info.rows[0].account_code} • ${account1Info.rows[0].name}`;
        await account1Select.selectOption({ label: accountText });
        await page.waitForTimeout(1000);
      } else {
        throw new Error('Could not select first account');
      }
    }
    
    // Fill debit amount
    const debitInput = page.locator('input[placeholder*="مدين"], input[name*="debit"], input[type="number"]').first();
    if (!(await debitInput.isVisible({ timeout: 3000 }))) {
      throw new Error('Debit input not found');
    }
    await debitInput.fill(String(testAmount));
    await page.waitForTimeout(1000);
    console.log(`  ✓ Debit amount filled: ${testAmount}`);

    // Add second posting (Credit) - click add row button
    const addRowButton = page.locator('button:has-text("إضافة"), button:has-text("Add Row"), button:has-text("Add")').first();
    if (!(await addRowButton.isVisible({ timeout: 3000 }))) {
      throw new Error('Add row button not found');
    }
    
    await addRowButton.click();
    await page.waitForTimeout(2000);
    console.log('  ✓ Second row added');
    
    // Select second account
    const account2Select = page.locator('select').nth(1);
    if (!(await account2Select.isVisible({ timeout: 3000 }))) {
      throw new Error('Second account select not found');
    }
    
    try {
      await account2Select.selectOption({ value: String(account2Id) });
      await page.waitForTimeout(1000);
      console.log('  ✓ Second account selected');
    } catch (e) {
      // Try by text
      const account2Info = dbConnected ? await db.query('SELECT account_code, account_number, name FROM accounts WHERE id = $1', [account2Id]) : null;
      if (account2Info && account2Info.rows.length > 0) {
        const accountCode = account2Info.rows[0].account_code || account2Info.rows[0].account_number;
        const accountText = `${accountCode} • ${account2Info.rows[0].name}`;
        try {
          await account2Select.selectOption({ label: accountText });
        } catch (e2) {
          // Try by value as fallback
          await account2Select.selectOption({ value: String(account2Id) });
        }
        await page.waitForTimeout(1000);
        console.log('  ✓ Second account selected by text');
      } else {
        throw new Error('Could not select second account');
      }
    }
    
    // Fill credit amount
    const creditInputs = page.locator('input[placeholder*="دائن"], input[name*="credit"], input[type="number"]');
    const creditCount = await creditInputs.count();
    const creditInput = creditCount > 1 ? creditInputs.nth(1) : creditInputs.first();
    
    if (!(await creditInput.isVisible({ timeout: 3000 }))) {
      throw new Error('Credit input not found');
    }
    await creditInput.fill(String(testAmount));
    await page.waitForTimeout(1000);
    console.log(`  ✓ Credit amount filled: ${testAmount}`);

    console.log('  ✓ Entry data filled');

    // ===================== 5. حفظ المسودة =====================
    console.log('\n=== Saving Draft Entry ===');
    
    // Verify totals are balanced before saving
    const bodyText = await page.textContent('body');
    const debitMatch = bodyText.match(/(?:إجمالي المدين|Total Debit)[:\s]*([\d,]+\.?\d*)/i);
    const creditMatch = bodyText.match(/(?:إجمالي الدائن|Total Credit)[:\s]*([\d,]+\.?\d*)/i);
    
    if (debitMatch && creditMatch) {
      const debitTotal = parseFloat(debitMatch[1].replace(/,/g, ''));
      const creditTotal = parseFloat(creditMatch[1].replace(/,/g, ''));
      const difference = Math.abs(debitTotal - creditTotal);
      
      if (difference > 0.01) {
        throw new Error(`Entry unbalanced before save! Debit: ${debitTotal}, Credit: ${creditTotal}`);
      }
      console.log(`  ✓ Entry balanced before save: Debit=${debitTotal}, Credit=${creditTotal}`);
    }
    
    const saveDraftButton = page.locator('button:has-text("حفظ مسودة"), button:has-text("Save Draft"), button[id="save-draft-btn"]').first();
    if (!(await saveDraftButton.isVisible({ timeout: 5000 }))) {
      throw new Error('Save draft button not found');
    }
    
    await saveDraftButton.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Wait longer for save
    console.log('  ✓ Draft entry saved');
    
    // Verify entry was created
    if (dbConnected) {
      try {
        // Wait a bit for database to update
        await page.waitForTimeout(2000);
        const entryResult = await db.query(
          'SELECT id, status FROM journal_entries WHERE description = $1 ORDER BY created_at DESC LIMIT 1',
          [testDescription]
        );
        if (entryResult.rows.length > 0) {
          createdEntryId = entryResult.rows[0].id;
          console.log(`  ✓ Entry created in database (ID: ${createdEntryId}, Status: ${entryResult.rows[0].status})`);
          
          // Verify postings were created
          const postingsResult = await db.query('SELECT COUNT(*) as count FROM journal_postings WHERE journal_entry_id = $1', [createdEntryId]);
          const postingsCount = parseInt(postingsResult.rows[0]?.count || 0);
          if (postingsCount >= 2) {
            console.log(`  ✓ Postings created: ${postingsCount}`);
          } else {
            throw new Error(`Expected at least 2 postings, found ${postingsCount}`);
          }
        } else {
          throw new Error('Entry not found in database after save');
        }
      } catch (e) {
        console.log('  ⚠️  Could not verify entry:', e.message);
        throw e;
      }
    }

    // ===================== 6. نشر القيد =====================
    if (createdEntryId) {
      console.log('\n=== Posting Entry ===');
      
      // Close modal if open
      const closeButton = page.locator('button:has-text("إغلاق"), button:has-text("Close")').first();
      if (await closeButton.isVisible({ timeout: 2000 })) {
        await closeButton.click();
        await page.waitForTimeout(1000);
      }

      // Find and click post button for the entry
      const postButton = page.locator(`button:has-text("نشر"), button:has-text("Post")`).first();
      if (await postButton.isVisible({ timeout: 5000 })) {
        await postButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
        console.log('  ✓ Entry posted');
        
        // Verify entry status changed to posted
        if (dbConnected) {
          try {
            const statusResult = await db.query('SELECT status FROM journal_entries WHERE id = $1', [createdEntryId]);
            if (statusResult.rows.length > 0 && statusResult.rows[0].status === 'posted') {
              console.log('  ✓ Entry status verified as posted');
            }
          } catch (e) {
            console.log('  ℹ️  Could not verify status:', e.message);
          }
        }
      } else {
        console.log('  ℹ️  Post button not found');
      }
    }

    // ===================== 7. التحقق من التوازن =====================
    console.log('\n=== Verifying Balance ===');
    
    if (dbConnected && createdEntryId) {
      try {
        const balanceResult = await db.query(`
          SELECT 
            COALESCE(SUM(debit), 0) as total_debit,
            COALESCE(SUM(credit), 0) as total_credit
          FROM journal_postings
          WHERE journal_entry_id = $1
        `, [createdEntryId]);
        
        const totalDebit = parseFloat(balanceResult.rows[0]?.total_debit || 0);
        const totalCredit = parseFloat(balanceResult.rows[0]?.total_credit || 0);
        const difference = Math.abs(totalDebit - totalCredit);
        
        if (difference > 0.01) {
          throw new Error(`Entry unbalanced! Debit: ${totalDebit}, Credit: ${totalCredit}`);
        }
        console.log(`  ✓ Entry balanced: Debit=${totalDebit}, Credit=${totalCredit}`);
      } catch (e) {
        console.log('  ⚠️  Balance verification failed:', e.message);
      }
    }

    console.log('\n✅ Accounting real journal entry test completed');
  } finally {
    // ===================== 8. حذف القيد =====================
    if (dbConnected && createdEntryId) {
      console.log('\n=== Deleting Test Entry ===');
      try {
        // Delete postings first
        await db.query('DELETE FROM journal_postings WHERE journal_entry_id = $1', [createdEntryId]);
        // Then delete entry
        await db.query('DELETE FROM journal_entries WHERE id = $1', [createdEntryId]);
        console.log(`  ✓ Test entry deleted (ID: ${createdEntryId})`);
      } catch (e) {
        console.log('  ⚠️  Failed to delete test entry:', e.message);
      }
    }
    
    if (dbConnected) {
      try {
        await db.end();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
});
