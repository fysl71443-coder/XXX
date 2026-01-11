import { useMemo } from 'react'

export default function InvoiceControlCard({ invoice, onEdit, onPost, onDelete, onUnpost, onReverse, onRecordPayment, onViewJournal }){
  const statusCls = useMemo(()=>{
    const s = String(invoice?.status||'draft')
    if (s==='paid') return 'bg-green-100 text-green-700'
    if (s==='posted') return 'bg-blue-100 text-blue-700'
    if (s==='draft') return 'bg-yellow-100 text-yellow-700'
    return 'bg-gray-100 text-gray-700'
  },[invoice])
  const total = Number(invoice?.total||0)
  const paid = Number(invoice?.paid||0)
  const due = Math.max(0, total - paid)
  const discount = Number(((typeof invoice?.discount_total!=='undefined' && invoice?.discount_total!==null)?invoice?.discount_total:invoice?.discount_amount)||0)
  const s = String(invoice?.status||'draft')
  return (
    <div className="border rounded-xl p-4 bg-white">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">فاتورة #{invoice?.invoice_number||invoice?.id}</div>
        <span className={`px-2 py-1 rounded text-xs ${statusCls}`}>{s}</span>
      </div>
      <div className="grid grid-cols-4 gap-3 mt-3">
        <div className="bg-gray-50 rounded p-3">
          <div className="text-sm text-gray-600">الإجمالي</div>
          <div className="text-xl font-bold">{total.toLocaleString('en-US')} SAR</div>
        </div>
        <div className="bg-gray-50 rounded p-3">
          <div className="text-sm text-gray-600">المدفوع</div>
          <div className="text-xl font-bold">{paid.toLocaleString('en-US')} SAR</div>
        </div>
        <div className="bg-gray-50 rounded p-3">
          <div className="text-sm text-gray-600">المتبقي</div>
          <div className="text-xl font-bold">{due.toLocaleString('en-US')} SAR</div>
        </div>
        <div className="bg-gray-50 rounded p-3">
          <div className="text-sm text-gray-600">العميل</div>
          <div className="text-xl font-bold truncate">{invoice?.partner?.name || invoice?.partner_id || '-'}</div>
        </div>
      </div>
      {discount>0 && (
        <div className="grid grid-cols-1 gap-3 mt-3">
          <div className="bg-gray-50 rounded p-3">
            <div className="text-sm text-gray-600">الخصم</div>
            <div className="text-xl font-bold">{discount.toLocaleString('en-US')} SAR</div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 mt-4">
        {s==='draft' && (
          <>
            <button className="px-3 py-2 bg-gray-100 rounded" onClick={onEdit}>تعديل</button>
            <button className="px-3 py-2 bg-green-600 text-white rounded" onClick={onPost}>ترحيل</button>
            <button className="px-3 py-2 bg-red-600 text-white rounded" onClick={onDelete}>حذف</button>
          </>
        )}
        {s==='posted' && (
          <>
            <button className="px-3 py-2 bg-yellow-500 text-white rounded" onClick={onUnpost}>إلغاء الترحيل</button>
            <button className="px-3 py-2 bg-red-600 text-white rounded" onClick={onReverse}>عكس</button>
            <button className="px-3 py-2 bg-gray-100 rounded" onClick={onViewJournal}>عرض القيد</button>
          </>
        )}
        {s==='paid' && (
          <>
            <button className="px-3 py-2 bg-gray-100 rounded" onClick={onViewJournal}>عرض القيد</button>
          </>
        )}
      </div>
    </div>
  )
}