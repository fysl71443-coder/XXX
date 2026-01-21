import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../ui/Button'
import Toast from '../ui/Toast'
import FormField from '../ui/FormField'
import { users as apiUsers, actions as apiActions, screens as apiScreens, branches as apiBranches, settings as apiSettings } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { FaHome, FaArrowRight, FaCog, FaUsers, FaUserShield, FaBuilding, FaPalette, FaFileAlt, FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaKey, FaUserCog } from 'react-icons/fa'

export default function Settings(){
  const navigate = useNavigate()
  const { user, refreshPermissions, impersonatePermissionsForUser, clearImpersonation, isAdmin } = useAuth()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  
  // All Hooks MUST be defined before any conditional returns
  const [activeTab, setActiveTab] = useState('users')
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
  const [userForm, setUserForm] = useState({ email: '', password: '', role: 'user', name: '' })
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [newUserForm, setNewUserForm] = useState({ email: '', password: '', role: 'user', name: '' })
  
  useEffect(() => {
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  
  const companyValid = useMemo(()=>{
    const nameOk = !!((company.name_ar||'').trim() || (company.name_en||'').trim())
    const vatOk = !(company.vat_number||'').trim() || /^\d{15}$/.test(String(company.vat_number||''))
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
      setToast({ type: 'success', message: lang==='ar'?'تم حفظ صلاحيات المستخدم':'User permissions saved' })
    } catch (e) {
      setToast({ type: 'error', message: lang==='ar'?'فشل حفظ الصلاحيات':'Failed to save permissions' })
    } finally { setSaving(false) }
  }

  async function saveCompany(){
    try {
      setSaving(true)
      const nameOk = !!((company.name_ar||'').trim() || (company.name_en||'').trim())
      if (!nameOk) { alert(lang==='ar'?'الاسم مطلوب':'Name is required'); setSaving(false); return }
      if ((company.vat_number||'').trim() && !/^\d{15}$/.test(String(company.vat_number||''))) { 
        alert(lang==='ar'?'رقم الضريبة يجب أن يكون 15 رقم':'VAT must be 15 digits'); setSaving(false); return 
      }
      if ((company.phone||'').trim() && !/^(\+?\d{8,15}|05\d{8})$/.test(String(company.phone||''))) { 
        alert(lang==='ar'?'رقم الهاتف غير صحيح':'Invalid phone number'); setSaving(false); return 
      }
      await apiSettings.save('settings_company', company)
      setToast({ type: 'success', message: lang==='ar'?'تم حفظ إعدادات المؤسسة':'Company settings saved' })
    } catch (e) { 
      setToast({ type: 'error', message: lang==='ar'?'فشل حفظ الإعدادات':'Failed to save settings' }) 
    } finally { setSaving(false) }
  }

  async function saveBranding(){ 
    try { 
      setSaving(true); 
      await apiSettings.save('settings_branding', branding); 
      setToast({ type: 'success', message: lang==='ar'?'تم حفظ الهوية':'Branding saved' }) 
    } catch (e) { 
      const msg = String(e?.message || e?.response?.data?.error || '').toLowerCase()
      if (msg.includes('too large') || msg.includes('payload') || e?.status === 413) {
        setToast({ type: 'error', message: lang==='ar'?'حجم الشعار كبير جداً':'Logo size too large' })
      } else {
        setToast({ type: 'error', message: lang==='ar'?'فشل حفظ الهوية':'Failed to save branding' }) 
      }
    } finally { setSaving(false) } 
  }

  async function saveFooter(){ 
    try { 
      setSaving(true); 
      await apiSettings.save('settings_footer', footerCfg); 
      setToast({ type: 'success', message: lang==='ar'?'تم حفظ التذييل':'Footer saved' }) 
    } catch (e) { 
      setToast({ type: 'error', message: lang==='ar'?'فشل حفظ التذييل':'Failed to save footer' }) 
    } finally { setSaving(false) } 
  }

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
      setBranchSettings({ logo_base64: '', receipt_font_base64: '', phone: '', print_logo: true, logo_width_mm: 0, logo_height_mm: 0, cancel_password: '' });
    }
  }

  async function saveUserData(){
    try {
      setSaving(true)
      if (!editingUser || !editingUser.id) {
        setToast({ type: 'error', message: lang==='ar'?'لم يتم اختيار مستخدم':'No user selected' })
        setSaving(false)
        return
      }
      
      // Update user data
      const updateData = { role: userForm.role }
      if (userForm.email && userForm.email !== editingUser.email) {
        updateData.email = userForm.email
      }
      await apiUsers.update(editingUser.id, updateData)
      
      // Update password if provided
      if (userForm.password && userForm.password.trim()) {
        await apiUsers.resetPassword(editingUser.id, userForm.password)
      }
      
      // Refresh users list
      const ul = await apiUsers.list()
      setUsers(Array.isArray(ul) ? ul : [])
      
      setToast({ type: 'success', message: lang==='ar'?'تم حفظ بيانات المستخدم بنجاح':'User data saved successfully' })
      setEditingUser(null)
      setUserForm({ email: '', password: '', role: 'user', name: '' })
    } catch (e) {
      setToast({ type: 'error', message: lang==='ar'?'فشل حفظ بيانات المستخدم':'Failed to save user data' })
    } finally {
      setSaving(false)
    }
  }

  async function createUser() {
    try {
      setSaving(true)
      if (!newUserForm.email || !newUserForm.password) {
        setToast({ type: 'error', message: lang==='ar'?'البريد وكلمة المرور مطلوبان':'Email and password are required' })
        setSaving(false)
        return
      }
      
      await apiUsers.create({
        email: newUserForm.email,
        password: newUserForm.password,
        role: newUserForm.role || 'user'
      })
      
      const ul = await apiUsers.list()
      setUsers(Array.isArray(ul) ? ul : [])
      
      setToast({ type: 'success', message: lang==='ar'?'تم إنشاء المستخدم بنجاح':'User created successfully' })
      setShowCreateUser(false)
      setNewUserForm({ email: '', password: '', role: 'user', name: '' })
    } catch (e) {
      const code = e?.code || e?.response?.data?.error || ''
      if (code === 'conflict') {
        setToast({ type: 'error', message: lang==='ar'?'البريد الإلكتروني مستخدم بالفعل':'Email already exists' })
      } else {
        setToast({ type: 'error', message: lang==='ar'?'فشل إنشاء المستخدم':'Failed to create user' })
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteUser(userId) {
    if (!window.confirm(lang==='ar'?'هل أنت متأكد من حذف هذا المستخدم؟':'Are you sure you want to delete this user?')) return
    
    try {
      setSaving(true)
      await apiUsers.remove(userId)
      
      const ul = await apiUsers.list()
      setUsers(Array.isArray(ul) ? ul : [])
      
      if (editingUser?.id === userId) {
        setEditingUser(null)
        setUserForm({ email: '', password: '', role: 'user', name: '' })
      }
      if (selectedUserId === userId) {
        setSelectedUserId(null)
      }
      
      setToast({ type: 'success', message: lang==='ar'?'تم حذف المستخدم بنجاح':'User deleted successfully' })
    } catch (e) {
      const details = e?.response?.data?.details || e?.message || ''
      if (details.includes('yourself')) {
        setToast({ type: 'error', message: lang==='ar'?'لا يمكنك حذف نفسك':'Cannot delete yourself' })
      } else {
        setToast({ type: 'error', message: lang==='ar'?'فشل حذف المستخدم':'Failed to delete user' })
      }
    } finally {
      setSaving(false)
    }
  }

  function startEditUser(u) {
    setEditingUser(u)
    setUserForm({
      email: u.email || '',
      password: '',
      role: u.role || 'user',
      name: u.name || ''
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
      setToast({ type: 'success', message: lang==='ar'?'تم حفظ إعدادات الفرع':'Branch settings saved' })
    } catch (e) {
      const msg = String(e?.message || e?.response?.data?.error || '').toLowerCase()
      if (msg.includes('too large') || msg.includes('payload') || e?.status === 413) {
        setToast({ type: 'error', message: lang==='ar'?'حجم البيانات كبير جداً':'Data size too large' })
      } else {
        setToast({ type: 'error', message: lang==='ar'?'فشل حفظ الإعدادات':'Failed to save settings' })
      }
    } finally { setSaving(false) }
  }

  // If not admin, show access denied
  if (user && !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir={lang==='ar'?'rtl':'ltr'}>
        <div className="text-center">
          <div className="text-xl font-bold text-red-600 mb-2">{lang==='ar'?'غير مصرح':'Unauthorized'}</div>
          <div className="text-gray-600 mb-4">{lang==='ar'?'هذه الصفحة متاحة للمدير فقط':'This page is admin only'}</div>
          <button className="px-4 py-2 bg-primary-600 text-white rounded-lg" onClick={()=>navigate('/')}>
            <FaHome className="inline ml-2" /> {lang==='ar'?'العودة للرئيسية':'Go Home'}
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { k:'users', t: lang==='ar'?'إدارة المستخدمين':'User Management', icon: FaUsers },
    { k:'permissions', t: lang==='ar'?'صلاحيات المستخدمين':'User Permissions', icon: FaUserShield },
    { k:'general', t: lang==='ar'?'إعدادات المؤسسة':'Company Settings', icon: FaBuilding },
    { k:'branches', t: lang==='ar'?'إعدادات الفروع':'Branch Settings', icon: FaCog },
    { k:'branding', t: lang==='ar'?'العلامة التجارية':'Branding', icon: FaPalette },
    { k:'footer', t: lang==='ar'?'التذييل':'Footer', icon: FaFileAlt },
  ]

  return (
    <div className="min-h-screen bg-gray-50" dir={lang==='ar'?'rtl':'ltr'}>
      {toast.message && (<Toast type={toast.type||'info'} message={toast.message} onClose={()=> setToast({ type:'', message:'' })} />)}
      
      {/* Header */}
      <header className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FaCog className="w-6 h-6" />
            <div>
              <h1 className="text-xl font-bold">{lang==='ar'?'الإعدادات':'Settings'}</h1>
              <p className="text-sm text-white/80">{lang==='ar'?'إدارة إعدادات النظام والمستخدمين':'Manage system and user settings'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-2 transition-colors" onClick={()=>navigate('/')}>
              <FaHome /> {lang==='ar'?'الرئيسية':'Home'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border mb-6 p-1">
          <div className="flex flex-wrap gap-1">
            {tabs.map(it => {
              const Icon = it.icon
              return (
                <button 
                  key={it.k} 
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all ${activeTab===it.k ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  onClick={()=>setActiveTab(it.k)}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{it.t}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Users Tab */}
        {activeTab==='users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">{lang==='ar'?'إدارة المستخدمين':'User Management'}</h2>
              <button 
                className="px-4 py-2 bg-primary-600 text-white rounded-lg flex items-center gap-2 hover:bg-primary-700 transition-colors"
                onClick={()=>setShowCreateUser(true)}
              >
                <FaPlus /> {lang==='ar'?'إضافة مستخدم':'Add User'}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Users List */}
              <div className="bg-white rounded-xl border shadow-sm p-4">
                <div className="font-semibold mb-4 text-gray-700">{lang==='ar'?'قائمة المستخدمين':'Users List'} ({users.length})</div>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {users.map(u => (
                    <div 
                      key={u.id} 
                      className={`p-3 rounded-lg border ${editingUser?.id===u.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'} transition-colors`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 cursor-pointer" onClick={()=>startEditUser(u)}>
                          <div className="font-medium text-gray-800">{u.name || u.email}</div>
                          <div className="text-sm text-gray-500">{u.email}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded ${u.role==='admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                              {u.role==='admin' ? (lang==='ar'?'مدير':'Admin') : (lang==='ar'?'مستخدم':'User')}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${u.is_active!==false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                              {u.is_active!==false ? (lang==='ar'?'نشط':'Active') : (lang==='ar'?'معطل':'Inactive')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            onClick={()=>startEditUser(u)}
                            title={lang==='ar'?'تعديل':'Edit'}
                          >
                            <FaEdit />
                          </button>
                          {u.id !== user?.id && (
                            <button 
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              onClick={()=>deleteUser(u.id)}
                              title={lang==='ar'?'حذف':'Delete'}
                            >
                              <FaTrash />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && (
                    <div className="text-center py-8 text-gray-500">{lang==='ar'?'لا يوجد مستخدمين':'No users found'}</div>
                  )}
                </div>
              </div>

              {/* Edit User Form */}
              {editingUser && (
                <div className="bg-white rounded-xl border shadow-sm p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-semibold text-gray-700 flex items-center gap-2">
                      <FaUserCog /> {lang==='ar'?'تعديل بيانات المستخدم':'Edit User'}
                    </div>
                    <button 
                      className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                      onClick={()=>{ setEditingUser(null); setUserForm({ email:'', password:'', role:'user', name:'' }) }}
                    >
                      <FaTimes />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'البريد الإلكتروني':'Email'}</label>
                      <input 
                        type="email"
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        value={userForm.email} 
                        onChange={e=>setUserForm({...userForm, email: e.target.value})} 
                        placeholder="email@example.com"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <FaKey className="inline ml-1" /> {lang==='ar'?'كلمة المرور الجديدة':'New Password'}
                      </label>
                      <input 
                        type="password"
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        value={userForm.password} 
                        onChange={e=>setUserForm({...userForm, password: e.target.value})} 
                        placeholder={lang==='ar'?'اتركها فارغة للاحتفاظ بالكلمة الحالية':'Leave empty to keep current'}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'الدور':'Role'}</label>
                      <select 
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        value={userForm.role}
                        onChange={e=>setUserForm({...userForm, role: e.target.value})}
                      >
                        <option value="user">{lang==='ar'?'مستخدم عادي':'User'}</option>
                        <option value="admin">{lang==='ar'?'مدير النظام':'Admin'}</option>
                      </select>
                    </div>

                    <div className="pt-4 border-t flex justify-end gap-2">
                      <button 
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        onClick={()=>{ setEditingUser(null); setUserForm({ email:'', password:'', role:'user', name:'' }) }}
                      >
                        {lang==='ar'?'إلغاء':'Cancel'}
                      </button>
                      <button 
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                        onClick={saveUserData}
                        disabled={saving}
                      >
                        <FaSave /> {saving ? (lang==='ar'?'جار الحفظ...':'Saving...') : (lang==='ar'?'حفظ التغييرات':'Save Changes')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Create User Form */}
              {showCreateUser && (
                <div className="bg-white rounded-xl border shadow-sm p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-semibold text-gray-700 flex items-center gap-2">
                      <FaPlus /> {lang==='ar'?'إنشاء مستخدم جديد':'Create New User'}
                    </div>
                    <button 
                      className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                      onClick={()=>{ setShowCreateUser(false); setNewUserForm({ email:'', password:'', role:'user', name:'' }) }}
                    >
                      <FaTimes />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {lang==='ar'?'البريد الإلكتروني':'Email'} <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="email"
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        value={newUserForm.email} 
                        onChange={e=>setNewUserForm({...newUserForm, email: e.target.value})} 
                        placeholder="email@example.com"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {lang==='ar'?'كلمة المرور':'Password'} <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="password"
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        value={newUserForm.password} 
                        onChange={e=>setNewUserForm({...newUserForm, password: e.target.value})} 
                        placeholder={lang==='ar'?'كلمة مرور قوية':'Strong password'}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'الدور':'Role'}</label>
                      <select 
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        value={newUserForm.role}
                        onChange={e=>setNewUserForm({...newUserForm, role: e.target.value})}
                      >
                        <option value="user">{lang==='ar'?'مستخدم عادي':'User'}</option>
                        <option value="admin">{lang==='ar'?'مدير النظام':'Admin'}</option>
                      </select>
                    </div>

                    <div className="pt-4 border-t flex justify-end gap-2">
                      <button 
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        onClick={()=>{ setShowCreateUser(false); setNewUserForm({ email:'', password:'', role:'user', name:'' }) }}
                      >
                        {lang==='ar'?'إلغاء':'Cancel'}
                      </button>
                      <button 
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                        onClick={createUser}
                        disabled={saving}
                      >
                        <FaPlus /> {saving ? (lang==='ar'?'جار الإنشاء...':'Creating...') : (lang==='ar'?'إنشاء المستخدم':'Create User')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Permissions Tab */}
        {activeTab==='permissions' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">{lang==='ar'?'صلاحيات المستخدمين':'User Permissions'}</h2>
              <button 
                className="px-4 py-2 bg-primary-600 text-white rounded-lg flex items-center gap-2 hover:bg-primary-700 transition-colors"
                onClick={saveAll}
                disabled={saving}
              >
                <FaSave /> {saving ? (lang==='ar'?'جار الحفظ...':'Saving...') : (lang==='ar'?'حفظ الصلاحيات':'Save Permissions')}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl border shadow-sm p-4">
                <div className="font-semibold mb-3 text-gray-700">{lang==='ar'?'اختر المستخدم':'Select User'}</div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {users.map(u => (
                    <button 
                      key={u.id}
                      className={`w-full text-${lang==='ar'?'right':'left'} p-3 rounded-lg border transition-colors ${selectedUserId===u.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                      onClick={async()=>{ setSelectedUserId(u.id); try { await impersonatePermissionsForUser(u.id) } catch {} }}
                    >
                      <div className="font-medium">{u.name || u.email}</div>
                      <div className="text-sm text-gray-500">{u.email}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-3 bg-white rounded-xl border shadow-sm p-4">
                <div className="font-semibold mb-3 text-gray-700">{lang==='ar'?'صلاحيات الشاشات':'Screen Permissions'}</div>
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {screens.map(s => (
                    <div key={s.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-semibold">{s.name_ar||s.name_en||s.code}</div>
                        <div className="flex items-center gap-2">
                          <button className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200" onClick={()=>setAllForScreen(s.id, true)}>{lang==='ar'?'تحديد الكل':'Select All'}</button>
                          <button className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200" onClick={()=>setAllForScreen(s.id, false)}>{lang==='ar'?'مسح الكل':'Clear All'}</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {actions.map(a => {
                          const exists = userPerms.find(p => p.screen_id===s.id && p.action_id===a.id && (p.branch_id||null)===null)
                          const checked = exists ? !!exists.allowed : false
                          return (
                            <label key={a.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
                              <input type="checkbox" checked={checked} onChange={()=>toggleUserPerm(s.id, a.id, null)} className="w-4 h-4 text-primary-600" />
                              <span className="text-sm">{a.name_ar || a.code}</span>
                            </label>
                          )
                        })}
                      </div>
                      {s.has_branches && branches.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="text-sm font-medium text-gray-600 mb-2">{lang==='ar'?'حسب الفروع:':'By Branch:'}</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {branches.map(b => (
                              <div key={b.id} className="border rounded p-3 bg-gray-50">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="font-medium text-sm">{b.name}</div>
                                  <div className="flex gap-1">
                                    <button className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded" onClick={()=>setAllForBranch(s.id, b.id, true)}>{lang==='ar'?'الكل':'All'}</button>
                                    <button className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded" onClick={()=>setAllForBranch(s.id, b.id, false)}>{lang==='ar'?'مسح':'Clear'}</button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                  {actions.map(a => {
                                    const exists = userPerms.find(p => p.screen_id===s.id && p.action_id===a.id && Number(p.branch_id||0)===Number(b.id))
                                    const checked = exists ? !!exists.allowed : false
                                    return (
                                      <label key={`${b.id}:${a.id}`} className="flex items-center gap-1 text-xs cursor-pointer">
                                        <input type="checkbox" checked={checked} onChange={()=>toggleUserPerm(s.id, a.id, b.id)} className="w-3 h-3" />
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
          </div>
        )}

        {/* General/Company Tab */}
        {activeTab==='general' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">{lang==='ar'?'إعدادات المؤسسة':'Company Settings'}</h2>
              <button 
                className="px-4 py-2 bg-primary-600 text-white rounded-lg flex items-center gap-2 hover:bg-primary-700 transition-colors disabled:opacity-50"
                onClick={saveCompany}
                disabled={saving || !companyValid}
              >
                <FaSave /> {saving ? (lang==='ar'?'جار الحفظ...':'Saving...') : (lang==='ar'?'حفظ':'Save')}
              </button>
            </div>

            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'اسم المؤسسة (عربي)':'Company Name (Arabic)'}</label>
                      <input 
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500" 
                        value={company.name_ar||''} 
                        onChange={e=>setCompany({ ...company, name_ar: e.target.value })} 
                        placeholder={lang==='ar'?'الاسم بالعربية':'Arabic Name'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'اسم المؤسسة (إنجليزي)':'Company Name (English)'}</label>
                      <input 
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500" 
                        value={company.name_en||''} 
                        onChange={e=>setCompany({ ...company, name_en: e.target.value })} 
                        placeholder="English Name"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'الرقم الضريبي (15 رقم)':'VAT Number (15 digits)'}</label>
                      <input 
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500" 
                        value={company.vat_number||''} 
                        onChange={e=>setCompany({ ...company, vat_number: e.target.value })} 
                        placeholder="300000000000003"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'رقم الهاتف':'Phone Number'}</label>
                      <input 
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500" 
                        value={company.phone||''} 
                        onChange={e=>setCompany({ ...company, phone: e.target.value })} 
                        placeholder="05XXXXXXXX"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'العنوان (عربي)':'Address (Arabic)'}</label>
                      <textarea 
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500" 
                        rows={2}
                        value={company.address_ar||''} 
                        onChange={e=>setCompany({ ...company, address_ar: e.target.value })} 
                        placeholder={lang==='ar'?'العنوان بالعربية':'Arabic Address'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'العنوان (إنجليزي)':'Address (English)'}</label>
                      <textarea 
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500" 
                        rows={2}
                        value={company.address_en||''} 
                        onChange={e=>setCompany({ ...company, address_en: e.target.value })} 
                        placeholder="English Address"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Branding Tab */}
        {activeTab==='branding' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">{lang==='ar'?'العلامة التجارية':'Branding'}</h2>
              <button 
                className="px-4 py-2 bg-primary-600 text-white rounded-lg flex items-center gap-2 hover:bg-primary-700 transition-colors"
                onClick={saveBranding}
                disabled={saving}
              >
                <FaSave /> {saving ? (lang==='ar'?'جار الحفظ...':'Saving...') : (lang==='ar'?'حفظ':'Save')}
              </button>
            </div>

            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{lang==='ar'?'الشعار الرئيسي':'Main Logo'}</label>
                    <input 
                      type="file" 
                      accept="image/png,image/jpeg,image/jpg" 
                      className="w-full border rounded-lg px-3 py-2"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => setBranding({ ...branding, logo_base64: ev.target?.result || '' });
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    {branding.logo_base64 && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <img src={branding.logo_base64} alt="Logo" className="max-h-24 rounded" />
                        <button 
                          className="mt-2 text-sm text-red-600 hover:text-red-700"
                          onClick={() => setBranding({ ...branding, logo_base64: '' })}
                        >
                          {lang==='ar'?'إزالة الشعار':'Remove Logo'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Tab */}
        {activeTab==='footer' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">{lang==='ar'?'نص التذييل':'Footer Text'}</h2>
              <button 
                className="px-4 py-2 bg-primary-600 text-white rounded-lg flex items-center gap-2 hover:bg-primary-700 transition-colors"
                onClick={saveFooter}
                disabled={saving}
              >
                <FaSave /> {saving ? (lang==='ar'?'جار الحفظ...':'Saving...') : (lang==='ar'?'حفظ':'Save')}
              </button>
            </div>

            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'النص العربي':'Arabic Text'}</label>
                    <textarea 
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500" 
                      rows={2}
                      value={footerCfg.text_ar||''} 
                      onChange={e=>setFooterCfg({ ...footerCfg, text_ar: e.target.value })} 
                      placeholder={lang==='ar'?'نص التذييل بالعربية':'Arabic footer text'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'النص الإنجليزي':'English Text'}</label>
                    <textarea 
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500" 
                      rows={2}
                      value={footerCfg.text_en||''} 
                      onChange={e=>setFooterCfg({ ...footerCfg, text_en: e.target.value })} 
                      placeholder="English footer text"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Branches Tab */}
        {activeTab==='branches' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">{lang==='ar'?'إعدادات الفروع':'Branch Settings'}</h2>
              <button 
                className="px-4 py-2 bg-primary-600 text-white rounded-lg flex items-center gap-2 hover:bg-primary-700 transition-colors"
                onClick={saveBranch}
                disabled={saving}
              >
                <FaSave /> {saving ? (lang==='ar'?'جار الحفظ...':'Saving...') : (lang==='ar'?'حفظ':'Save')}
              </button>
            </div>

            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'اختر الفرع':'Select Branch'}</label>
                    <select 
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500" 
                      value={branchCode} 
                      onChange={e => { setBranchCode(e.target.value); loadBranchSettings(e.target.value); }}
                    >
                      {branches.map(b => (<option key={b.id} value={b.code||''}>{b.name}</option>))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{lang==='ar'?'شعار الفرع':'Branch Logo'}</label>
                    <input 
                      type="file" 
                      accept="image/png,image/jpeg,image/jpg" 
                      className="w-full border rounded-lg px-3 py-2"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => setBranchSettings({ ...branchSettings, logo_base64: ev.target?.result || '' });
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    {branchSettings.logo_base64 && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <img src={branchSettings.logo_base64} alt="Branch Logo" className="max-h-20 rounded" />
                        <button 
                          className="mt-2 text-sm text-red-600 hover:text-red-700"
                          onClick={() => setBranchSettings({ ...branchSettings, logo_base64: '' })}
                        >
                          {lang==='ar'?'إزالة الشعار':'Remove Logo'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'هاتف الفرع':'Branch Phone'}</label>
                    <input 
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500" 
                      value={branchSettings.phone||''} 
                      onChange={e=>setBranchSettings({ ...branchSettings, phone: e.target.value })} 
                      placeholder="05XXXXXXXX"
                    />
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <input 
                      type="checkbox" 
                      id="print_logo"
                      checked={!!branchSettings.print_logo} 
                      onChange={e=>setBranchSettings({ ...branchSettings, print_logo: e.target.checked })}
                      className="w-4 h-4 text-primary-600"
                    />
                    <label htmlFor="print_logo" className="text-sm text-gray-700">{lang==='ar'?'طباعة الشعار على الإيصال':'Print logo on receipt'}</label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'عرض الشعار (مم)':'Logo Width (mm)'}</label>
                      <input 
                        type="number"
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500" 
                        value={String(branchSettings.logo_width_mm||'')} 
                        onChange={e=>setBranchSettings({ ...branchSettings, logo_width_mm: Number(e.target.value)||0 })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'ارتفاع الشعار (مم)':'Logo Height (mm)'}</label>
                      <input 
                        type="number"
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500" 
                        value={String(branchSettings.logo_height_mm||'')} 
                        onChange={e=>setBranchSettings({ ...branchSettings, logo_height_mm: Number(e.target.value)||0 })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'كلمة مرور الإلغاء':'Cancel Password'}</label>
                    <input 
                      type="password"
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500" 
                      value={branchSettings.cancel_password||''} 
                      onChange={e=>setBranchSettings({ ...branchSettings, cancel_password: e.target.value })} 
                      placeholder={lang==='ar'?'كلمة المرور لإلغاء العمليات':'Password for cancellation'}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
