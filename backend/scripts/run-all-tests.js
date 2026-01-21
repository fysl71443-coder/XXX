#!/usr/bin/env node
/**
 * سكريبت موحد لتشغيل جميع الاختبارات محلياً
 * 
 * الاستخدام:
 *   node scripts/run-all-tests.js
 *   node scripts/run-all-tests.js --skip-api  # تخطي اختبارات API
 *   node scripts/run-all-tests.js --only comprehensive  # تشغيل اختبار واحد فقط
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const skipApi = args.includes('--skip-api');
const onlyTest = args.find(arg => arg.startsWith('--only='))?.split('=')[1];

// Test configurations
const tests = [
  {
    name: 'comprehensive_system_test',
    file: 'comprehensive_system_test.cjs',
    description: 'اختبار شامل للنظام (قاعدة البيانات + API)',
    requiresApi: true,
    type: 'cjs'
  },
  {
    name: 'fix_old_expenses',
    file: 'fix_old_expenses.js',
    description: 'إصلاح المصروفات القديمة بدون journal entries',
    requiresApi: false,
    type: 'esm'
  },
  {
    name: 'test-pos-flow',
    file: 'test-pos-flow.js',
    description: 'اختبار تدفق POS (حفظ مسودة وإصدار فاتورة)',
    requiresApi: true,
    type: 'esm'
  }
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runTest(test) {
  return new Promise((resolve, reject) => {
    const testPath = join(__dirname, test.file);
    
    if (!existsSync(testPath)) {
      log(`❌ ملف الاختبار غير موجود: ${test.file}`, 'red');
      resolve({ name: test.name, success: false, error: 'File not found' });
      return;
    }
    
    log(`\n${'='.repeat(60)}`, 'cyan');
    log(`🧪 تشغيل: ${test.description}`, 'bright');
    log(`${'='.repeat(60)}`, 'cyan');
    
    const startTime = Date.now();
    
    // Determine command based on file type
    let command, args;
    if (test.type === 'cjs') {
      command = 'node';
      args = [testPath];
    } else {
      command = 'node';
      args = [testPath];
    }
    
    const proc = spawn(command, args, {
      cwd: join(__dirname, '..'),
      stdio: 'inherit',
      shell: true
    });
    
    proc.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      if (code === 0) {
        log(`✅ ${test.name}: نجح (${duration}s)`, 'green');
        resolve({ name: test.name, success: true, duration });
      } else {
        log(`❌ ${test.name}: فشل (exit code: ${code}, ${duration}s)`, 'red');
        resolve({ name: test.name, success: false, exitCode: code, duration });
      }
    });
    
    proc.on('error', (error) => {
      log(`❌ ${test.name}: خطأ في التشغيل - ${error.message}`, 'red');
      reject({ name: test.name, success: false, error: error.message });
    });
  });
}

async function checkServerRunning() {
  try {
    const axios = (await import('axios')).default;
    const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000';
    
    // Try to access a simple endpoint
    await axios.get(`${API_BASE}/api/accounts`, { 
      timeout: 2000,
      validateStatus: () => true // Accept any status code
    });
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  log('\n' + '='.repeat(60), 'bright');
  log('🚀 تشغيل جميع الاختبارات محلياً', 'bright');
  log('='.repeat(60), 'bright');
  
  // Filter tests based on arguments
  let testsToRun = tests;
  
  if (onlyTest) {
    testsToRun = tests.filter(t => t.name === onlyTest);
    if (testsToRun.length === 0) {
      log(`❌ الاختبار "${onlyTest}" غير موجود`, 'red');
      log(`الاختبارات المتاحة: ${tests.map(t => t.name).join(', ')}`, 'yellow');
      process.exit(1);
    }
  }
  
  if (skipApi) {
    testsToRun = testsToRun.filter(t => !t.requiresApi);
    log('⚠️  تم تخطي اختبارات API', 'yellow');
  }
  
  // Check if API server is running for API tests
  const apiTests = testsToRun.filter(t => t.requiresApi);
  if (apiTests.length > 0) {
    log('\n🔍 التحقق من تشغيل الخادم...', 'cyan');
    const serverRunning = await checkServerRunning();
    if (!serverRunning) {
      log('⚠️  الخادم لا يعمل على http://localhost:4000', 'yellow');
      log('   تأكد من تشغيل الخادم قبل تشغيل اختبارات API:', 'yellow');
      log('   npm start  أو  npm run dev', 'yellow');
      log('\nهل تريد المتابعة بدون اختبارات API؟ (y/n)', 'yellow');
      
      // For non-interactive mode, skip API tests
      if (!process.stdin.isTTY) {
        log('   تخطي اختبارات API تلقائياً...', 'yellow');
        testsToRun = testsToRun.filter(t => !t.requiresApi);
      }
    } else {
      log('✅ الخادم يعمل', 'green');
    }
  }
  
  if (testsToRun.length === 0) {
    log('❌ لا توجد اختبارات للتشغيل', 'red');
    process.exit(1);
  }
  
  log(`\n📋 عدد الاختبارات: ${testsToRun.length}`, 'cyan');
  testsToRun.forEach((t, i) => {
    log(`   ${i + 1}. ${t.name}: ${t.description}`, 'cyan');
  });
  
  const results = [];
  
  // Run tests sequentially
  for (const test of testsToRun) {
    try {
      const result = await runTest(test);
      results.push(result);
    } catch (error) {
      results.push({ name: test.name, success: false, error: error.message || error });
    }
  }
  
  // Print summary
  log('\n' + '='.repeat(60), 'bright');
  log('📊 ملخص النتائج', 'bright');
  log('='.repeat(60), 'bright');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;
  
  log(`\nإجمالي الاختبارات: ${total}`, 'cyan');
  log(`✅ نجح: ${passed}`, 'green');
  log(`❌ فشل: ${failed}`, failed > 0 ? 'red' : 'reset');
  
  if (results.length > 0) {
    log('\nالتفاصيل:', 'cyan');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const duration = result.duration ? ` (${result.duration}s)` : '';
      const error = result.error ? ` - ${result.error}` : '';
      const exitCode = result.exitCode ? ` (exit: ${result.exitCode})` : '';
      log(`   ${status} ${result.name}${duration}${error}${exitCode}`, result.success ? 'green' : 'red');
    });
  }
  
  log('\n' + '='.repeat(60), 'bright');
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  log(`\n❌ خطأ عام: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
