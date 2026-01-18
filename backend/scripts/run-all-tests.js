#!/usr/bin/env node
/**
 * تشغيل جميع الاختبارات بالترتيب
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const scriptsDir = join(__dirname);

async function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 تشغيل: ${scriptName}`);
    console.log('='.repeat(60));
    
    const proc = spawn('node', [join(scriptsDir, scriptName)], {
      stdio: 'inherit',
      shell: true,
      cwd: join(__dirname, '..')
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${scriptName} - نجح`);
        resolve();
      } else {
        console.log(`\n❌ ${scriptName} - فشل (exit code: ${code})`);
        reject(new Error(`Script ${scriptName} failed with code ${code}`));
      }
    });
    
    proc.on('error', (err) => {
      console.error(`\n❌ خطأ في تشغيل ${scriptName}:`, err);
      reject(err);
    });
  });
}

async function runAllTests() {
  console.log('🧪 بدء الاختبارات الشاملة للنظام');
  console.log('============================================================\n');
  
  const tests = [
    'comprehensive-test.js',
    'frontend-test.js',
    'check-integrity.js'
  ];
  
  const results = {
    passed: 0,
    failed: 0,
    errors: []
  };
  
  for (const test of tests) {
    try {
      await runScript(test);
      results.passed++;
    } catch (error) {
      results.failed++;
      results.errors.push({ test, error: error.message });
    }
  }
  
  // Final Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 الملخص النهائي:');
  console.log('='.repeat(60));
  console.log(`   ✅ نجح: ${results.passed}/${tests.length}`);
  console.log(`   ❌ فشل: ${results.failed}/${tests.length}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ الأخطاء:');
    results.errors.forEach((err, idx) => {
      console.log(`   ${idx + 1}. ${err.test}: ${err.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (results.failed === 0) {
    console.log('✅✅ جميع الاختبارات نجحت!');
    process.exit(0);
  } else {
    console.log('⚠️ بعض الاختبارات فشلت');
    process.exit(1);
  }
}

runAllTests().catch(error => {
  console.error('❌ خطأ عام:', error);
  process.exit(1);
});
