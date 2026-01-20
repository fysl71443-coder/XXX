/**
 * فحص شامل وعميق لكل شاشات نظام ERP والمحاسبة
 * التأكد من أن جميع الشاشات تعتمد على القيود المنشورة فقط
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '../frontend/src');
const BACKEND_FILE = path.join(__dirname, '../server.js');

// قائمة جميع الشاشات والوحدات
const SCREENS = {
  accounting: {
    files: ['screens/AccountsScreen.jsx', 'components/TrialBalance.jsx', 'components/GeneralLedger.jsx', 'components/AccountStatement.jsx', 'components/VatReturn.jsx'],
    description: 'المحاسبة - ميزان المراجعة، دفتر الأستاذ، كشف الحساب، إقرار ضريبة القيمة المضافة'
  },
  journal: {
    files: ['pages/Journal.jsx'],
    description: 'القيود اليومية'
  },
  clients: {
    files: ['pages/Clients.jsx', 'pages/ClientsAging.jsx', 'pages/ClientsDue.jsx', 'pages/ClientsInvoicesAll.jsx', 'pages/ClientsInvoicesPaid.jsx', 'components/ClientStatement.jsx'],
    description: 'العملاء - القوائم، أعمار الديون، المستحقات، الفواتير، كشف الحساب'
  },
  suppliers: {
    files: ['pages/Suppliers.jsx', 'pages/SupplierInvoice.jsx'],
    description: 'الموردون - القوائم، فواتير الموردين'
  },
  employees: {
    files: ['pages/Employees.jsx', 'pages/PayrollPayments.jsx', 'pages/PayrollStatements.jsx'],
    description: 'الموظفون - القوائم، سداد الرواتب، كشوف الرواتب'
  },
  expenses: {
    files: ['pages/Expenses.jsx'],
    description: 'المصروفات'
  },
  products: {
    files: ['pages/Products.jsx'],
    description: 'المنتجات'
  },
  pos: {
    files: ['pages/POSInvoice.jsx', 'pages/POSTables.jsx', 'pages/POSManage.jsx'],
    description: 'نقطة البيع - الفواتير، الجداول، الإدارة'
  },
  purchases: {
    files: ['pages/PurchaseOrders.jsx', 'pages/PurchaseOrderDetail.jsx'],
    description: 'المشتريات - طلبات الشراء'
  },
  reports: {
    files: ['pages/Reports.jsx'],
    description: 'التقارير - جميع التقارير المالية والتشغيلية'
  },
  settings: {
    files: ['pages/Settings.jsx'],
    description: 'الإعدادات'
  }
};

// APIs التي يجب أن تستخدم القيود المنشورة فقط
const JOURNAL_DEPENDENT_APIS = [
  'apiJournal.list',
  'apiJournal.byAccount',
  'apiPartners.balance',
  'apiPartners.statement',
  'apiCustomers.aging',
  'apiSuppliers.aging',
  'apiEmployees.advanceBalance',
  'apiReports.trialBalance',
  'apiReports.salesVsExpenses',
  'apiReports.salesByBranch',
  'apiReports.expensesByBranch'
];

// APIs التي قد تستخدم جداول مباشرة (يجب فحصها)
const POTENTIALLY_DIRECT_TABLE_APIS = [
  'apiInvoices.list',
  'apiPayments.list',
  'apiOrders.list',
  'apiExpenses.list',
  'apiSupplierInvoices.list',
  'apiProducts.list',
  'apiPartners.list',
  'apiEmployees.list'
];

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return null;
  }
}

function extractAPICalls(content) {
  const apiCalls = [];
  
  // البحث عن استدعاءات API
  const apiPatterns = [
    /(api\w+)\.(list|get|create|update|remove|balance|statement|aging|advanceBalance|trialBalance|salesVsExpenses|salesByBranch|expensesByBranch)\(/g,
    /await\s+(api\w+)\.(list|get|create|update|remove|balance|statement|aging|advanceBalance|trialBalance|salesVsExpenses|salesByBranch|expensesByBranch)\(/g,
    /(invoices|payments|orders|expenses|supplierInvoices|products|partners|employees|journal|accounts|reports|customers|suppliers)\.(list|get|create|update|remove|balance|statement|aging|advanceBalance|trialBalance|salesVsExpenses|salesByBranch|expensesByBranch)\(/g
  ];
  
  apiPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const apiName = match[1] || match[2];
      const method = match[2] || match[3];
      apiCalls.push({
        api: apiName,
        method: method,
        line: content.substring(0, match.index).split('\n').length
      });
    }
  });
  
  return apiCalls;
}

function extractSQLQueries(content) {
  const queries = [];
  
  // البحث عن استعلامات SQL
  const sqlPatterns = [
    /SELECT\s+.*?\s+FROM\s+(\w+)/gi,
    /pool\.query\(['"`](.*?)['"`]/gs,
    /client\.query\(['"`](.*?)['"`]/gs
  ];
  
  sqlPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      queries.push({
        query: match[0].substring(0, 200),
        table: match[1] || 'unknown',
        line: content.substring(0, match.index).split('\n').length
      });
    }
  });
  
  return queries;
}

function checkStatusFilter(content, apiCall) {
  // التحقق من وجود status='posted' في الاستدعاء
  const lines = content.split('\n');
  const startLine = Math.max(0, apiCall.line - 5);
  const endLine = Math.min(lines.length, apiCall.line + 5);
  const context = lines.slice(startLine, endLine).join('\n');
  
  const hasPostedStatus = /status\s*[:=]\s*['"]posted['"]/i.test(context);
  const hasDraftStatus = /status\s*[:=]\s*['"]draft['"]/i.test(context);
  
  return {
    hasPostedStatus,
    hasDraftStatus,
    context: context.substring(0, 300)
  };
}

function auditScreen(screenName, screenConfig) {
  const results = {
    screen: screenName,
    description: screenConfig.description,
    files: [],
    apiCalls: [],
    sqlQueries: [],
    issues: [],
    recommendations: []
  };
  
  screenConfig.files.forEach(file => {
    const filePath = path.join(FRONTEND_DIR, file);
    const content = readFile(filePath);
    
    if (!content) {
      results.issues.push({
        type: 'file_not_found',
        file: file,
        severity: 'warning'
      });
      return;
    }
    
    const apiCalls = extractAPICalls(content);
    const sqlQueries = extractSQLQueries(content);
    
    results.files.push({
      file: file,
      apiCalls: apiCalls.length,
      sqlQueries: sqlQueries.length
    });
    
    // فحص كل استدعاء API
    apiCalls.forEach(call => {
      const fullCall = `${call.api}.${call.method}`;
      const statusCheck = checkStatusFilter(content, call);
      
      results.apiCalls.push({
        ...call,
        fullCall,
        statusCheck
      });
      
      // التحقق من استخدام القيود المنشورة
      if (JOURNAL_DEPENDENT_APIS.includes(fullCall)) {
        if (!statusCheck.hasPostedStatus && !statusCheck.hasDraftStatus) {
          results.issues.push({
            type: 'missing_status_filter',
            api: fullCall,
            file: file,
            line: call.line,
            severity: 'high',
            message: `استدعاء ${fullCall} لا يحدد status='posted' صراحة`
          });
        }
      }
      
      // التحقق من APIs التي قد تستخدم جداول مباشرة
      if (POTENTIALLY_DIRECT_TABLE_APIS.includes(fullCall)) {
        if (fullCall.includes('apiInvoices.list') || fullCall.includes('apiPayments.list')) {
          results.issues.push({
            type: 'direct_table_access',
            api: fullCall,
            file: file,
            line: call.line,
            severity: 'medium',
            message: `استدعاء ${fullCall} قد يعتمد على جداول مباشرة بدلاً من القيود المنشورة`
          });
        }
      }
    });
    
    // فحص استعلامات SQL
    sqlQueries.forEach(query => {
      if (query.table && !['journal_entries', 'journal_postings', 'accounts'].includes(query.table.toLowerCase())) {
        results.issues.push({
          type: 'direct_sql_table',
          table: query.table,
          file: file,
          line: query.line,
          severity: 'high',
          message: `استعلام SQL مباشر على جدول ${query.table} - يجب استخدام القيود المنشورة بدلاً من ذلك`
        });
      }
    });
  });
  
  return results;
}

function auditBackendEndpoints() {
  const content = readFile(BACKEND_FILE);
  if (!content) return [];
  
  const endpoints = [];
  const endpointPattern = /app\.(get|post|put|delete)\s*\(['"`]([^'"`]+)['"`]/g;
  
  let match;
  while ((match = endpointPattern.exec(content)) !== null) {
    const method = match[1];
    const path = match[2];
    
    // استخراج السياق حول الـ endpoint
    const startIndex = Math.max(0, match.index - 500);
    const endIndex = Math.min(content.length, match.index + 2000);
    const context = content.substring(startIndex, endIndex);
    
    // التحقق من استخدام je.status = 'posted'
    const usesPostedStatus = /je\.status\s*=\s*['"]posted['"]/i.test(context);
    const usesJournalEntries = /journal_entries/i.test(context);
    const usesDirectTables = /FROM\s+(invoices|payments|orders|expenses|supplier_invoices)\s+/i.test(context);
    
    endpoints.push({
      method: method.toUpperCase(),
      path,
      usesPostedStatus,
      usesJournalEntries,
      usesDirectTables,
      needsReview: usesDirectTables && !usesJournalEntries
    });
  }
  
  return endpoints;
}

function generateReport() {
  console.log('='.repeat(100));
  console.log('🔍 بدء الفحص الشامل لجميع شاشات النظام');
  console.log('='.repeat(100));
  
  const auditResults = {};
  const backendEndpoints = auditBackendEndpoints();
  
  // فحص كل شاشة
  Object.keys(SCREENS).forEach(screenName => {
    console.log(`\n📋 فحص شاشة: ${screenName}...`);
    auditResults[screenName] = auditScreen(screenName, SCREENS[screenName]);
  });
  
  // تجميع النتائج
  const summary = {
    totalScreens: Object.keys(SCREENS).length,
    totalIssues: 0,
    highSeverityIssues: 0,
    mediumSeverityIssues: 0,
    warnings: 0,
    screens: auditResults,
    backendEndpoints: backendEndpoints.filter(e => e.needsReview)
  };
  
  Object.values(auditResults).forEach(result => {
    summary.totalIssues += result.issues.length;
    result.issues.forEach(issue => {
      if (issue.severity === 'high') summary.highSeverityIssues++;
      else if (issue.severity === 'medium') summary.mediumSeverityIssues++;
      else summary.warnings++;
    });
  });
  
  // طباعة التقرير
  console.log('\n' + '='.repeat(100));
  console.log('📊 ملخص النتائج:');
  console.log('='.repeat(100));
  console.log(`إجمالي الشاشات المفحوصة: ${summary.totalScreens}`);
  console.log(`إجمالي المشاكل: ${summary.totalIssues}`);
  console.log(`  - عالية الخطورة: ${summary.highSeverityIssues}`);
  console.log(`  - متوسطة الخطورة: ${summary.mediumSeverityIssues}`);
  console.log(`  - تحذيرات: ${summary.warnings}`);
  console.log(`Endpoints تحتاج مراجعة: ${summary.backendEndpoints.length}`);
  
  // تفاصيل المشاكل
  console.log('\n' + '='.repeat(100));
  console.log('🚨 المشاكل المكتشفة:');
  console.log('='.repeat(100));
  
  Object.keys(auditResults).forEach(screenName => {
    const result = auditResults[screenName];
    if (result.issues.length > 0) {
      console.log(`\n📱 ${screenName} (${result.description}):`);
      result.issues.forEach(issue => {
        console.log(`  ${issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '⚪'} [${issue.severity.toUpperCase()}] ${issue.message}`);
        console.log(`     الملف: ${issue.file}, السطر: ${issue.line}`);
      });
    }
  });
  
  // Backend endpoints تحتاج مراجعة
  if (summary.backendEndpoints.length > 0) {
    console.log('\n' + '='.repeat(100));
    console.log('🔧 Backend Endpoints تحتاج مراجعة:');
    console.log('='.repeat(100));
    summary.backendEndpoints.forEach(endpoint => {
      console.log(`  ${endpoint.method} ${endpoint.path}`);
      console.log(`    - يستخدم جداول مباشرة: ${endpoint.usesDirectTables}`);
      console.log(`    - يستخدم journal_entries: ${endpoint.usesJournalEntries}`);
      console.log(`    - يستخدم status='posted': ${endpoint.usesPostedStatus}`);
    });
  }
  
  // حفظ التقرير في ملف
  const reportPath = path.join(__dirname, '../COMPREHENSIVE_SYSTEM_AUDIT_REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`\n✅ تم حفظ التقرير الكامل في: ${reportPath}`);
  
  return summary;
}

// تشغيل الفحص
const summary = generateReport();

// إنشاء تقرير Markdown شامل
const markdownReport = generateMarkdownReport(summary);
const markdownPath = path.join(__dirname, '../COMPREHENSIVE_SYSTEM_AUDIT_REPORT.md');
fs.writeFileSync(markdownPath, markdownReport, 'utf8');
console.log(`✅ تم حفظ التقرير Markdown في: ${markdownPath}`);

function generateMarkdownReport(summary) {
  let md = '# تقرير الفحص الشامل للنظام\n\n';
  md += `**تاريخ الفحص:** ${new Date().toISOString()}\n\n`;
  md += `## 📊 الملخص التنفيذي\n\n`;
  md += `- **إجمالي الشاشات المفحوصة:** ${summary.totalScreens}\n`;
  md += `- **إجمالي المشاكل:** ${summary.totalIssues}\n`;
  md += `  - 🔴 عالية الخطورة: ${summary.highSeverityIssues}\n`;
  md += `  - 🟡 متوسطة الخطورة: ${summary.mediumSeverityIssues}\n`;
  md += `  - ⚪ تحذيرات: ${summary.warnings}\n`;
  md += `- **Backend Endpoints تحتاج مراجعة:** ${summary.backendEndpoints.length}\n\n`;
  
  md += `## 📱 تفاصيل الشاشات\n\n`;
  
  Object.keys(summary.screens).forEach(screenName => {
    const result = summary.screens[screenName];
    md += `### ${screenName} - ${result.description}\n\n`;
    md += `**الملفات:** ${result.files.length}\n`;
    md += `**استدعاءات API:** ${result.apiCalls.length}\n`;
    md += `**استعلامات SQL:** ${result.sqlQueries.length}\n`;
    md += `**المشاكل:** ${result.issues.length}\n\n`;
    
    if (result.issues.length > 0) {
      md += `#### المشاكل:\n\n`;
      result.issues.forEach(issue => {
        md += `- **${issue.severity === 'high' ? '🔴 عالية' : issue.severity === 'medium' ? '🟡 متوسطة' : '⚪ تحذير'}:** ${issue.message}\n`;
        md += `  - الملف: \`${issue.file}\`, السطر: ${issue.line}\n`;
      });
      md += '\n';
    }
    
    md += `#### استدعاءات API:\n\n`;
    const uniqueAPIs = [...new Set(result.apiCalls.map(c => c.fullCall))];
    uniqueAPIs.forEach(api => {
      md += `- \`${api}\`\n`;
    });
    md += '\n';
  });
  
  md += `## 🔧 Backend Endpoints تحتاج مراجعة\n\n`;
  if (summary.backendEndpoints.length > 0) {
    summary.backendEndpoints.forEach(endpoint => {
      md += `### ${endpoint.method} ${endpoint.path}\n\n`;
      md += `- يستخدم جداول مباشرة: ${endpoint.usesDirectTables ? '✅' : '❌'}\n`;
      md += `- يستخدم journal_entries: ${endpoint.usesJournalEntries ? '✅' : '❌'}\n`;
      md += `- يستخدم status='posted': ${endpoint.usesPostedStatus ? '✅' : '❌'}\n\n`;
    });
  } else {
    md += `✅ لا توجد endpoints تحتاج مراجعة\n\n`;
  }
  
  md += `## ✅ التوصيات\n\n`;
  md += `1. **تأكد من أن جميع استدعاءات API تمرر \`status='posted'\` صراحة**\n`;
  md += `2. **استبدال جميع الاستعلامات المباشرة على جداول invoices/payments/orders باستعلامات على journal_entries**\n`;
  md += `3. **تحديث جميع الشاشات التي تستخدم \`apiInvoices.list\` أو \`apiPayments.list\` لاستخدام \`apiPartners.statement\` أو \`apiJournal.list\` بدلاً من ذلك**\n`;
  md += `4. **إضافة فلترة \`status='posted'\` بشكل افتراضي في جميع endpoints**\n`;
  
  return md;
}

console.log('\n✅ اكتمل الفحص الشامل!');
