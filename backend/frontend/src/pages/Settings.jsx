import { useEffect, useMemo, useState } from 'react'
import Button from '../ui/Button'
import Toast from '../ui/Toast'
import FormField from '../ui/FormField'
import { users as apiUsers, actions as apiActions, screens as apiScreens, branches as apiBranches, settings as apiSettings } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function Settings(){
  // CRITICAL: Settings page is admin-only
  // Admin has unrestricted access - no permission checks needed
  const { user, refreshPermissions, impersonatePermissionsForUser, clearImpersonation, isAdmin } = useAuth()
  
  // CRITICAL: All Hooks MUST be defined before any conditional returns
  // This follows React Hooks Rules - Hooks must be called in the same order every render
  const [activeTab, setActiveTab] = useState('general')
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [actions, setActions] = useState([])
  const [screens, setScreens] = useState([])
  const [branches, setBranches] = useState([])
  const [userPerms, setUserPerms] = useState([])
  const [company, setCompany] = useState({ name_ar: '', name_en: '', vat_number: '', phone: '', address_ar: '', address_en: '' })
  const [branding, setBranding] = useState({ logo_base64: '', font: '', favicon: '' })
  const [footerCfg, setFooterCfg] = useState({ text_ar: '', text_en: '' })
  const [branchCode, setBranchCode] = useState('')
  const [branchSettings, setBranchSettings] = useState({ logo_base64: '', receipt_font_base64: '', phone: '', print_logo: true, logo_width_mm: 0, logo_height_mm: 0, cancel_password: '' })
  
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ type: '', message: '' })
  const [editingUser, setEditingUser] = useState(null)
  const [userForm, setUserForm] = useState({ email: '', password: '', role: 'user' })
  
  const companyValid = useMemo(()=>{
    // Only require name - VAT and phone are optional
    const nameOk = !!((company.name_ar||'').trim() || (company.name_en||'').trim())
    // VAT is valid if empty OR 15 digits
    const vatOk = !(company.vat_number||'').trim() || /^\d{15}$/.test(String(company.vat_number||''))
    // Phone is valid if empty OR valid format
    const phoneOk = !(company.phone||'').trim() || /^(\+?\d{8,15}|05\d{8})$/.test(String(company.phone||''))
    return nameOk && vatOk && phoneOk
  },[company])

  useEffect(()=>{ (async()=>{
    try {
      const [ul, ac, sc, br] = await Promise.all([
        apiUsers.list(),
        apiActions.list(),
        apiScreens.list(),
        apiBranches.list(),
      ])
      setUsers(Array.isArray(ul)?ul:[])
      setActions(Array.isArray(ac)?ac:[])
      setScreens(Array.isArray(sc)?sc:[])
      setBranches(Array.isArray(br)?br:[])
      const list = Array.isArray(ul)?ul:[]
      const defaultUser = list.find(u => String(u.role||'').toLowerCase() !== 'admin') || list[0] || null
      setSelectedUserId(defaultUser?.id || user?.id || null)
      try { const c = await apiSettings.get('settings_company'); if (c) setCompany(c) } catch {}
      try { const b = await apiSettings.get('settings_branding'); if (b) setBranding(b) } catch {}
      try { const f = await apiSettings.get('settings_footer'); if (f) setFooterCfg(f) } catch {}
      const bc = Array.isArray(br)&&br.length>0 ? String(br[0]?.code||'') : ''
      setBranchCode(bc)
      if (bc) {
        const normalize = (s)=> String(s||'').trim().toLowerCase().replace(/\s+/g,'_')
        const map = { CT: 'china_town', PI: 'place_india' }
        const bRow = (Array.isArray(br)?br:[]).find(x => String(x.code||'')===bc)
        const slug = map[String(bRow?.code||'')] || normalize(bRow?.name||bc)
        const key = `settings_branch_${slug}`
        try { const bs = await apiSettings.get(key); if (bs) setBranchSettings(prev => ({ ...prev, ...bs })) } catch {}
      }
    } catch {}
  })() },[])

  useEffect(()=>{ return ()=>{ try { clearImpersonation() } catch {} } },[clearImpersonation])

  useEffect(()=>{ (async()=>{
    if (!selectedUserId || screens.length===0 || actions.length===0) return
    try {
      const list = await apiUsers.userPermissions(selectedUserId)
      setUserPerms(Array.isArray(list)?list:[])
    } catch {}
  })() },[selectedUserId, screens, actions])

  function toggleUserPerm(screen_id, action_id, branch_id = null) {
    const key = `${screen_id}:${action_id}:${branch_id||'null'}`
    const exists = userPerms.find(p => p.screen_id===screen_id && p.action_id===action_id && (p.branch_id||null)===(branch_id||null))
    if (exists) {
      setUserPerms(userPerms.map(p => (p.screen_id===screen_id && p.action_id===action_id && (p.branch_id||null)===(branch_id||null)) ? { ...p, allowed: !p.allowed } : p))
    } else {
      setUserPerms([...userPerms, { id: 0, user_id: selectedUserId, screen_id, action_id, branch_id: branch_id||null, allowed: true }])
    }
  }

  function setAllForScreen(screen_id, value) {
    const next = [...userPerms]
    for (const a of actions) {
      const idx = next.findIndex(p => p.screen_id===screen_id && p.action_id===a.id && (p.branch_id||null)===null)
      if (idx>=0) next[idx] = { ...next[idx], allowed: !!value }
      else if (value) next.push({ id: 0, user_id: selectedUserId, screen_id, action_id: a.id, branch_id: null, allowed: true })
    }
    setUserPerms(next)
  }

  function setAllForBranch(screen_id, branch_id, value) {
    const next = [...userPerms]
    for (const a of actions) {
      const idx = next.findIndex(p => p.screen_id===screen_id && p.action_id===a.id && Number(p.branch_id||0)===Number(branch_id))
      if (idx>=0) next[idx] = { ...next[idx], allowed: !!value }
      else if (value) next.push({ id: 0, user_id: selectedUserId, screen_id, action_id: a.id, branch_id: Number(branch_id), allowed: true })
    }
    setUserPerms(next)
  }

  

  async function saveAll(){
    try {
      setSaving(true)
      const actionsByIdLocal = Object.fromEntries(actions.map(a => [a.id, a]))
      const screensByIdLocal = Object.fromEntries(screens.map(s => [s.id, s]))
      const branchesByIdLocal = Object.fromEntries(branches.map(b => [b.id, b]))
      const upPayload = userPerms.map(p => ({
        screen_code: String(screensByIdLocal[p.screen_id]?.code||'').toLowerCase(),
        action_code: String(actionsByIdLocal[p.action_id]?.code||'').toLowerCase(),
        branch_code: (p.branch_id===null ? '' : String(branchesByIdLocal[Number(p.branch_id)]?.code||'').toLowerCase()),
        allowed: !!p.allowed
      }))
      await apiUsers.savePermissions(selectedUserId, upPayload)
      try { await refreshPermissions() } catch {}
      setToast({ type: 'success', message: 'تم حفظ صلاحيات المستخدم' })
    } catch (e) {
      const st = e?.status || e?.response?.status || ''
      const msg = e?.message || e?.response?.data?.message || e?.response?.data?.details || ''
      const text = st ? `فشل حفظ الصلاحيات — الحالة ${st}${msg?` — ${msg}`:''}` : 'فشل حفظ الصلاحيات'
      setToast({ type: 'error', message: text })
    } finally { setSaving(false) }
  }
  async function saveCompany(){
    try {
      setSaving(true)
      const nameOk = !!((company.name_ar||'').trim() || (company.name_en||'').trim())
      if (!nameOk) { alert('الاسم مطلوب'); setSaving(false); return }
      // VAT validation only if provided
      if ((company.vat_number||'').trim() && !/^\d{15}$/.test(String(company.vat_number||''))) { 
        alert('رقم الضريبة يجب أن يكون 15 رقم'); setSaving(false); return 
      }
      // Phone validation only if provided
      if ((company.phone||'').trim() && !/^(\+?\d{8,15}|05\d{8})$/.test(String(company.phone||''))) { 
        alert('رقم الهاتف غير صحيح'); setSaving(false); return 
      }
      await apiSettings.save('settings_company', company)
      setToast({ type: 'success', message: 'تم حفظ إعدادات المؤسسة' })
    } catch (e) { 
      console.error('[Settings] Error saving company:', e)
      setToast({ type: 'error', message: 'فشل حفظ الإعدادات' }) 
    } finally { setSaving(false) }
  }
  async function saveBranding(){ 
    try { 
      setSaving(true); 
      await apiSettings.save('settings_branding', branding); 
      setToast({ type: 'success', message: 'تم حفظ الهوية' }) 
    } catch (e) { 
      console.error('[Settings] Save branding error:', e)
      const msg = String(e?.message || e?.response?.data?.error || '').toLowerCase()
      if (msg.includes('too large') || msg.includes('payload') || e?.status === 413) {
        setToast({ type: 'error', message: 'حجم الشعار كبير جداً. جرب تصغير حجم الصورة.' })
      } else {
        setToast({ type: 'error', message: 'فشل حفظ الهوية' }) 
      }
    } finally { setSaving(false) } 
  }
  async function saveFooter(){ try { setSaving(true); await apiSettings.save('settings_footer', footerCfg); setToast({ type: 'success', message: 'تم حفظ التذييل' }) } catch (e) { setToast({ type: 'error', message: 'فشل حفظ التذييل' }) } finally { setSaving(false) } }
  // دالة لتحميل إعدادات الفرع عند تغيير الفرع
  async function loadBranchSettings(code) {
    const normalize = (s) => String(s||'').trim().toLowerCase().replace(/\s+/g,'_');
    const map = { CT: 'china_town', PI: 'place_india' };
    const bRow = branches.find(x => String(x.code||'') === String(code));
    const slug = map[String(bRow?.code||'')] || normalize(bRow?.name||code);
    const key = `settings_branch_${slug}`;
    try {
      const bs = await apiSettings.get(key);
      setBranchSettings(prev => ({ ...prev, ...(bs||{}) }));
    } catch {
      setBranchSettings({
        logo_base64: '',
        receipt_font_base64: '',
        phone: '',
        print_logo: true,
        logo_width_mm: 0,
        logo_height_mm: 0,
        cancel_password: ''
      });
    }
  }

  async function saveUserData(){
    try {
      setSaving(true)
      if (!editingUser || !editingUser.id) {
        setToast({ type: 'error', message: 'لم يتم اختيار مستخدم' })
        setSaving(false)
        return
      }
      
      // Update email and role
      if (userForm.email && userForm.email !== editingUser.email) {
        await apiUsers.update(editingUser.id, { email: userForm.email, role: userForm.role })
      } else if (userForm.role && userForm.role !== editingUser.role) {
        await apiUsers.update(editingUser.id, { role: userForm.role })
      }
      
      // Update password if provided
      if (userForm.password && userForm.password.trim()) {
        await apiUsers.resetPassword(editingUser.id, userForm.password)
      }
      
      // Refresh users list
      const ul = await apiUsers.list()
      setUsers(Array.isArray(ul) ? ul : [])
      
      setToast({ type: 'success', message: 'تم حفظ بيانات المستخدم بنجاح' })
      setEditingUser(null)
      setUserForm({ email: '', password: '', role: 'user' })
    } catch (e) {
      console.error('[Settings] Error saving user data:', e)
      setToast({ type: 'error', message: 'فشل حفظ بيانات المستخدم: ' + (e?.message || 'خطأ غير معروف') })
    } finally {
      setSaving(false)
    }
  }

  function startEditUser(user) {
    setEditingUser(user)
    setUserForm({
      email: user.email || '',
      password: '',
      role: user.role || 'user'
    })
  }

  async function saveBranch(){
    try {
      setSaving(true)
      const normalize = (s)=> String(s||'').trim().toLowerCase().replace(/\s+/g,'_')
      const map = { CT: 'china_town', PI: 'place_india' }
      const bRow = branches.find(x => String(x.code||'')===String(branchCode||''))
      const slug = map[String(bRow?.code||'')] || normalize(bRow?.name||branchCode)
      const key = `settings_branch_${slug}`
      await apiSettings.save(key, branchSettings)
      try { alert('تم الحفظ بنجاح') } catch {}
    } catch (e) {
      console.error('[Settings] Save branch error:', e)
      const msg = String(e?.message || e?.response?.data?.error || '').toLowerCase()
      if (msg.includes('too large') || msg.includes('payload') || e?.status === 413) {
        try { alert('حجم البيانات كبير جداً. جرب تصغير حجم الشعار.') } catch {}
      } else {
        try { alert('فشل حفظ الإعدادات: ' + (e?.message || 'خطأ غير معروف')) } catch {}
      }
    } finally { setSaving(false) }
  }

  const actionsById = useMemo(()=>{ const m={}; for (const a of actions) m[a.id]=a; return m },[actions])
  const screensById = useMemo(()=>{ const m={}; for (const s of screens) m[s.id]=s; return m },[screens])
  const branchesById = useMemo(()=>{ const m={}; for (const b of branches) m[b.id]=b; return m },[branches])

  // CRITICAL: Conditional return AFTER all Hooks are defined
  // This follows React Hooks Rules - Hooks must be called before any early returns
  // If not admin, show access denied (though backend requireAdmin should prevent this)
  if (user && !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-bold text-red-600 mb-2">غير مصرح</div>
          <div className="text-gray-600">هذه الصفحة متاحة للمدير فقط</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {toast.message && (<Toast type={toast.type||'info'} message={toast.message} onClose={()=> setToast({ type:'', message:'' })} />)}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-800">الإعدادات</h2>
            <div className="flex gap-2">
              {activeTab==='permissions' && (<Button variant="primary" onClick={saveAll} disabled={saving} loading={saving}>حفظ</Button>)}
              {activeTab==='users' && editingUser && (<Button variant="primary" onClick={saveUserData} disabled={saving} loading={saving}>حفظ</Button>)}
              {activeTab==='general' && (<Button variant="primary" onClick={saveCompany} disabled={saving || !companyValid} loading={saving}>حفظ</Button>)}
              {activeTab==='branding' && (<Button variant="primary" onClick={saveBranding} disabled={saving} loading={saving}>حفظ</Button>)}
              {activeTab==='footer' && (<Button variant="primary" onClick={saveFooter} disabled={saving} loading={saving}>حفظ</Button>)}
              {activeTab==='branches' && (<Button variant="primary" onClick={saveBranch} disabled={saving} loading={saving}>حفظ</Button>)}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { k:'permissions', t:'صلاحيات المستخدمين' },
              { k:'users', t:'إدارة المستخدمين' },
              { k:'general', t:'إعدادات عامة' },
              { k:'branches', t:'إعدادات الفروع' },
              { k:'branding', t:'العلامة التجارية' },
              { k:'footer', t:'التذييل' },
            ].map(it => (
              <Button key={it.k} variant={activeTab===it.k?'secondary':'secondary'} className={`${activeTab===it.k?'bg-primary-50 border-primary-200':''}`} onClick={()=>setActiveTab(it.k)}>{it.t}</Button>
            ))}
          </div>
        </div>
        {activeTab==='general' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border rounded p-4">
              <div className="font-semibold mb-3">المؤسسة</div>
              <div className="grid grid-cols-1 gap-3">
                <FormField label="الاسم بالعربية" value={company.name_ar||''} onChange={e=>setCompany({ ...company, name_ar: e.target.value })} placeholder="الاسم بالعربية" />
                <FormField label="الاسم بالإنجليزية" value={company.name_en||''} onChange={e=>setCompany({ ...company, name_en: e.target.value })} placeholder="English Name" />
                <FormField label="الرقم الضريبي" required value={company.vat_number||''} onChange={e=>setCompany({ ...company, vat_number: e.target.value })} placeholder="123456789012345" validate={(v)=> (/^\d{15}$/.test(String(v||''))?'' : 'رقم ضريبي غير صحيح')} />
                <FormField label="الهاتف" required value={company.phone||''} onChange={e=>setCompany({ ...company, phone: e.target.value })} placeholder="05XXXXXXXX" validate={(v)=> (/^(\+?\d{8,15}|05\d{8})$/.test(String(v||''))?'' : 'رقم هاتف غير صحيح')} />
                <FormField label="العنوان بالعربية" value={company.address_ar||''} onChange={e=>setCompany({ ...company, address_ar: e.target.value })} placeholder="العنوان بالعربية" />
                <FormField label="العنوان بالإنجليزية" value={company.address_en||''} onChange={e=>setCompany({ ...company, address_en: e.target.value })} placeholder="Address (EN)" />
              </div>
            </div>
          </div>
        )}
        {activeTab==='branding' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border rounded p-4">
              <div className="font-semibold mb-3">الهوية</div>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">الشعار الرئيسي (PNG/JPG)</label>
                  <input 
                    type="file" 
                    accept="image/png,image/jpeg,image/jpg" 
                    className="border rounded px-3 py-2 w-full"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setBranding({ ...branding, logo_base64: ev.target?.result || '' });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  {branding.logo_base64 && (
                    <div className="mt-2">
                      <img src={branding.logo_base64} alt="Logo" className="max-h-20 border rounded" />
                      <button 
                        type="button" 
                        className="text-red-600 text-sm mt-1"
                        onClick={() => setBranding({ ...branding, logo_base64: '' })}
                      >
                        إزالة الشعار
                      </button>
                    </div>
                  )}
                </div>
                <input className="border rounded px-3 py-2" placeholder="الخط" value={branding.font||''} onChange={e=>setBranding({ ...branding, font: e.target.value })} />
                <input className="border rounded px-3 py-2" placeholder="Favicon" value={branding.favicon||''} onChange={e=>setBranding({ ...branding, favicon: e.target.value })} />
              </div>
            </div>
          </div>
        )}
        {activeTab==='footer' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border rounded p-4">
              <div className="font-semibold mb-3">نص التذييل</div>
              <div className="grid grid-cols-1 gap-3">
                <input className="border rounded px-3 py-2" placeholder="نص عربي" value={footerCfg.text_ar||''} onChange={e=>setFooterCfg({ ...footerCfg, text_ar: e.target.value })} />
                <input className="border rounded px-3 py-2" placeholder="نص إنجليزي" value={footerCfg.text_en||''} onChange={e=>setFooterCfg({ ...footerCfg, text_en: e.target.value })} />
              </div>
            </div>
          </div>
        )}
        {activeTab==='branches' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border rounded p-4">
              <div className="font-semibold mb-3">إعدادات الفرع</div>
              <div className="grid grid-cols-1 gap-3">
                <select 
                  className="border rounded px-3 py-2" 
                  value={branchCode} 
                  onChange={e => {
                    const code = e.target.value;
                    setBranchCode(code);
                    loadBranchSettings(code); // استدعاء آمن خارج JSX
                  }}
                >
                  {branches.map(b => (<option key={b.id} value={b.code||''}>{b.name}</option>))}
                </select>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">شعار الفرع (PNG/JPG)</label>
                  <input 
                    type="file" 
                    accept="image/png,image/jpeg,image/jpg" 
                    className="border rounded px-3 py-2 w-full"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setBranchSettings({ ...branchSettings, logo_base64: ev.target?.result || '' });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  {branchSettings.logo_base64 && (
                    <div className="mt-2">
                      <img src={branchSettings.logo_base64} alt="Branch Logo" className="max-h-20 border rounded" />
                      <button 
                        type="button" 
                        className="text-red-600 text-sm mt-1"
                        onClick={() => setBranchSettings({ ...branchSettings, logo_base64: '' })}
                      >
                        إزالة الشعار
                      </button>
                    </div>
                  )}
                </div>
                <input className="border rounded px-3 py-2" placeholder="Base64 خط الإيصال" value={branchSettings.receipt_font_base64||''} onChange={e=>setBranchSettings({ ...branchSettings, receipt_font_base64: e.target.value })} />
                <input className="border rounded px-3 py-2" placeholder="هاتف الفرع" value={branchSettings.phone||''} onChange={e=>setBranchSettings({ ...branchSettings, phone: e.target.value })} />
                <label className="flex items-center gap-2"><input type="checkbox" checked={!!branchSettings.print_logo} onChange={e=>setBranchSettings({ ...branchSettings, print_logo: e.target.checked })} /><span>طباعة الشعار على الإيصال</span></label>
                <div className="grid grid-cols-2 gap-3">
                  <input className="border rounded px-3 py-2" placeholder="عرض الشعار (مم)" value={String(branchSettings.logo_width_mm||'')} onChange={e=>setBranchSettings({ ...branchSettings, logo_width_mm: Number(e.target.value)||0 })} />
                  <input className="border rounded px-3 py-2" placeholder="ارتفاع الشعار (مم)" value={String(branchSettings.logo_height_mm||'')} onChange={e=>setBranchSettings({ ...branchSettings, logo_height_mm: Number(e.target.value)||0 })} />
                </div>
                <input className="border rounded px-3 py-2" placeholder="كلمة مرور الإلغاء" value={branchSettings.cancel_password||''} onChange={e=>setBranchSettings({ ...branchSettings, cancel_password: e.target.value })} />
              </div>
            </div>
          </div>
        )}
        {activeTab==='users' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border rounded p-4">
              <div className="font-semibold mb-3">قائمة المستخدمين</div>
              <ul className="space-y-2">
                {users.map(u => (
                  <li key={u.id}>
                    <button 
                      className={`w-full text-left px-3 py-2 rounded ${editingUser?.id===u.id?'bg-primary-50 border-primary-200':'bg-gray-50 border-gray-200'} border`} 
                      onClick={()=>startEditUser(u)}
                    >
                      <div className="font-medium">{u.name || u.email}</div>
                      <div className="text-sm text-gray-600">{u.email}</div>
                      <div className="text-xs text-gray-500">Role: {u.role || 'user'}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {editingUser && (
              <div className="bg-white border rounded p-4">
                <div className="font-semibold mb-3">تعديل بيانات المستخدم</div>
                <div className="grid grid-cols-1 gap-3">
                  <FormField 
                    label="البريد الإلكتروني" 
                    value={userForm.email||''} 
                    onChange={e=>setUserForm({...userForm, email: e.target.value})} 
                    placeholder="email@example.com" 
                  />
                  <FormField 
                    label="كلمة المرور (اتركها فارغة للاحتفاظ بالكلمة الحالية)" 
                    type="password"
                    value={userForm.password||''} 
                    onChange={e=>setUserForm({...userForm, password: e.target.value})} 
                    placeholder="كلمة مرور جديدة" 
                  />
                  <div>
                    <label className="block text-sm font-medium mb-1">الدور (Role)</label>
                    <select 
                      className="w-full border rounded px-3 py-2"
                      value={userForm.role||'user'}
                      onChange={e=>setUserForm({...userForm, role: e.target.value})}
                    >
                      <option value="user">مستخدم</option>
                      <option value="admin">مدير</option>
                    </select>
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    <div>المستخدم الحالي: {editingUser.email}</div>
                    <div>الدور الحالي: {editingUser.role || 'user'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab==='permissions' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border rounded p-4">
            <div className="font-semibold mb-2">المستخدمون</div>
            <ul className="space-y-2">
              {users.map(u => (
                <li key={u.id}>
                  <button className={`w-full text-left px-3 py-2 rounded ${selectedUserId===u.id?'bg-primary-50 border-primary-200':'bg-gray-50 border-gray-200'} border`} onClick={async()=>{ setSelectedUserId(u.id); try { await impersonatePermissionsForUser(u.id) } catch {} }}>{u.name || u.email} — {u.email}</button>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white border rounded p-4 md:col-span-2">
            <div className="font-semibold mb-2">صلاحيات الشاشات</div>
            <div className="space-y-4">
              {screens.map(s => (
                <div key={s.id} className="border rounded p-3">
                  <div className="font-semibold mb-2">{s.name_ar||s.name_en||s.code}</div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-600">عام</div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={()=>setAllForScreen(s.id, true)}>تحديد الكل</Button>
                      <Button variant="ghost" onClick={()=>setAllForScreen(s.id, false)}>مسح الكل</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {actions.map(a => {
                      const exists = userPerms.find(p => p.screen_id===s.id && p.action_id===a.id && (p.branch_id||null)===null)
                      const checked = exists ? !!exists.allowed : false
                      return (
                        <label key={a.id} className="flex items-center gap-2">
                          <input type="checkbox" checked={checked} onChange={()=>toggleUserPerm(s.id, a.id, null)} />
                          <span>{a.code}</span>
                        </label>
                      )
                    })}
                  </div>
                  {s.has_branches && (
                    <div className="mt-3">
                      <div className="text-sm text-gray-600">حسب الفروع:</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                        {branches.map(b => (
                          <div key={b.id} className="border rounded p-2">
                            <div className="flex items-center justify-between">
                              <div className="font-medium">{b.name}</div>
                              <div className="flex items-center gap-2">
                                <button className="px-2 py-1 border rounded" onClick={()=>setAllForBranch(s.id, b.id, true)}>تحديد الكل</button>
                                <button className="px-2 py-1 border rounded" onClick={()=>setAllForBranch(s.id, b.id, false)}>مسح الكل</button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                              {actions.map(a => {
                                const exists = userPerms.find(p => p.screen_id===s.id && p.action_id===a.id && Number(p.branch_id||0)===Number(b.id))
                                const checked = exists ? !!exists.allowed : false
                                return (
                                  <label key={`${b.id}:${a.id}`} className="flex items-center gap-2">
                                    <input type="checkbox" checked={checked} onChange={()=>toggleUserPerm(s.id, a.id, b.id)} />
                                    <span>{a.code}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
          </div>
        </div>
        )}
      </main>
    </div>
  )
}
