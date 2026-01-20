/**
 * API Contract - مصدر الحقيقة الوحيد
 * 
 * هذا الملف يحدد جميع الـ API endpoints المسموح بها
 * أي استدعاء API يجب أن يكون موجوداً هنا
 * 
 * المبدأ: Backend هو المصدر النهائي للحقيقة
 */

export const API_CONTRACT = {
  REPORTS: {
    BUSINESS_DAY_SALES: {
      method: 'GET',
      path: '/api/reports/business-day-sales',
      requiredParams: ['branch', 'date'],
      paramTypes: {
        branch: 'string', // 'china_town' | 'place_india'
        date: 'string' // 'YYYY-MM-DD'
      },
      responseShape: {
        invoices: 'array',
        items: 'array', // Alias for invoices
        summary: {
          invoices_count: 'number',
          total_sales: 'number',
          total_tax: 'number',
          total_discount: 'number',
          items_count: 'number',
          cash_total: 'number',
          bank_total: 'number'
        }
      }
    },
    TRIAL_BALANCE: {
      method: 'GET',
      path: '/api/reports/trial-balance',
      requiredParams: [],
      paramTypes: {
        from: 'string', // Optional: 'YYYY-MM-DD'
        to: 'string' // Optional: 'YYYY-MM-DD'
      }
    },
    SALES_BY_BRANCH: {
      method: 'GET',
      path: '/api/reports/sales-by-branch',
      requiredParams: [],
      paramTypes: {
        from: 'string',
        to: 'string',
        branch: 'string'
      }
    },
    EXPENSES_BY_BRANCH: {
      method: 'GET',
      path: '/api/reports/expenses-by-branch',
      requiredParams: [],
      paramTypes: {
        from: 'string',
        to: 'string',
        branch: 'string'
      }
    },
    SALES_VS_EXPENSES: {
      method: 'GET',
      path: '/api/reports/sales-vs-expenses',
      requiredParams: [],
      paramTypes: {
        from: 'string',
        to: 'string'
      }
    }
  },
  ACCOUNTS: {
    LIST: {
      method: 'GET',
      path: '/api/accounts',
      requiredParams: []
    },
    GET: {
      method: 'GET',
      path: '/api/accounts/:id',
      requiredParams: ['id']
    }
  },
  JOURNAL: {
    LIST: {
      method: 'GET',
      path: '/api/journal',
      requiredParams: [],
      paramTypes: {
        status: 'string',
        from: 'string',
        to: 'string',
        page: 'number',
        pageSize: 'number'
      }
    },
    GET: {
      method: 'GET',
      path: '/api/journal/:id',
      requiredParams: ['id']
    }
  }
};

/**
 * Helper function to validate API call against contract
 */
export function validateAPICall(endpointKey, params = {}) {
  const endpoint = getNestedValue(API_CONTRACT, endpointKey);
  
  if (!endpoint) {
    throw new Error(`[API CONTRACT] Unknown endpoint: ${endpointKey}`);
  }
  
  // Check required params
  const missingParams = endpoint.requiredParams.filter(param => !params[param]);
  if (missingParams.length > 0) {
    throw new Error(`[API CONTRACT] Missing required params: ${missingParams.join(', ')}`);
  }
  
  return endpoint;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}
