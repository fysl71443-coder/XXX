/**
 * POS Helper Functions
 * توحيد المنطق المشترك في POS
 */

/**
 * استخراج order_id من مصادر متعددة
 * @param {string|number} orderIdFromURL - order_id من URL query param
 * @param {string} branch - اسم الفرع
 * @param {string|number} table - رقم الطاولة
 * @returns {number|null} order_id أو null
 */
export function extractOrderId(orderIdFromURL, branch, table) {
  // Try orderId from URL first
  if (orderIdFromURL && Number(orderIdFromURL) > 0) {
    return Number(orderIdFromURL);
  }
  
  // Try localStorage
  try {
    const normB = normalizeBranchName(branch);
    const k1 = `pos_order_${branch}_${table}`;
    const k2 = `pos_order_${normB}_${table}`;
    const stored = localStorage.getItem(k1) || localStorage.getItem(k2);
    if (stored && Number(stored) > 0) {
      return Number(stored);
    }
  } catch (e) {
    console.warn('[extractOrderId] localStorage error:', e);
  }
  
  return null;
}

/**
 * Normalize branch name
 * @param {string} branch - اسم الفرع
 * @returns {string} اسم الفرع الموحد
 */
export function normalizeBranchName(branch) {
  const s = String(branch || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (s === 'palace_india' || s === 'palce_india') {
    return 'place_india';
  }
  return s;
}

/**
 * Parse JSONB lines (array أو string)
 * @param {Array|string} lines - lines من order/invoice
 * @returns {Array} array من lines
 */
export function parseOrderLines(lines) {
  if (Array.isArray(lines)) {
    return lines;
  }
  if (typeof lines === 'string') {
    try {
      const parsed = JSON.parse(lines || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[parseOrderLines] JSON parse error:', e);
      return [];
    }
  }
  return [];
}

/**
 * استخراج items من lines
 * @param {Array|string} lines - lines من order/invoice
 * @returns {Array} array من items
 */
export function extractItemsFromLines(lines) {
  const parsed = parseOrderLines(lines);
  return parsed.filter(x => x && x.type === 'item');
}

/**
 * استخراج meta من lines
 * @param {Array|string} lines - lines من order/invoice
 * @returns {Object|null} meta object أو null
 */
export function extractMetaFromLines(lines) {
  const parsed = parseOrderLines(lines);
  return parsed.find(x => x && x.type === 'meta') || null;
}

/**
 * حساب المبالغ (subtotal, discount, tax, total)
 * @param {Array} items - array من items
 * @param {number} discountPct - نسبة الخصم الإجمالي
 * @param {number} taxPct - نسبة الضريبة
 * @returns {Object} { subtotal, discount, tax, total }
 */
export function calculateTotals(items, discountPct = 0, taxPct = 15) {
  const safeItems = Array.isArray(items) ? items : [];
  
  // Subtotal
  const subtotal = safeItems.reduce(
    (s, it) => s + Number(it.qty || it.quantity || 0) * Number(it.price || 0), 
    0
  );
  
  // Discount
  const discBase = subtotal * (Number(discountPct || 0) / 100);
  const rowDisc = safeItems.reduce(
    (s, it) => s + (Number(it.discount || 0) / 100) * (Number(it.qty || it.quantity || 0) * Number(it.price || 0)), 
    0
  );
  const discount = discBase + rowDisc;
  
  // Taxable amount
  const taxable = Math.max(0, subtotal - discount);
  
  // Tax
  const tax = taxable * (Number(taxPct || 0) / 100);
  
  // Total
  const total = taxable + tax;
  
  return { 
    subtotal: Number(subtotal.toFixed(2)), 
    discount: Number(discount.toFixed(2)), 
    tax: Number(tax.toFixed(2)), 
    total: Number(total.toFixed(2))
  };
}

/**
 * Normalize Arabic digits to English
 * @param {string} str - string يحتوي على أرقام عربية
 * @returns {string} string بأرقام إنجليزية
 */
export function normalizeArabicDigits(str) {
  const s = String(str || '');
  const map = { 
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', 
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
  };
  return s.replace(/[٠-٩۰-۹]/g, d => map[d] || d);
}

/**
 * Sanitize percentage input
 * @param {string} raw - raw input
 * @returns {number} percentage (0-100)
 */
export function sanitizePctInput(raw) {
  const s = normalizeArabicDigits(raw);
  const t = s.replace(/[^0-9.]/g, '');
  const parts = t.split('.');
  const head = parts[0] || '0';
  const tail = parts[1] ? parts[1].slice(0, 2) : '';
  const num = Number(`${head}${tail ? '.' + tail : ''}`);
  if (!isFinite(num)) return 0;
  return Math.max(0, Math.min(100, num));
}

/**
 * بناء hash من payload للتحقق من التغييرات
 * @param {Object} payload - payload object
 * @returns {string} hash string
 */
export function buildDraftHash(payload) {
  const itemsArr = Array.isArray(payload?.items) ? payload.items : [];
  const its = itemsArr.map(it => ({ 
    id: it.id || it.product_id, 
    qty: Number(it.quantity || it.qty || 0), 
    price: Number(it.price || 0), 
    discount: Number(it.discount || 0) 
  }));
  const pay = Array.isArray(payload?.payLines) 
    ? payload.payLines.map(l => ({ 
        method: String(l.method || ''), 
        amount: Number(l.amount || 0) 
      })) 
    : [];
  const obj = { 
    items: its, 
    discountPct: Number(payload?.discountPct || 0), 
    taxPct: Number(payload?.taxPct || 0), 
    paymentMethod: String(payload?.paymentMethod || ''), 
    payLines: pay 
  };
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

/**
 * بناء lines array للـ order/invoice
 * @param {Array} items - array من items
 * @param {Object} meta - meta object
 * @returns {Array} lines array
 */
export function buildLinesArray(items, meta = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const lines = [
    ...safeItems.map(it => ({
      type: 'item',
      product_id: it.product_id || it.id,
      name: it.name || '',
      name_en: it.name_en || '',
      qty: Number(it.qty || it.quantity || 0),
      price: Number(it.price || 0),
      discount: Number(it.discount || 0)
    })),
    {
      type: 'meta',
      ...meta
    }
  ];
  return lines;
}

/**
 * التحقق من صحة order_id
 * @param {any} orderId - order_id للتحقق
 * @returns {boolean} true إذا كان صحيح
 */
export function isValidOrderId(orderId) {
  const num = Number(orderId);
  return !isNaN(num) && isFinite(num) && num > 0;
}

/**
 * حفظ order_id في localStorage
 * @param {string} branch - اسم الفرع
 * @param {string|number} table - رقم الطاولة
 * @param {number} orderId - order_id
 */
export function saveOrderIdToStorage(branch, table, orderId) {
  try {
    const normB = normalizeBranchName(branch);
    const k1 = `pos_order_${branch}_${table}`;
    const k2 = `pos_order_${normB}_${table}`;
    localStorage.setItem(k1, String(orderId));
    localStorage.setItem(k2, String(orderId));
  } catch (e) {
    console.warn('[saveOrderIdToStorage] localStorage error:', e);
  }
}

/**
 * حذف order_id من localStorage
 * @param {string} branch - اسم الفرع
 * @param {string|number} table - رقم الطاولة
 */
export function removeOrderIdFromStorage(branch, table) {
  try {
    const normB = normalizeBranchName(branch);
    const k1 = `pos_order_${branch}_${table}`;
    const k2 = `pos_order_${normB}_${table}`;
    localStorage.removeItem(k1);
    localStorage.removeItem(k2);
  } catch (e) {
    console.warn('[removeOrderIdFromStorage] localStorage error:', e);
  }
}

/**
 * Split bilingual name
 * @param {string} label - label يحتوي على اسم ثنائي اللغة
 * @param {string} nameEn - name_en منفصل (اختياري)
 * @returns {Object} { en, ar }
 */
export function splitBilingual(label, nameEn = null) {
  const s = String(label || '');
  if (nameEn && String(nameEn).trim()) {
    return { en: String(nameEn).trim(), ar: s.trim() };
  }
  if (s.includes(' - ')) {
    const [en, ar] = s.split(' - ');
    return { en: en.trim(), ar: ar.trim() };
  }
  if (s.includes(' / ')) {
    const [en, ar] = s.split(' / ');
    return { en: en.trim(), ar: ar.trim() };
  }
  return { en: s.trim(), ar: '' };
}

export default {
  extractOrderId,
  normalizeBranchName,
  parseOrderLines,
  extractItemsFromLines,
  extractMetaFromLines,
  calculateTotals,
  normalizeArabicDigits,
  sanitizePctInput,
  buildDraftHash,
  buildLinesArray,
  isValidOrderId,
  saveOrderIdToStorage,
  removeOrderIdFromStorage,
  splitBilingual
};
