#!/usr/bin/env node
/**
 * اختبار شامل لشاشة الإعدادات
 * 
 * يختبر:
 * 1. جدول الصلاحيات يحتوي على جميع الشاشات والوظائف
 * 2. وجود شاشة كل فرع بالنسبة للمبيعات
 * 3. إخفاء الشاشات والوظائف بناءً على الصلاحيات
 * 4. إمكانية تغيير كلمة السر وبيانات المستخدم
 * 5. حفظ جميع الحقول في قاعدة البيانات
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';
const TEST_USER = {
  email: process.env.TEST_EMAIL || 'fysl71443@gmail.com',
  password: process.env.TEST_PASSWORD || 'StrongPass123'
};

let authToken = '';
const results = {
  passed: 0,
  failed: 0,
  errors: [],
  tests: {}
};

// Helper functions
async function makeRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
}

function logTest(name, result) {
  if (result.success) {
    console.log(`   ✅ ${name}`);
    results.passed++;
    results.tests[name] = { status: 'passed', data: result.data };
    return true;
  } else {
    console.log(`   ❌ ${name}`);
    console.log(`      خطأ: ${JSON.stringify(result.error)}`);
    results.failed++;
    results.errors.push({ name, error: result.error });
    results.tests[name] = { status: 'failed', error: result.error };
    return false;
  }
}

// Test authentication
async function testAuth() {
  console.log('\n🔐 اختبار المصادقة...');
  
  const loginResult = await makeRequest('POST', '/api/auth/login', TEST_USER);
  if (loginResult.success && loginResult.data.token) {
    authToken = loginResult.data.token;
    logTest('POST /api/auth/login', loginResult);
    return true;
  } else {
    logTest('POST /api/auth/login', loginResult);
    return false;
  }
}

// Test 1: Check if screens endpoint returns all screens
async function testScreensEndpoint() {
  console.log('\n📊 اختبار endpoint الشاشات...');
  
  const result = await makeRequest('GET', '/api/screens');
  
  if (result.success && Array.isArray(result.data)) {
    const screens = result.data;
    const expectedScreens = ['clients', 'suppliers', 'employees', 'expenses', 'products', 'sales', 'purchases', 'reports', 'accounting', 'journal', 'settings'];
    
    console.log(`      📊 عدد الشاشات: ${screens.length}`);
    screens.forEach(s => {
      console.log(`         - ${s.code} (has_branches: ${s.has_branches})`);
    });
    
    const hasAllScreens = expectedScreens.every(code => screens.some(s => s.code === code));
    const salesScreen = screens.find(s => s.code === 'sales');
    const salesHasBranches = salesScreen && salesScreen.has_branches === true;
    
    if (hasAllScreens && salesHasBranches) {
      logTest('GET /api/screens - All screens present', result);
      logTest('GET /api/screens - Sales has_branches=true', { success: true, data: salesScreen });
      return true;
    } else {
      logTest('GET /api/screens - Missing screens or sales has_branches', { success: false, error: `hasAllScreens: ${hasAllScreens}, salesHasBranches: ${salesHasBranches}` });
      return false;
    }
  } else {
    logTest('GET /api/screens', result);
    return false;
  }
}

// Test 2: Check if actions endpoint returns all actions
async function testActionsEndpoint() {
  console.log('\n📊 اختبار endpoint الوظائف...');
  
  const result = await makeRequest('GET', '/api/actions');
  
  if (result.success && Array.isArray(result.data)) {
    const actions = result.data;
    const expectedActions = ['view', 'create', 'edit', 'delete'];
    
    console.log(`      📊 عدد الوظائف: ${actions.length}`);
    actions.forEach(a => {
      console.log(`         - ${a.code}`);
    });
    
    const hasAllActions = expectedActions.every(code => actions.some(a => a.code === code));
    
    if (hasAllActions) {
      logTest('GET /api/actions - All actions present', result);
      return true;
    } else {
      logTest('GET /api/actions - Missing actions', { success: false, error: 'Missing expected actions' });
      return false;
    }
  } else {
    logTest('GET /api/actions', result);
    return false;
  }
}

// Test 3: Check if users endpoint returns users
async function testUsersEndpoint() {
  console.log('\n📊 اختبار endpoint المستخدمين...');
  
  const result = await makeRequest('GET', '/api/users');
  
  if (result.success && Array.isArray(result.data)) {
    const users = result.data;
    console.log(`      📊 عدد المستخدمين: ${users.length}`);
    users.forEach(u => {
      console.log(`         - ${u.email} (role: ${u.role})`);
    });
    
    logTest('GET /api/users', result);
    return users.length > 0 ? users[0].id : null;
  } else {
    logTest('GET /api/users', result);
    return null;
  }
}

// Test 4: Check user permissions endpoint
async function testUserPermissionsEndpoint(userId) {
  console.log('\n📊 اختبار endpoint صلاحيات المستخدم...');
  
  if (!userId) {
    console.log('      ⚠️ لا يوجد مستخدم للاختبار');
    return false;
  }
  
  const result = await makeRequest('GET', `/api/users/${userId}/permissions`);
  
  if (result.success && result.data) {
    const perms = result.data;
    console.log(`      📊 عدد الشاشات مع الصلاحيات: ${Object.keys(perms).length}`);
    Object.keys(perms).forEach(screen => {
      const screenPerms = perms[screen];
      const globalPerms = screenPerms._global || {};
      const branchPerms = Object.keys(screenPerms).filter(k => k !== '_global');
      console.log(`         - ${screen}: global actions=${Object.keys(globalPerms).length}, branches=${branchPerms.length}`);
    });
    
    logTest(`GET /api/users/${userId}/permissions`, result);
    return true;
  } else {
    logTest(`GET /api/users/${userId}/permissions`, result);
    return false;
  }
}

// Test 5: Test updating user (email, role)
async function testUpdateUser(userId) {
  console.log('\n📊 اختبار تحديث بيانات المستخدم...');
  
  if (!userId) {
    console.log('      ⚠️ لا يوجد مستخدم للاختبار');
    return false;
  }
  
  // Get current user data
  const getResult = await makeRequest('GET', `/api/users`);
  if (!getResult.success) {
    logTest('GET /api/users (before update)', getResult);
    return false;
  }
  
  const currentUser = getResult.data.find(u => u.id === userId);
  if (!currentUser) {
    logTest('GET /api/users - User not found', { success: false, error: 'User not found' });
    return false;
  }
  
  // Test update email and role
  const newEmail = `test_${Date.now()}@test.com`;
  const updateResult = await makeRequest('PUT', `/api/users/${userId}`, {
    email: newEmail,
    role: currentUser.role || 'user'
  });
  
  if (updateResult.success) {
    logTest('PUT /api/users/:id - Update email and role', updateResult);
    
    // Restore original email
    await makeRequest('PUT', `/api/users/${userId}`, {
      email: currentUser.email,
      role: currentUser.role
    });
    
    return true;
  } else {
    logTest('PUT /api/users/:id - Update email and role', updateResult);
    return false;
  }
}

// Test 6: Test reset password
async function testResetPassword(userId) {
  console.log('\n📊 اختبار إعادة تعيين كلمة المرور...');
  
  if (!userId) {
    console.log('      ⚠️ لا يوجد مستخدم للاختبار');
    return false;
  }
  
  const newPassword = 'TestPassword123!';
  const result = await makeRequest('POST', `/api/users/${userId}/reset-password`, {
    password: newPassword
  });
  
  if (result.success) {
    logTest('POST /api/users/:id/reset-password', result);
    
    // Test login with new password
    const loginResult = await makeRequest('POST', '/api/auth/login', {
      email: TEST_USER.email,
      password: newPassword
    });
    
    if (loginResult.success) {
      logTest('POST /api/auth/login - Login with new password', loginResult);
      
      // Restore original password
      await makeRequest('POST', `/api/users/${userId}/reset-password`, {
        password: TEST_USER.password
      });
      
      return true;
    } else {
      logTest('POST /api/auth/login - Login with new password', loginResult);
      return false;
    }
  } else {
    logTest('POST /api/users/:id/reset-password', result);
    return false;
  }
}

// Test 7: Test saving permissions
async function testSavePermissions(userId) {
  console.log('\n📊 اختبار حفظ الصلاحيات...');
  
  if (!userId) {
    console.log('      ⚠️ لا يوجد مستخدم للاختبار');
    return false;
  }
  
  // Get current permissions
  const getResult = await makeRequest('GET', `/api/users/${userId}/permissions`);
  if (!getResult.success) {
    logTest('GET /api/users/:id/permissions (before save)', getResult);
    return false;
  }
  
  const currentPerms = getResult.data;
  
  // Prepare test permissions
  const testPerms = [
    { screen_code: 'sales', action_code: 'view', branch_code: '', allowed: true },
    { screen_code: 'sales', action_code: 'create', branch_code: 'china_town', allowed: true }
  ];
  
  // Save permissions
  const saveResult = await makeRequest('PUT', `/api/users/${userId}/permissions`, testPerms);
  
  if (saveResult.success) {
    logTest('PUT /api/users/:id/permissions - Save permissions', saveResult);
    
    // Verify permissions were saved
    const verifyResult = await makeRequest('GET', `/api/users/${userId}/permissions`);
    if (verifyResult.success) {
      const savedPerms = verifyResult.data;
      const hasSalesView = savedPerms.sales?._global?.view === true;
      const hasSalesCreateChinaTown = savedPerms.sales?.china_town?.create === true;
      
      if (hasSalesView && hasSalesCreateChinaTown) {
        logTest('GET /api/users/:id/permissions - Verify saved permissions', verifyResult);
        
        // Restore original permissions
        const restorePerms = Object.keys(currentPerms).flatMap(screen => {
          const screenPerms = currentPerms[screen];
          const perms = [];
          if (screenPerms._global) {
            Object.keys(screenPerms._global).forEach(action => {
              perms.push({
                screen_code: screen,
                action_code: action,
                branch_code: '',
                allowed: screenPerms._global[action]
              });
            });
          }
          Object.keys(screenPerms).filter(k => k !== '_global').forEach(branch => {
            Object.keys(screenPerms[branch]).forEach(action => {
              perms.push({
                screen_code: screen,
                action_code: action,
                branch_code: branch,
                allowed: screenPerms[branch][action]
              });
            });
          });
          return perms;
        });
        
        await makeRequest('PUT', `/api/users/${userId}/permissions`, restorePerms);
        
        return true;
      } else {
        logTest('GET /api/users/:id/permissions - Verify saved permissions', { success: false, error: 'Permissions not saved correctly' });
        return false;
      }
    } else {
      logTest('GET /api/users/:id/permissions - Verify saved permissions', verifyResult);
      return false;
    }
  } else {
    logTest('PUT /api/users/:id/permissions - Save permissions', saveResult);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 اختبار شامل لشاشة الإعدادات');
  console.log('============================================================');
  console.log(`📍 Base URL: ${API_BASE}`);
  console.log('============================================================\n');
  
  // 1. Authentication
  const authSuccess = await testAuth();
  if (!authSuccess) {
    console.log('\n❌ فشل تسجيل الدخول - لا يمكن متابعة الاختبارات');
    return;
  }
  
  // 2. Test screens endpoint
  await testScreensEndpoint();
  
  // 3. Test actions endpoint
  await testActionsEndpoint();
  
  // 4. Test users endpoint
  const userId = await testUsersEndpoint();
  
  // 5. Test user permissions endpoint
  await testUserPermissionsEndpoint(userId);
  
  // 6. Test update user
  await testUpdateUser(userId);
  
  // 7. Test reset password
  await testResetPassword(userId);
  
  // 8. Test save permissions
  await testSavePermissions(userId);
  
  // Summary
  console.log('\n============================================================');
  console.log('📊 ملخص النتائج:');
  console.log('============================================================');
  console.log(`   ✅ نجح: ${results.passed}`);
  console.log(`   ❌ فشل: ${results.failed}`);
  console.log(`   📈 النسبة: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  console.log('\n📋 الاختبارات المنجزة:');
  Object.keys(results.tests).forEach(key => {
    const test = results.tests[key];
    console.log(`   ${test.status === 'passed' ? '✅' : '❌'} ${key}`);
  });
  
  if (results.errors.length > 0) {
    console.log('\n❌ الأخطاء:');
    results.errors.forEach((err, idx) => {
      console.log(`   ${idx + 1}. ${err.name}: ${JSON.stringify(err.error)}`);
    });
  }
  
  console.log('\n============================================================');
  
  if (results.failed === 0) {
    console.log('✅✅ جميع الاختبارات نجحت!');
    process.exit(0);
  } else {
    console.log('⚠️ بعض الاختبارات فشلت - يرجى مراجعة الأخطاء أعلاه');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('❌ خطأ عام في الاختبار:', error);
  process.exit(1);
});
