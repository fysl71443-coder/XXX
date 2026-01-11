import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
export default function POSBranch(){
  const navigate = useNavigate()
  const { canScreen } = useAuth()
  const list = [
    { key: 'place_india', name: 'Place India' },
    { key: 'china_town', name: 'China Town' },
  ]
  const allowed = list.filter(b => canScreen('sales','read', b.key))
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-primary-700">نقطة البيع • اختر الفرع</h3>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 border rounded bg-white hover:bg-gray-50" onClick={()=> navigate(-1)}>رجوع</button>
            <button className="px-3 py-2 border rounded bg-white hover:bg-gray-50" onClick={()=> navigate('/')}>الرئيسية</button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {allowed.length>0 ? allowed.map(b=> (
            <button key={b.key} className="p-6 bg-white border rounded-xl shadow-sm hover:shadow-md hover:border-primary-300 transition" onClick={()=> navigate(`/pos/${b.key}/tables`)}>
              <div className="text-lg font-semibold text-gray-800">{b.name}</div>
            </button>
          )) : (
            <div className="text-sm text-gray-600">لا تملك صلاحية لأي فرع في نقطة البيع</div>
          )}
        </div>
      </main>
    </div>
  )
}