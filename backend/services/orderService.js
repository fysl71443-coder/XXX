/**
 * Order Service - Business logic for orders
 */

/**
 * Helper function to calculate totals from order lines
 * @param {Array} lines - Order lines array
 * @returns {Object} Totals object
 */
export function calculateOrderTotals(lines) {
  const itemsOnly = Array.isArray(lines) ? lines.filter(it => it && it.type === 'item') : [];
  const meta = Array.isArray(lines) ? lines.find(it => it && it.type === 'meta') : null;
  
  // Calculate subtotal and discount from items
  let subtotal = 0;
  let discount_amount = 0;
  
  for (const item of itemsOnly) {
    const qty = Number(item.quantity || item.qty || 0);
    const price = Number(item.price || 0);
    const discount = Number(item.discount || 0);
    subtotal += qty * price;
    discount_amount += discount;
  }
  
  // Apply global discount if provided in meta
  const discountPct = meta ? Number(meta.discountPct || meta.discount_pct || 0) : 0;
  if (discountPct > 0) {
    const globalDiscount = subtotal * (discountPct / 100);
    discount_amount += globalDiscount;
  }
  
  // Calculate tax and total
  const taxPct = meta ? Number(meta.taxPct || meta.tax_pct || 15) : 15;
  const tax_amount = ((subtotal - discount_amount) * taxPct) / 100;
  const total_amount = subtotal - discount_amount + tax_amount;
  
  // Extract customer info from meta or first item
  const customer_name = meta ? (meta.customer_name || meta.customerName || '') : (lines[0]?.customer_name || '');
  const customer_phone = meta ? (meta.customer_phone || meta.customerPhone || '') : (lines[0]?.customer_phone || '');
  const customerId = meta ? (meta.customerId || meta.customer_id || null) : (lines[0]?.customerId || null);
  
  return {
    subtotal,
    discount_amount,
    tax_amount,
    total_amount,
    customer_name,
    customer_phone,
    customerId
  };
}
