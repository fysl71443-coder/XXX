#!/usr/bin/env node
/**
 * فحص سريع للمشاكل
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'http://localhost:4000/api';

async function test() {
  try {
    // 1. Login
    console.log('1. تسجيل الدخول...');
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'fysl71443@gmail.com',
      password: 'StrongPass123'
    });
    const token = loginRes.data.token;
    console.log('   ✅ تم تسجيل الدخول');
    
    const headers = { Authorization: `Bearer ${token}` };
    
    // 2. Test GET /api/accounts
    console.log('\n2. اختبار GET /api/accounts...');
    try {
      const accountsRes = await axios.get(`${API_BASE}/accounts`, { headers });
      console.log(`   ✅ نجح - عدد الحسابات: ${Array.isArray(accountsRes.data) ? accountsRes.data.length : 'غير معروف'}`);
      if (Array.isArray(accountsRes.data) && accountsRes.data.length > 0) {
        console.log(`   📊 أول حساب: ${JSON.stringify(accountsRes.data[0]).substring(0, 100)}...`);
      }
    } catch (e) {
      console.log(`   ❌ فشل: ${e.response?.status} - ${e.response?.data?.error || e.message}`);
    }
    
    // 3. Test POST /api/invoices
    console.log('\n3. اختبار POST /api/invoices...');
    try {
      const invoiceData = {
        number: `TEST-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        subtotal: 100,
        tax_pct: 15,
        tax_amount: 15,
        total: 115,
        status: 'draft',
        branch: 'china_town',
        lines: []
      };
      const invoiceRes = await axios.post(`${API_BASE}/invoices`, invoiceData, { headers });
      console.log(`   ✅ نجح - الفاتورة #${invoiceRes.data.id}`);
    } catch (e) {
      console.log(`   ❌ فشل: ${e.response?.status} - ${JSON.stringify(e.response?.data || e.message)}`);
      if (e.response?.data?.details) {
        console.log(`   التفاصيل: ${e.response.data.details}`);
      }
    }
    
  } catch (error) {
    console.error('❌ خطأ عام:', error.message);
  }
}

test();
