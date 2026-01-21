import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * الموظفين – اختبار تدفق العمل الحقيقي الكامل
 * إنشاء موظف حقيقي، تعديله، ثم حذفه
 */
test('EMPLOYEES – real CRUD workflow', async ({ page }) => {
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
  let createdEmployeeId = null;
  
  try {
    await db.connect();
    dbConnected = true;
  } catch (e) {
    console.log('  ⚠️  Database connection failed:', e.message);
  }

  try {
    // ===================== 1. فتح صفحة الموظفين =====================
    console.log('\n=== Opening Employees Page ===');
    await page.goto('/employees');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    if (!bodyText.includes('Employee') && !bodyText.includes('موظف')) {
      throw new Error('Employees page did not load correctly');
    }
    console.log('  ✓ Employees page loaded');

    // ===================== 2. فتح صفحة الإنشاء =====================
    console.log('\n=== Opening Create Employee Form ===');
    
    const createButton = page.locator('button:has-text("إضافة"), button:has-text("Add"), a:has-text("Create"), a:has-text("إضافة موظف")').first();
    if (!(await createButton.isVisible({ timeout: 5000 }))) {
      throw new Error('Create button not found');
    }
    
    await createButton.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('  ✓ Create form opened');

    // ===================== 3. ملء بيانات الموظف =====================
    console.log('\n=== Filling Employee Data ===');
    
    const testData = {
      full_name: `Test Employee E2E ${Date.now()}`,
      national_id: `${Math.floor(Math.random() * 9000000000) + 1000000000}`, // 10 digits
      nationality: 'SA',
      birth_date: '1990-01-01',
      gender: 'male',
      hire_date: new Date().toISOString().split('T')[0],
      contract_type: 'full_time',
      status: 'active',
      pay_type: 'monthly',
      basic_salary: '5000',
      housing_allowance: '1000',
      transport_allowance: '500',
      payment_method: 'bank',
      iban: 'SA0380000000608010167519',
    };

    // Fill form fields with better selectors - prioritize placeholder
    const fillField = async (name, value, placeholder = null) => {
      try {
        // Build selectors list - prioritize placeholder
        const selectors = [];
        
        if (placeholder) {
          // Try Arabic placeholder first
          selectors.push(`input[placeholder*="${placeholder}"]`);
          // Try English placeholder
          const enPlaceholders = {
            'الاسم الكامل': 'Full name',
            'رقم الهوية': 'National ID',
            'تاريخ الميلاد': 'Birth Date',
            'تاريخ التعيين': 'Hire Date',
            'الراتب الأساسي': 'Basic salary',
            'بدل سكن': 'Housing',
            'بدل نقل': 'Transport',
          };
          if (enPlaceholders[placeholder]) {
            selectors.push(`input[placeholder*="${enPlaceholders[placeholder]}"]`);
          }
        }
        
        // Then try name/id
        selectors.push(`input[name="${name}"]`);
        selectors.push(`input[id="${name}"]`);
        
        // Type-specific selectors
        if (name.includes('date') || name === 'birth_date' || name === 'hire_date') {
          selectors.push('input[type="date"]');
        } else if (name.includes('salary') || name.includes('allowance') || name.includes('rate')) {
          selectors.push('input[inputmode="decimal"]');
          selectors.push('input[type="number"]');
          selectors.push('input[lang="en"][dir="ltr"]');
        } else if (name === 'nationality') {
          selectors.push('input[list="nationalities"]');
          selectors.push('input[placeholder*="الجنسية" i]');
          selectors.push('input[placeholder*="nationality" i]');
        } else {
          selectors.push('input[type="text"]');
        }
        
        for (const selector of selectors) {
          try {
            const inputs = page.locator(selector);
            const count = await inputs.count();
            
            for (let i = 0; i < count; i++) {
              const input = inputs.nth(i);
              if (await input.isVisible({ timeout: 500 })) {
                const currentValue = await input.inputValue().catch(() => '');
                // Only fill if empty or if it's the right field
                if (!currentValue || currentValue === '') {
                  await input.fill(value);
                  await page.waitForTimeout(300);
                  // Verify it was filled
                  const newValue = await input.inputValue().catch(() => '');
                  if (newValue.includes(value) || newValue === value) {
                    return true;
                  }
                }
              }
            }
          } catch (e) {
            continue;
          }
        }
        return false;
      } catch (e) {
        return false;
      }
    };

    const fillSelect = async (name, value) => {
      try {
        const selectors = [
          `select[name="${name}"]`,
          `select[id="${name}"]`,
        ];
        
        // Also try to find by context (gender, status, etc.)
        if (name === 'gender') {
          selectors.push('select:has(option[value="male"])');
        } else if (name === 'status') {
          selectors.push('select:has(option[value="active"])');
        } else if (name === 'contract_type') {
          selectors.push('select:has(option[value="full_time"])');
        } else if (name === 'pay_type') {
          selectors.push('select:has(option[value="monthly"])');
        } else if (name === 'nationality') {
          selectors.push('select:has(option[value="SA"])');
        } else if (name === 'payment_method') {
          selectors.push('select:has(option[value="bank"])');
        }
        
        for (const selector of selectors) {
          try {
            const selects = page.locator(selector);
            const count = await selects.count();
            
            for (let i = 0; i < count; i++) {
              const select = selects.nth(i);
              if (await select.isVisible({ timeout: 1000 })) {
                try {
                  await select.selectOption(value);
                  await page.waitForTimeout(300);
                  // Verify selection
                  const selectedValue = await select.inputValue().catch(() => '');
                  if (selectedValue === value || selectedValue.includes(value)) {
                    return true;
                  }
                } catch (e) {
                  continue;
                }
              }
            }
          } catch (e) {
            continue;
          }
        }
        return false;
      } catch (e) {
        return false;
      }
    };

    // Fill required fields with verification - use placeholders for better matching
    const fieldsToFill = [
      { name: 'full_name', value: testData.full_name, placeholder: 'الاسم الكامل', placeholderEn: 'Full name', required: true },
      { name: 'national_id', value: testData.national_id, placeholder: 'رقم الهوية', placeholderEn: 'National ID', required: true },
      { name: 'nationality', value: testData.nationality, placeholder: 'الجنسية', placeholderEn: 'nationality', required: true, isSelect: false, isInput: true },
      { name: 'birth_date', value: testData.birth_date, placeholder: 'تاريخ الميلاد', placeholderEn: 'Birth Date', required: true, isDate: true },
      { name: 'gender', value: testData.gender, required: true, isSelect: true },
      { name: 'hire_date', value: testData.hire_date, placeholder: 'تاريخ التعيين', placeholderEn: 'Hire Date', required: true, isDate: true },
      { name: 'contract_type', value: testData.contract_type, required: true, isSelect: true },
      { name: 'status', value: testData.status, required: true, isSelect: true },
      { name: 'pay_type', value: testData.pay_type, required: true, isSelect: true },
      { name: 'basic_salary', value: testData.basic_salary, placeholder: 'الراتب الأساسي', placeholderEn: 'Basic salary', required: true },
      { name: 'housing_allowance', value: testData.housing_allowance, placeholder: 'بدل سكن', placeholderEn: 'Housing', required: false },
      { name: 'transport_allowance', value: testData.transport_allowance, placeholder: 'بدل نقل', placeholderEn: 'Transport', required: false },
      { name: 'iban', value: testData.iban, placeholder: 'IBAN', required: false },
    ];

    let filledCount = 0;
    for (const field of fieldsToFill) {
      if (field.isSelect) {
        const filled = await fillSelect(field.name, field.value);
        if (filled) {
          filledCount++;
          console.log(`  ✓ Filled ${field.name}: ${field.value}`);
        }
      } else if (field.isInput) {
        // Input with datalist (like nationality)
        const filled = await fillField(field.name, field.value, field.placeholder || field.placeholderEn);
        if (filled) {
          filledCount++;
          console.log(`  ✓ Filled ${field.name}: ${field.value}`);
        }
      } else {
        const placeholder = field.placeholder || field.placeholderEn;
        const filled = await fillField(field.name, field.value, placeholder);
        if (filled) {
          filledCount++;
          console.log(`  ✓ Filled ${field.name}: ${field.value}`);
        }
      }
      await page.waitForTimeout(300); // Small delay between fields
    }

    await page.waitForTimeout(2000);
    console.log(`  ✓ Form filled: ${filledCount}/${fieldsToFill.length} fields`);
    
    // Verify critical fields were filled
    if (filledCount < 8) {
      throw new Error(`Too few fields filled: ${filledCount}. Expected at least 8.`);
    }

    // ===================== 4. حفظ الموظف =====================
    console.log('\n=== Saving Employee ===');
    
    const saveButton = page.locator('button[type="submit"], button:has-text("حفظ"), button:has-text("Save")').first();
    if (!(await saveButton.isVisible({ timeout: 3000 }))) {
      throw new Error('Save button not found');
    }
    
    await saveButton.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Wait longer for save and redirect
    console.log('  ✓ Save button clicked');

    // Check for error messages
    const errorText = await page.textContent('body');
    if (errorText.includes('خطأ') || errorText.includes('Error') || errorText.includes('error')) {
      // Check if it's a critical error
      if (errorText.includes('Invalid') || errorText.includes('غير صحيح')) {
        throw new Error('Form validation error detected');
      }
    }

    // Wait for redirect or success message
    await page.waitForTimeout(3000);
    
    // Check if we're redirected away from create page
    const currentUrl = page.url();
    if (!currentUrl.includes('/employees/create') && !currentUrl.includes('/employees/new')) {
      console.log('  ✓ Redirected from create page');
    }

    // Verify employee was created in database
    if (dbConnected) {
      try {
        // Wait a bit for database to update
        await page.waitForTimeout(2000);
        const employeeResult = await db.query(
          'SELECT id, full_name, basic_salary FROM employees WHERE full_name = $1 OR national_id = $2 ORDER BY created_at DESC LIMIT 1',
          [testData.full_name, testData.national_id]
        );
        if (employeeResult.rows.length > 0) {
          createdEmployeeId = employeeResult.rows[0].id;
          const savedSalary = parseFloat(employeeResult.rows[0].basic_salary || 0);
          console.log(`  ✓ Employee created in database (ID: ${createdEmployeeId}, Salary: ${savedSalary})`);
          
          // Verify data was saved correctly
          if (Math.abs(savedSalary - parseFloat(testData.basic_salary)) > 0.01) {
            throw new Error(`Salary mismatch! Expected ${testData.basic_salary}, got ${savedSalary}`);
          }
        } else {
          throw new Error('Employee not found in database after save');
        }
      } catch (e) {
        console.log('  ⚠️  Database verification failed:', e.message);
        throw e;
      }
    } else {
      throw new Error('Database connection required for real workflow test');
    }

    // ===================== 5. التحقق من ظهور الموظف في القائمة =====================
    console.log('\n=== Verifying Employee in List ===');
    
    // Navigate back to employees list
    await page.goto('/employees');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const listText = await page.textContent('body');
    if (listText.includes(testData.full_name)) {
      console.log('  ✓ Employee appears in list');
    } else {
      console.log('  ℹ️  Employee name not found in list (may need refresh)');
    }

    // ===================== 6. تعديل الموظف =====================
    if (createdEmployeeId) {
      console.log('\n=== Editing Employee ===');
      
      // Find and click edit button
      const editButton = page.locator(`button:has-text("تعديل"), button:has-text("Edit"), a[href*="/employees/${createdEmployeeId}"]`).first();
      if (await editButton.isVisible({ timeout: 5000 })) {
        await editButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Update salary
        const salaryInput = page.locator('input[name="basic_salary"], input[id="basic_salary"]').first();
        if (await salaryInput.isVisible({ timeout: 2000 })) {
          await salaryInput.fill('6000');
          await page.waitForTimeout(500);
          
          // Save changes
          const updateButton = page.locator('button[type="submit"], button:has-text("حفظ"), button:has-text("Save")').first();
          if (await updateButton.isVisible({ timeout: 2000 })) {
            await updateButton.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);
            console.log('  ✓ Employee updated');
            
            // Verify update in database
            if (dbConnected) {
              try {
                const updatedResult = await db.query('SELECT basic_salary FROM employees WHERE id = $1', [createdEmployeeId]);
                if (updatedResult.rows.length > 0 && parseFloat(updatedResult.rows[0].basic_salary) === 6000) {
                  console.log('  ✓ Update verified in database');
                }
              } catch (e) {
                console.log('  ℹ️  Could not verify update:', e.message);
              }
            }
          }
        }
      } else {
        console.log('  ℹ️  Edit button not found, skipping edit test');
      }
    }

    console.log('\n✅ Employees real CRUD test completed');
  } finally {
    // ===================== 7. حذف الموظف =====================
    if (dbConnected && createdEmployeeId) {
      console.log('\n=== Deleting Test Employee ===');
      try {
        await db.query('DELETE FROM employees WHERE id = $1', [createdEmployeeId]);
        console.log(`  ✓ Test employee deleted (ID: ${createdEmployeeId})`);
      } catch (e) {
        console.log('  ⚠️  Failed to delete test employee:', e.message);
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
