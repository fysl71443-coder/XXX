#!/usr/bin/env node
/**
 * اختبار API القيود مع postings
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'http://localhost:4000/api';

async function test() {
  try {
    // Login
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'fysl71443@gmail.com',
      password: 'StrongPass123'
    });
    const token = loginRes.data.token;
    const headers = { Authorization: `Bearer ${token}` };
    
    console.log('🔍 اختبار GET /api/journal...\n');
    
    // Get journal entries
    const journalRes = await axios.get(`${API_BASE}/journal`, { headers });
    const entries = journalRes.data.items || [];
    
    console.log(`✅ تم جلب ${entries.length} قيد\n`);
    
    if (entries.length > 0) {
      const entry = entries[0];
      console.log(`📋 القيد الأول:`);
      console.log(`   - ID: ${entry.id}`);
      console.log(`   - رقم القيد: ${entry.entry_number || '—'}`);
      console.log(`   - الوصف: ${entry.description}`);
      console.log(`   - المدين: ${entry.total_debit}`);
      console.log(`   - الدائن: ${entry.total_credit}`);
      console.log(`   - عدد السطور: ${entry.postings?.length || 0}\n`);
      
      if (entry.postings && entry.postings.length > 0) {
        console.log(`   📊 السطور:`);
        entry.postings.forEach((p, idx) => {
          console.log(`      ${idx + 1}. ${p.account?.account_code || p.account_id} - ${p.account?.name || 'غير معروف'}`);
          console.log(`         مدين: ${p.debit}, دائن: ${p.credit}`);
        });
      } else {
        console.log(`   ⚠️ لا توجد سطور!`);
      }
      
      // Test single entry
      console.log(`\n🔍 اختبار GET /api/journal/${entry.id}...\n`);
      const singleRes = await axios.get(`${API_BASE}/journal/${entry.id}`, { headers });
      const singleEntry = singleRes.data;
      
      console.log(`✅ تم جلب القيد`);
      console.log(`   - عدد السطور: ${singleEntry.postings?.length || 0}`);
      if (singleEntry.postings && singleEntry.postings.length > 0) {
        const firstPosting = singleEntry.postings[0];
        console.log(`   - أول سطر:`);
        console.log(`     Account: ${JSON.stringify(firstPosting.account)}`);
        console.log(`     Account Code: ${firstPosting.account?.account_code || firstPosting.account_code || 'N/A'}`);
        console.log(`     Account Name: ${firstPosting.account?.name || firstPosting.account_name || 'N/A'}`);
        console.log(`     مدين: ${firstPosting.debit}, دائن: ${firstPosting.credit}`);
      }
    }
    
  } catch (error) {
    console.error('❌ خطأ:', error.response?.data || error.message);
  }
}

test();
