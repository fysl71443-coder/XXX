# API Contract - مصدر الحقيقة الوحيد

## 🎯 المبدأ الأساسي
**Backend هو المصدر النهائي للحقيقة** - جميع الـ endpoints والـ responses تُحدد هنا.

---

## 📋 REPORTS API

### GET /api/reports/business-day-sales

**Method:** `GET`  
**Path:** `/api/reports/business-day-sales`  
**Authentication:** Required (Bearer Token)  
**Authorization:** `reports.view` permission

**Query Parameters:**
- `branch` (string, required): Branch code (`china_town` | `place_india`)
- `date` (string, required): Business day date in format `YYYY-MM-DD`

**Response:**
```json
{
  "invoices": [
    {
      "journal_entry_id": 123,
      "date": "2026-01-19T10:30:00Z",
      "entry_number": 456,
      "description": "Invoice #123",
      "reference_type": "invoice",
      "reference_id": 789,
      "revenue_amount": 1000.00,
      "amount": 1000.00,
      "tax_amount": 150.00,
      "discount_amount": 0.00,
      "cash_amount": 1000.00,
      "bank_amount": 0.00
    }
  ],
  "items": [...], // Alias for invoices
  "summary": {
    "invoices_count": 10,
    "total_sales": 10000.00,
    "total_tax": 1500.00,
    "total_discount": 100.00,
    "items_count": 50,
    "cash_total": 8000.00,
    "bank_total": 2000.00
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing `branch` or `date` parameter
- `400 Bad Request`: Invalid branch code
- `500 Internal Server Error`: Server error

---

### GET /api/reports/trial-balance

**Method:** `GET`  
**Path:** `/api/reports/trial-balance`  
**Authentication:** Required (Bearer Token)  
**Authorization:** `reports.view` permission

**Query Parameters:**
- `from` (string, optional): Start date in format `YYYY-MM-DD` (default: `1970-01-01`)
- `to` (string, optional): End date in format `YYYY-MM-DD` (default: `9999-12-31`)

**Response:**
```json
{
  "items": [
    {
      "account_id": 1,
      "account_number": "1111",
      "account_code": "1111",
      "account_name": "الصندوق",
      "opening_balance": 0.00,
      "beginning": 0.00,
      "debit": 1000.00,
      "credit": 500.00,
      "ending": 500.00
    }
  ],
  "totals": {
    "debit": 10000.00,
    "credit": 10000.00,
    "beginning": 0.00,
    "ending": 0.00
  },
  "balanced": true
}
```

---

### GET /api/reports/sales-by-branch

**Method:** `GET`  
**Path:** `/api/reports/sales-by-branch`  
**Authentication:** Required (Bearer Token)  
**Authorization:** `reports.view` permission

**Query Parameters:**
- `from` (string, optional): Start date
- `to` (string, optional): End date
- `branch` (string, optional): Filter by branch

**Response:**
```json
{
  "items": [
    {
      "branch": "China Town",
      "invoice_count": 50,
      "gross_total": 50000.00,
      "net_total": 43500.00,
      "tax_total": 6500.00,
      "discount_total": 0.00
    }
  ],
  "totals": {
    "invoice_count": 100,
    "gross_total": 100000.00,
    "net_total": 87000.00,
    "tax_total": 13000.00,
    "discount_total": 0.00
  }
}
```

---

### GET /api/reports/expenses-by-branch

**Method:** `GET`  
**Path:** `/api/reports/expenses-by-branch`  
**Authentication:** Required (Bearer Token)  
**Authorization:** `reports.view` permission

**Query Parameters:**
- `from` (string, optional): Start date
- `to` (string, optional): End date
- `branch` (string, optional): Filter by branch

**Response:**
```json
{
  "items": [
    {
      "branch": "China Town",
      "expense_count": 20,
      "total_expenses": 10000.00
    }
  ],
  "totals": {
    "expense_count": 40,
    "total_expenses": 20000.00
  }
}
```

---

### GET /api/reports/sales-vs-expenses

**Method:** `GET`  
**Path:** `/api/reports/sales-vs-expenses`  
**Authentication:** Required (Bearer Token)  
**Authorization:** `reports.view` permission

**Query Parameters:**
- `from` (string, optional): Start date
- `to` (string, optional): End date

**Response:**
```json
{
  "items": [
    {
      "date": "2026-01-19",
      "sales": 5000.00,
      "expenses": 2000.00,
      "net": 3000.00
    }
  ],
  "totals": {
    "total_sales": 50000.00,
    "total_expenses": 20000.00,
    "net_profit": 30000.00
  }
}
```

---

## 📋 ACCOUNTS API

### GET /api/accounts

**Method:** `GET`  
**Path:** `/api/accounts`  
**Authentication:** Required (Bearer Token)  
**Authorization:** `accounting.view` permission

**Response:**
```json
[
  {
    "id": 1,
    "account_number": "1111",
    "account_code": "1111",
    "name": "الصندوق",
    "name_en": "Cash",
    "type": "asset",
    "nature": "debit",
    "parent_id": null,
    "opening_balance": 0.00,
    "current_balance": 5000.00,
    "children": [...]
  }
]
```

---

## 📋 JOURNAL API

### GET /api/journal

**Method:** `GET`  
**Path:** `/api/journal`  
**Authentication:** Required (Bearer Token)  
**Authorization:** `journal.view` permission

**Query Parameters:**
- `status` (string, optional): Filter by status (`posted` | `draft`)
- `from` (string, optional): Start date
- `to` (string, optional): End date
- `page` (number, optional): Page number (default: 1)
- `pageSize` (number, optional): Items per page (default: 20)

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "entry_number": 123,
      "date": "2026-01-19T10:30:00Z",
      "description": "Invoice #123",
      "status": "posted",
      "reference_type": "invoice",
      "reference_id": 789,
      "postings": [...]
    }
  ],
  "total": 100
}
```

---

## 🔒 Authentication & Authorization

**All API endpoints require:**
- `Authorization: Bearer <token>` header
- Valid JWT token
- Appropriate permissions based on screen/action

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User lacks required permission

---

## 📝 Notes

1. **Date Format:** All dates use ISO 8601 format (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ssZ`)
2. **Numbers:** All monetary values are in SAR (Saudi Riyal)
3. **Branch Codes:** Use lowercase with underscores (`china_town`, `place_india`)
4. **Status Codes:** Follow REST conventions (200, 400, 401, 403, 500)

---

**Last Updated:** 2026-01-19  
**Version:** 1.0.0
