-- ============================================================
-- المرحلة 3️⃣ — SQL اختبار يدوي (نفذه الآن)
-- ============================================================
-- هذا الملف يختبر القيد المحاسبي يدوياً
-- ============================================================

-- ============================================================
-- 1️⃣ أنشئ قيد يدويًا
-- ============================================================

INSERT INTO journal_entries
(description, date, reference_type, reference_id, status)
VALUES
('Expense Test', CURRENT_DATE, 'expense', 1, 'posted')
RETURNING id, entry_number;

-- احفظ id من النتيجة أعلاه واستخدمه في الخطوات التالية
-- مثال: إذا كان id = 1

-- ============================================================
-- 2️⃣ أضف السطور
-- ============================================================

-- مدين: مصروف (افترض account_id = 5)
-- استبدل 1 بـ journal_entry_id من الخطوة السابقة
-- استبدل 5 بـ account_id الفعلي لحساب المصروف
INSERT INTO journal_postings
(journal_entry_id, account_id, debit, credit, description)
VALUES
(1, 5, 100, 0, 'Expense')
RETURNING id;

-- دائن: صندوق (افترض account_id = 1)
-- استبدل 1 بـ journal_entry_id من الخطوة السابقة
-- استبدل 1 بـ account_id الفعلي لحساب الصندوق
INSERT INTO journal_postings
(journal_entry_id, account_id, debit, credit, description)
VALUES
(1, 1, 0, 100, 'Cash')
RETURNING id;

-- ============================================================
-- 3️⃣ تحقق
-- ============================================================

-- عرض القيد المنشأ
SELECT * FROM journal_entries ORDER BY id DESC LIMIT 5;

-- عرض سطور القيد
SELECT 
  jp.id,
  jp.journal_entry_id,
  a.account_code,
  a.name AS account_name,
  jp.debit,
  jp.credit,
  jp.description
FROM journal_postings jp
LEFT JOIN accounts a ON a.id = jp.account_id
WHERE jp.journal_entry_id = 1  -- استبدل بـ journal_entry_id من الخطوة 1
ORDER BY jp.id;

-- التحقق من التوازن (المدين = الدائن)
SELECT 
  journal_entry_id,
  SUM(debit) AS total_debit,
  SUM(credit) AS total_credit,
  SUM(debit) - SUM(credit) AS balance
FROM journal_postings
WHERE journal_entry_id = 1  -- استبدل بـ journal_entry_id من الخطوة 1
GROUP BY journal_entry_id;

-- ============================================================
-- ✔ إذا نجح → القاعدة المحاسبية سليمة
-- ============================================================
