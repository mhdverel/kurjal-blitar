import React, { useEffect, useRef, useState } from 'react'
import { createUserWithEmailAndPassword, deleteUser, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { Timestamp, addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import {
  BadgeCheck, Banknote, BarChart3, Bike, Box, Calculator, Check, ChevronRight,
  ClipboardList, Clock3, History, House, LayoutDashboard,
  Menu, PackageCheck, Plus, Search, Settings, UserRound, Users,
  WalletCards, X,
} from 'lucide-react'
import {
  ADMIN_PERCENTAGE, ORDER_TYPES, asDate, calculateAdminFee, formatDate,
  formatPeriod, formatTime, getCustomRange, getWeekRange, isInRange,
  isThisMonth, isToday, isValidOrder,
} from './ledger.js'
import { allowedPath, authErrorMessage } from './auth.js'
import {
  DEFAULT_DELIVERY_FEE_CONFIG, calculateDeliveryFee, isValidDeliveryFeeConfig,
  tariffFromData,
} from './delivery-fee.js'
import { auth, db, firebaseConfigured, persistenceReady } from './firebase.js'
import { downloadSettlementProof, uploadSettlementProof } from './r2.js'

const adminNav = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['drivers', 'Drivers', Users],
  ['orders', 'Orders', ClipboardList],
  ['reports', 'Laporan', BarChart3],
  ['settlements', 'Setoran', WalletCards],
  ['deliveryFee', 'Cek Ongkir', Calculator],
  ['settings', 'Pengaturan', Settings],
]

const driverNav = [
  ['home', 'Home', House],
  ['record', 'Catat', Plus],
  ['deliveryFee', 'Cek Ongkir', Calculator],
  ['history', 'Riwayat', History],
  ['settlement', 'Setoran', WalletCards],
  ['profile', 'Profil', UserRound],
]

const adminPaths = { dashboard: '/admin/dashboard', drivers: '/admin/drivers', orders: '/admin/orders', reports: '/admin/reports', settlements: '/admin/settlements', deliveryFee: '/admin/delivery-fee', settings: '/admin/settings' }
const driverPaths = { home: '/driver/dashboard', record: '/driver/record', deliveryFee: '/driver/delivery-fee', history: '/driver/history', settlement: '/driver/settlement', profile: '/driver/profile' }

const money = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
const sum = (items, key) => items.reduce((total, item) => total + Number(item[key] || 0), 0)
const typeLabel = (value) => ORDER_TYPES.find((type) => type.value === value)?.label || value
const accountLabels = { PENDING: 'Pending', APPROVED: 'Aktif', REJECTED: 'Ditolak', SUSPENDED: 'Ditangguhkan' }
const settlementLabels = { OPEN: 'Belum setor', WAITING_CONFIRMATION: 'Menunggu konfirmasi', PAID: 'Lunas', REJECTED: 'Ditolak' }

const initials = (name = '') => name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'DR'
const driverFromData = (id, data) => ({
  id, ...data, initials: initials(data.name), joined: formatDate(data.createdAt),
  vehicle: data.vehicle || 'Belum diisi', plate: data.plate || '—',
})
const orderFromSnapshot = (snapshot) => {
  const data = snapshot.data({ serverTimestamps: 'estimate' })
  const createdAt = asDate(data.createdAt)
  return {
    id: snapshot.id, ...data, createdAt,
    adminFee: calculateAdminFee(data.deliveryFee),
    date: formatDate(createdAt), time: formatTime(createdAt),
  }
}
const settlementRow = (driver, period, stored, orders) => {
  const own = orders.filter((order) => order.driverId === driver.id && isInRange(order.createdAt, period))
  return {
    id: `${period.key}_${driver.id}`, driverId: driver.id, driverName: driver.name,
    period: formatPeriod(period), orders: own.length, deliveryFee: sum(own, 'deliveryFee'),
    amount: sum(own, 'adminFee'), status: 'OPEN', ...stored,
  }
}

function StatusBadge({ status }) {
  const label = accountLabels[status] || settlementLabels[status] || status
  return <span className={`status status--${status.toLowerCase()}`}>{label}</span>
}

function usePath() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const sync = () => setPath(window.location.pathname)
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  const navigate = (nextPath, replace = false) => {
    if (nextPath === window.location.pathname) return setPath(nextPath)
    window.history[replace ? 'replaceState' : 'pushState']({}, '', nextPath)
    setPath(nextPath)
    window.scrollTo({ top: 0 })
  }
  return [path, navigate]
}

function App() {
  const [path, navigateTo] = usePath()
  const [session, setSession] = useState({ user: null, profile: null, loading: true, error: '' })
  const [orders, setOrders] = useState([])
  const [drivers, setDrivers] = useState([])
  const [settlements, setSettlements] = useState([])
  const [deliveryFeeConfig, setDeliveryFeeConfig] = useState(DEFAULT_DELIVERY_FEE_CONFIG)
  const [dataReady, setDataReady] = useState(false)
  const [dataError, setDataError] = useState('')
  const [actionBusy, setActionBusy] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [proofPreview, setProofPreview] = useState(null)
  const proofDialogRef = useRef(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => () => {
    if (proofPreview?.url) URL.revokeObjectURL(proofPreview.url)
  }, [proofPreview?.url])

  useEffect(() => {
    if (!firebaseConfigured) {
      setSession((current) => ({ ...current, loading: false, error: 'Firebase belum dikonfigurasi.' }))
      return undefined
    }
    let active = true
    let unsubscribeAuth = () => {}
    let unsubscribeProfile = () => {}
    persistenceReady.then(() => {
      if (!active) return
      unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        unsubscribeProfile()
        if (!active) return
        if (!user) return setSession({ user: null, profile: null, loading: false, error: '' })
        setSession((current) => ({ ...current, user, loading: true, error: '' }))
        unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
          if (!active) return
          if (!snapshot.exists()) return setSession({ user, profile: null, loading: false, error: authErrorMessage({ code: 'profile/not-found' }) })
          setSession({ user, profile: snapshot.data({ serverTimestamps: 'estimate' }), loading: false, error: '' })
        }, (error) => setSession({ user, profile: null, loading: false, error: authErrorMessage(error) }))
      }, (error) => setSession({ user: null, profile: null, loading: false, error: authErrorMessage(error) }))
    }).catch((error) => setSession({ user: null, profile: null, loading: false, error: authErrorMessage(error) }))
    return () => { active = false; unsubscribeProfile(); unsubscribeAuth() }
  }, [])

  useEffect(() => {
    setOrders([])
    setDrivers([])
    setSettlements([])
    setDataError('')
    if (!session.user || !session.profile || (session.profile.role !== 'ADMIN' && session.profile.accountStatus !== 'APPROVED')) {
      setDataReady(true)
      return undefined
    }

    setDataReady(false)
    const admin = session.profile.role === 'ADMIN'
    const expected = new Set(admin ? ['drivers', 'orders', 'settlements'] : ['orders', 'settlements'])
    const ready = (key) => { expected.delete(key); if (!expected.size) setDataReady(true) }
    const failed = (error) => { setDataError(authErrorMessage(error)); setDataReady(true) }
    const subscriptions = []

    if (admin) {
      subscriptions.push(onSnapshot(
        query(collection(db, 'users'), where('role', '==', 'DRIVER'), orderBy('createdAt', 'desc')),
        (snapshot) => { setDrivers(snapshot.docs.map((item) => driverFromData(item.id, item.data({ serverTimestamps: 'estimate' })))); ready('drivers') }, failed,
      ))
    }

    // ponytail: listeners are unbounded until measured read volume justifies date-window pagination.
    const orderQuery = admin
      ? query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'orders'), where('driverId', '==', session.user.uid), orderBy('createdAt', 'desc'))
    const settlementQuery = admin
      ? query(collection(db, 'settlements'), orderBy('weekStart', 'desc'))
      : query(collection(db, 'settlements'), where('driverId', '==', session.user.uid), orderBy('weekStart', 'desc'))
    subscriptions.push(onSnapshot(orderQuery, (snapshot) => { setOrders(snapshot.docs.map(orderFromSnapshot)); ready('orders') }, failed))
    subscriptions.push(onSnapshot(settlementQuery, (snapshot) => {
      setSettlements(snapshot.docs.map((item) => ({ id: item.id, ...item.data({ serverTimestamps: 'estimate' }) })))
      ready('settlements')
    }, failed))
    return () => subscriptions.forEach((unsubscribe) => unsubscribe())
  }, [session.user?.uid, session.profile?.role, session.profile?.accountStatus])

  useEffect(() => {
    setDeliveryFeeConfig(DEFAULT_DELIVERY_FEE_CONFIG)
    if (!session.user || !session.profile || (session.profile.role !== 'ADMIN' && session.profile.accountStatus !== 'APPROVED')) return undefined
    return onSnapshot(
      doc(db, 'settings', 'deliveryFee'),
      (snapshot) => setDeliveryFeeConfig(tariffFromData(snapshot.data())),
      () => setDeliveryFeeConfig(DEFAULT_DELIVERY_FEE_CONFIG),
    )
  }, [session.user?.uid, session.profile?.role, session.profile?.accountStatus])

  const publicPath = path === '/' || path === '/register'
  const canonicalPath = session.user ? allowedPath(path, session.profile) : publicPath ? path : '/'

  useEffect(() => {
    if (!session.loading && path !== canonicalPath) navigateTo(canonicalPath, true)
  }, [canonicalPath, path, session.loading])

  async function login(email, password) {
    if (!firebaseConfigured) throw Object.assign(new Error('Firebase not configured'), { code: 'firebase/not-configured' })
    await persistenceReady
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function registerDriver(form) {
    if (!firebaseConfigured) throw Object.assign(new Error('Firebase not configured'), { code: 'firebase/not-configured' })
    let credential
    try {
      credential = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password)
      const profile = {
        uid: credential.user.uid,
        driverId: credential.user.uid,
        email: form.email.trim(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        vehicle: form.vehicle.trim(),
        plate: form.plate.trim(),
        role: 'DRIVER',
        accountStatus: 'PENDING',
        createdAt: serverTimestamp(),
      }
      await setDoc(doc(db, 'users', credential.user.uid), profile)
      navigateTo('/waiting-approval', true)
    } catch (error) {
      if (credential?.user) await deleteUser(credential.user).catch(() => {})
      throw error
    }
  }

  async function logout() {
    await signOut(auth)
    setSession({ user: null, profile: null, loading: false, error: '' })
    navigateTo('/', true)
  }

  if (session.loading || path !== canonicalPath) return <SplashScreen />

  if (!session.user) return (
    <AccessShell action={path === '/register' ? <button className="text-button" onClick={() => navigateTo('/')}>Kembali ke login</button> : null}>
      {path === '/register'
        ? <RegistrationPage onSubmit={registerDriver} />
        : <LoginPage onLogin={login} onRegister={() => navigateTo('/register')} configurationError={session.error} />}
    </AccessShell>
  )

  if (path === '/waiting-approval' || path === '/access-denied') return (
    <AccessShell action={<button className="text-button" onClick={logout}>Keluar</button>}>
      <ApplicationStatus profile={session.profile} error={session.error} />
    </AccessShell>
  )

  if (!dataReady) return <SplashScreen message="Menyinkronkan data operasional…" />
  if (dataError) return <AccessShell action={<button className="text-button" onClick={logout}>Keluar</button>}><ApplicationStatus error={dataError} /></AccessShell>

  const role = session.profile.role
  const paths = role === 'ADMIN' ? adminPaths : driverPaths
  const page = Object.entries(paths).find(([, route]) => route === path)?.[0] || (role === 'ADMIN' ? 'dashboard' : 'home')
  const nav = role === 'ADMIN' ? adminNav : driverNav
  const driverId = session.profile.driverId || session.user.uid
  const currentDriver = drivers.find((driver) => driver.id === driverId) || driverFromData(driverId, session.profile)
  const driverOrders = orders.filter((order) => order.driverId === driverId)
  const activePeriod = getWeekRange(now)
  const duePeriod = getWeekRange(now, -1)
  const dueSettlements = settlements.filter((item) => item.weekKey === duePeriod.key)
  const currentSettlement = settlementRow(currentDriver, duePeriod, dueSettlements.find((item) => item.driverId === driverId), driverOrders)
  const settlementRows = drivers
    .filter((driver) => driver.accountStatus === 'APPROVED' || dueSettlements.some((item) => item.driverId === driver.id))
    .map((driver) => settlementRow(driver, duePeriod, dueSettlements.find((item) => item.driverId === driver.id), orders))
    .filter((item) => item.orders > 0 || item.status !== 'OPEN')
  const navigate = (nextPage) => { navigateTo(paths[nextPage]); setMenuOpen(false) }

  async function updateDriverStatus(id, accountStatus) {
    if (actionBusy) return
    setActionBusy(`driver:${id}`)
    try {
      await updateDoc(doc(db, 'users', id), { accountStatus })
      setNotice(`Status driver diperbarui menjadi ${accountLabels[accountStatus]}.`)
    } catch (error) {
      setNotice(authErrorMessage(error))
    } finally {
      setActionBusy('')
    }
  }

  async function saveOrder(form) {
    const data = {
      driverId, driverName: currentDriver.name, customerName: form.customerName.trim(),
      orderType: form.orderType, deliveryFee: Number(form.deliveryFee),
      notes: form.notes.trim(), createdAt: serverTimestamp(),
    }
    const reference = await addDoc(collection(db, 'orders'), data)
    return { id: reference.id, ...data, adminFee: calculateAdminFee(data.deliveryFee) }
  }

  async function submitSettlement(file) {
    if (!file?.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      throw Object.assign(new Error('Invalid proof'), { code: 'r2/invalid-proof' })
    }
    // ponytail: deterministic path makes an interrupted Firestore write recoverable by retrying.
    const proofPath = await uploadSettlementProof(session.user, duePeriod.key, file)
    await setDoc(doc(db, 'settlements', `${duePeriod.key}_${driverId}`), {
      driverId, weekKey: duePeriod.key,
      weekStart: Timestamp.fromDate(duePeriod.start), weekEnd: Timestamp.fromDate(duePeriod.end),
      proofPath, status: 'WAITING_CONFIRMATION', submittedAt: serverTimestamp(),
      reviewedAt: null, reviewedBy: '',
    })
  }

  async function viewSettlementProof(proofPath, driverName) {
    if (actionBusy) return
    setActionBusy(`proof:${proofPath}`)
    try {
      const url = URL.createObjectURL(await downloadSettlementProof(session.user, proofPath))
      setProofPreview({ url, driverName })
      proofDialogRef.current?.showModal()
    } catch (error) {
      setNotice(authErrorMessage(error))
    } finally {
      setActionBusy('')
    }
  }

  async function updateSettlement(id, status) {
    if (actionBusy) return
    setActionBusy(`settlement:${id}`)
    try {
      await updateDoc(doc(db, 'settlements', id), {
        status, reviewedAt: serverTimestamp(), reviewedBy: session.user.uid,
      })
      setNotice(`Status setoran diperbarui menjadi ${settlementLabels[status]}.`)
    } catch (error) {
      setNotice(authErrorMessage(error))
    } finally {
      setActionBusy('')
    }
  }

  async function saveDeliveryFeeConfig(config) {
    if (!isValidDeliveryFeeConfig(config)) throw new Error('Invalid delivery fee config')
    await setDoc(doc(db, 'settings', 'deliveryFee'), {
      ...config, updatedAt: serverTimestamp(), updatedBy: session.user.uid,
    })
    setNotice('Tarif ongkir berhasil disimpan.')
  }

  return (
    <div className="app-shell">
      <Sidebar role={role} page={page} nav={nav} open={menuOpen} onNavigate={navigate} onClose={() => setMenuOpen(false)} />
      <div className="workspace">
        <Topbar role={role} page={page} onMenu={() => setMenuOpen(true)} onLogout={logout} onRecord={() => navigate('record')} />
        <main id="main-content" className="main-content">
          {role === 'ADMIN'
            ? <AdminPages page={page} orders={orders} drivers={drivers} settlements={settlementRows} period={activePeriod} duePeriod={duePeriod} busy={actionBusy} deliveryFeeConfig={deliveryFeeConfig} onNavigate={navigate} onDriverStatus={updateDriverStatus} onSettlement={updateSettlement} onProof={viewSettlementProof} onSaveDeliveryFee={saveDeliveryFeeConfig} />
            : <DriverPages page={page} driver={currentDriver} orders={driverOrders} settlement={currentSettlement} period={activePeriod} duePeriod={duePeriod} deliveryFeeConfig={deliveryFeeConfig} onNavigate={navigate} onSaveOrder={saveOrder} onSettlement={submitSettlement} />}
        </main>
        <MobileNav page={page} nav={nav} onNavigate={navigate} />
      </div>
      <dialog
        aria-labelledby="proof-dialog-title"
        className="proof-dialog"
        ref={proofDialogRef}
        onClose={() => setProofPreview(null)}
        onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close() }}
      >
        <div className="proof-dialog__body">
          <div className="dialog__head">
            <div><span className="eyebrow">Bukti setoran</span><h2 id="proof-dialog-title">{proofPreview?.driverName || 'Driver'}</h2></div>
            <button className="icon-button" type="button" aria-label="Tutup bukti setoran" onClick={() => proofDialogRef.current?.close()}><X size={19} /></button>
          </div>
          {proofPreview && <img src={proofPreview.url} alt={`Bukti setoran ${proofPreview.driverName}`} onError={() => { setNotice('Bukti setoran tidak dapat ditampilkan.'); proofDialogRef.current?.close() }} />}
        </div>
      </dialog>
      {notice && <div className="toast" role="status"><Check size={16} />{notice}<button aria-label="Tutup notifikasi" onClick={() => setNotice('')}><X size={15} /></button></div>}
    </div>
  )
}

function Sidebar({ role, page, nav, open, onNavigate, onClose }) {
  return <>
    {open && <button className="sidebar-scrim" aria-label="Tutup menu" onClick={onClose} />}
    <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
      <Brand />
      <div className="sidebar__role">Ruang kerja · {role === 'ADMIN' ? 'Admin' : 'Driver'}</div>
      <nav aria-label="Navigasi utama">{nav.map(([key, label, Icon]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => onNavigate(key)}><Icon size={18} /><span>{label}</span></button>)}</nav>
      <div className="sidebar__note"><Clock3 size={17} /><span>Periode setoran<br /><b>Minggu–Sabtu</b></span></div>
    </aside>
  </>
}

function Brand() {
  return <div className="brand"><span className="brand__mark"><Bike size={22} /></span><span><b>KURJAL</b><small>BLITAR</small></span></div>
}

function Topbar({ role, page, onMenu, onLogout, onRecord }) {
  const title = [...adminNav, ...driverNav].find(([key]) => key === page)?.[1] || 'KURJAL'
  return <header className="topbar">
    <button className="icon-button topbar__menu" aria-label="Buka menu" onClick={onMenu}><Menu size={20} /></button>
    <div className="topbar__title"><span>{role === 'ADMIN' ? 'Admin' : 'Driver'}</span><b>{title}</b></div>
    <button className="text-button topbar__logout" onClick={onLogout}>Keluar</button>
    {role === 'DRIVER' && <button className="button button--primary topbar__cta" onClick={onRecord}><Plus size={16} />Catat order</button>}
  </header>
}

function MobileNav({ page, nav, onNavigate }) {
  return <nav className="mobile-nav" aria-label="Navigasi bawah">{nav.slice(0, 5).map(([key, label, Icon]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => onNavigate(key)}><Icon size={19} /><span>{label}</span></button>)}</nav>
}

function PageHeader({ eyebrow, title, description, action }) {
  return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>
}

function Metric({ label, value, detail, icon: Icon = Banknote, tone = '' }) {
  return <article className={`metric ${tone}`}><div className="metric__icon"><Icon size={18} /></div><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</article>
}

function AdminPages(props) {
  if (props.page === 'drivers') return <DriversPage {...props} />
  if (props.page === 'orders') return <OrdersPage orders={props.orders} drivers={props.drivers} />
  if (props.page === 'reports') return <ReportsPage orders={props.orders} drivers={props.drivers} period={props.period} />
  if (props.page === 'settlements') return <AdminSettlements items={props.settlements} period={props.duePeriod} busy={props.busy} onUpdate={props.onSettlement} onProof={props.onProof} />
  if (props.page === 'deliveryFee') return <DeliveryFeePage config={props.deliveryFeeConfig} />
  if (props.page === 'settings') return <SettingsPage config={props.deliveryFeeConfig} onSave={props.onSaveDeliveryFee} />
  return <AdminDashboard {...props} />
}

function AdminDashboard({ orders, drivers, settlements, period, onNavigate }) {
  const today = orders.filter((order) => isToday(order.createdAt))
  const week = orders.filter((order) => isInRange(order.createdAt, period))
  const pending = drivers.filter((driver) => driver.accountStatus === 'PENDING')
  const approved = drivers.filter((driver) => driver.accountStatus === 'APPROVED')
  return <div className="page-stack">
    <PageHeader eyebrow="Ringkasan operasional" title="Selamat siang, Admin." description="Order dibagikan melalui WhatsApp; dashboard ini khusus pencatatan dan monitoring." action={<button className="button button--secondary" onClick={() => onNavigate('deliveryFee')}><Calculator size={16} />Cek ongkir</button>} />
    <section className="metric-grid metric-grid--four">
      <Metric label="Driver aktif" value={approved.length} detail="Akun disetujui" icon={Users} />
      <Metric label="Order hari ini" value={today.length} detail={`${money(sum(today, 'deliveryFee'))} total ongkir`} icon={PackageCheck} />
      <Metric label="Total ongkir" value={money(sum(today, 'deliveryFee'))} detail="Hari ini" />
      <Metric label="Setoran 10%" value={money(sum(today, 'adminFee'))} detail="Terbentuk otomatis" icon={WalletCards} tone="metric--accent" />
    </section>
    <section className="dashboard-grid">
      <div className="panel panel--wide"><div className="panel__head"><div><span className="eyebrow">Catatan terbaru</span><h2>Order hari ini</h2></div><span className="quiet-label">{today.length} catatan</span></div><OrderList orders={today.slice(0, 5)} showDriver /></div>
      <div className="panel attention-panel"><div className="panel__head"><div><span className="eyebrow">Perlu tindakan</span><h2>Antrian admin</h2></div></div><AttentionRow count={pending.length} label="Pendaftaran driver" detail="Perlu ditinjau" /><AttentionRow count={settlements.filter((item) => item.status === 'WAITING_CONFIRMATION').length} label="Bukti setoran" detail="Menunggu konfirmasi" /><AttentionRow count={settlements.filter((item) => item.status === 'OPEN').length} label="Setoran terbuka" detail="Belum disetor" /></div>
    </section>
    <section className="week-band"><div><span className="eyebrow">Minggu berjalan · {formatPeriod(period)}</span><h2>{week.length} order tercatat</h2></div><dl><div><dt>Total ongkir</dt><dd>{money(sum(week, 'deliveryFee'))}</dd></div><div><dt>Setoran 10%</dt><dd>{money(sum(week, 'adminFee'))}</dd></div></dl></section>
  </div>
}

function AttentionRow({ count, label, detail }) {
  return <div className="attention-row"><strong>{count}</strong><span><b>{label}</b><small>{detail}</small></span><ChevronRight size={17} /></div>
}

function OrderList({ orders, showDriver = false, onSelect }) {
  if (!orders.length) return <EmptyState title="Belum ada catatan" detail="Data order akan muncul di sini setelah disimpan driver." />
  return <div className="order-list">{orders.map((order) => <button className="order-row" key={order.id} onClick={() => onSelect?.(order)} disabled={!onSelect}><span className={`type-mark type-mark--${order.orderType.toLowerCase()}`}>{typeLabel(order.orderType).slice(0, 1)}</span><span className="order-row__main"><b>{order.customerName}</b><small>{typeLabel(order.orderType)}{showDriver ? ` · ${order.driverName}` : ''}</small></span><span className="order-row__meta"><b>{money(order.deliveryFee)}</b><small>{order.time}</small></span>{onSelect && <ChevronRight size={17} />}</button>)}</div>
}

function DriversPage({ drivers, orders, busy, onDriverStatus }) {
  const [search, setSearch] = useState('')
  const pending = drivers.filter((driver) => driver.accountStatus === 'PENDING')
  const visible = drivers.filter((driver) => driver.accountStatus !== 'PENDING' && `${driver.name} ${driver.phone} ${driver.email} ${driver.vehicle} ${driver.plate}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="page-stack">
    <PageHeader eyebrow="Akun & akses" title="Kelola driver" description="Driver baru hanya dapat masuk setelah pendaftarannya disetujui admin." />
    <section className="panel"><div className="panel__head"><div><span className="eyebrow">Pendaftaran baru</span><h2>Menunggu persetujuan</h2></div><span className="count-chip">{pending.length}</span></div>{pending.length ? <div className="approval-list">{pending.map((driver) => <div className="approval-row" key={driver.id}><Avatar driver={driver} /><div><b>{driver.name}</b><small>{driver.phone} · {driver.vehicle} · {driver.plate}</small></div><StatusBadge status={driver.accountStatus} /><div className="row-actions"><button className="button button--secondary" disabled={Boolean(busy)} onClick={() => onDriverStatus(driver.id, 'REJECTED')}>Tolak</button><button className="button button--primary" disabled={Boolean(busy)} onClick={() => onDriverStatus(driver.id, 'APPROVED')}><Check size={15} />Setujui</button></div></div>)}</div> : <EmptyState title="Antrian kosong" detail="Tidak ada pendaftaran yang menunggu persetujuan." />}</section>
    <section className="panel"><div className="panel__head"><div><span className="eyebrow">Direktori</span><h2>Semua driver</h2></div><label className="compact-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Cari driver" placeholder="Cari driver" /></label></div>{visible.length ? <div className="driver-grid">{visible.map((driver) => { const driverOrders = orders.filter((order) => order.driverId === driver.id); return <article className="driver-card" key={driver.id}><div className="driver-card__head"><Avatar driver={driver} /><StatusBadge status={driver.accountStatus} /></div><h3>{driver.name}</h3><p>{driver.vehicle} · {driver.plate}</p><dl><div><dt>Order</dt><dd>{driverOrders.length}</dd></div><div><dt>Total ongkir</dt><dd>{money(sum(driverOrders, 'deliveryFee'))}</dd></div><div><dt>Setoran</dt><dd>{money(sum(driverOrders, 'adminFee'))}</dd></div></dl><button className="text-button" disabled={Boolean(busy)} onClick={() => onDriverStatus(driver.id, driver.accountStatus === 'SUSPENDED' ? 'APPROVED' : 'SUSPENDED')}>{driver.accountStatus === 'SUSPENDED' ? 'Aktifkan kembali' : 'Tangguhkan akun'}</button></article> })}</div> : <EmptyState title="Driver tidak ditemukan" detail="Ubah kata pencarian atau tunggu driver mendaftar." />}</section>
  </div>
}

function Avatar({ driver }) { return <span className="avatar" aria-hidden="true">{driver.initials}</span> }

function OrdersPage({ orders, drivers }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('ALL')
  const [driverId, setDriverId] = useState('ALL')
  const [selected, setSelected] = useState(null)
  const filtered = orders.filter((order) => (type === 'ALL' || order.orderType === type) && (driverId === 'ALL' || order.driverId === driverId) && `${order.customerName} ${order.driverName} ${order.id}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="page-stack">
    <PageHeader eyebrow="Ledger order" title="Seluruh catatan order" description="Catatan yang dibuat driver setelah order selesai dikerjakan." />
    <div className="filter-bar"><label className="compact-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Cari order" placeholder="Customer, driver, ID" /></label><label><span>Tipe</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="ALL">Semua tipe</option>{ORDER_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span>Driver</span><select value={driverId} onChange={(event) => setDriverId(event.target.value)}><option value="ALL">Semua driver</option>{drivers.filter((driver) => driver.accountStatus === 'APPROVED').map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label></div>
    <section className="panel orders-layout"><div><div className="panel__head"><div><span className="eyebrow">Hasil</span><h2>{filtered.length} catatan</h2></div></div><OrderList orders={filtered} showDriver onSelect={setSelected} /></div><OrderDetail order={selected || filtered[0]} /></section>
  </div>
}

function OrderDetail({ order }) {
  if (!order) return <aside className="detail-panel"><EmptyState title="Pilih catatan" detail="Detail order akan tampil di sini." /></aside>
  return <aside className="detail-panel"><span className="eyebrow">Detail catatan</span><h2>{order.customerName}</h2><p className="detail-id">{order.id}</p><dl className="detail-list"><div><dt>Driver</dt><dd>{order.driverName}</dd></div><div><dt>Tipe order</dt><dd>{typeLabel(order.orderType)}</dd></div><div><dt>Jumlah ongkir</dt><dd>{money(order.deliveryFee)}</dd></div><div><dt>Setoran 10%</dt><dd>{money(order.adminFee)}</dd></div><div><dt>Waktu</dt><dd>{order.date}, {order.time}</dd></div><div><dt>Catatan</dt><dd>{order.notes || 'Tidak ada catatan'}</dd></div></dl></aside>
}

function ReportsPage({ orders, drivers, period }) {
  const [range, setRange] = useState('WEEK')
  const [dates, setDates] = useState({ start: '', end: '' })
  const custom = getCustomRange(dates.start, dates.end)
  const data = orders.filter((order) => {
    if (range === 'TODAY') return isToday(order.createdAt)
    if (range === 'WEEK') return isInRange(order.createdAt, period)
    if (range === 'MONTH') return isThisMonth(order.createdAt)
    return custom ? isInRange(order.createdAt, custom) : false
  })
  return <div className="page-stack">
    <PageHeader eyebrow="Rekap operasional" title="Laporan" description="Ringkasan order, ongkir, dan setoran berdasarkan catatan driver." />
    <div className="segmented">{[['TODAY', 'Harian'], ['WEEK', 'Mingguan'], ['MONTH', 'Bulanan'], ['CUSTOM', 'Custom']].map(([key, label]) => <button key={key} className={range === key ? 'active' : ''} onClick={() => setRange(key)}>{label}</button>)}</div>
    {range === 'CUSTOM' && <div className="date-range"><label>Dari<input type="date" value={dates.start} onChange={(event) => setDates({ ...dates, start: event.target.value })} /></label><label>Sampai<input type="date" min={dates.start} value={dates.end} onChange={(event) => setDates({ ...dates, end: event.target.value })} /></label></div>}
    <section className="metric-grid metric-grid--three"><Metric label="Total order" value={data.length} icon={ClipboardList} /><Metric label="Total ongkir" value={money(sum(data, 'deliveryFee'))} /><Metric label="Total setoran" value={money(sum(data, 'adminFee'))} icon={WalletCards} tone="metric--accent" /></section>
    <section className="report-grid"><div className="panel"><div className="panel__head"><div><span className="eyebrow">Per driver</span><h2>Kontribusi periode</h2></div></div><div className="data-list">{drivers.filter((driver) => driver.accountStatus === 'APPROVED').map((driver) => { const own = data.filter((order) => order.driverId === driver.id); return <div key={driver.id}><span><b>{driver.name}</b><small>{own.length} order</small></span><strong>{money(sum(own, 'deliveryFee'))}</strong></div> })}</div></div><div className="panel"><div className="panel__head"><div><span className="eyebrow">Per tipe</span><h2>Komposisi order</h2></div></div><div className="type-report">{ORDER_TYPES.map((type) => { const count = data.filter((order) => order.orderType === type.value).length; return <div key={type.value}><span>{type.label}</span><div><i style={{ width: `${data.length ? (count / data.length) * 100 : 0}%` }} /></div><b>{count}</b></div> })}</div></div></section>
  </div>
}

function AdminSettlements({ items, period, busy, onUpdate, onProof }) {
  return <div className="page-stack"><PageHeader eyebrow="Setoran mingguan" title="Settlement driver" description="Konfirmasi setoran 10% untuk periode Minggu–Sabtu yang sudah ditutup." /><section className="metric-grid metric-grid--three"><Metric label="Belum setor" value={items.filter((item) => item.status === 'OPEN').length} /><Metric label="Menunggu konfirmasi" value={items.filter((item) => item.status === 'WAITING_CONFIRMATION').length} icon={Clock3} /><Metric label="Lunas" value={items.filter((item) => item.status === 'PAID').length} icon={BadgeCheck} tone="metric--accent" /></section><section className="panel"><div className="panel__head"><div><span className="eyebrow">Periode terakhir</span><h2>{formatPeriod(period)}</h2></div></div>{items.length ? <div className="settlement-list">{items.map((item) => <article key={item.id} className="settlement-row"><Avatar driver={{ initials: initials(item.driverName) }} /><div><b>{item.driverName}</b><small>{item.orders} order · {money(item.deliveryFee)} ongkir</small></div><strong>{money(item.amount)}</strong><StatusBadge status={item.status} />{item.status === 'WAITING_CONFIRMATION' && <div className="row-actions"><button className="button button--secondary" disabled={Boolean(busy)} onClick={() => onProof(item.proofPath, item.driverName)}>{busy === `proof:${item.proofPath}` ? 'Memuat…' : 'Lihat bukti'}</button><button className="button button--secondary" disabled={Boolean(busy)} onClick={() => onUpdate(item.id, 'REJECTED')}>Tolak</button><button className="button button--primary" disabled={Boolean(busy)} onClick={() => onUpdate(item.id, 'PAID')}><Check size={15} />Konfirmasi</button></div>}</article>)}</div> : <EmptyState title="Belum ada kewajiban setoran" detail="Setoran muncul setelah driver memiliki order pada periode ini." />}</section></div>
}

function DeliveryFeePage({ config }) {
  return <div className="page-stack delivery-fee-page"><PageHeader eyebrow="Kalkulator" title="Cek ongkir" description="Hitung estimasi tanpa membuat atau mengubah catatan order." /><DeliveryFeeCalculator config={config} /></div>
}

function DeliveryFeeCalculator({ config, onUse }) {
  const [form, setForm] = useState({ distanceKm: '', serviceTime: '', serviceType: 'DELIVERY', cargoType: 'NORMAL', tripType: 'ONE_WAY' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const update = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setResult(null)
    setError('')
  }
  function submit(event) {
    event.preventDefault()
    const calculated = calculateDeliveryFee(form, config)
    if (!calculated) return setError('Masukkan jarak lebih dari 0 km dan waktu layanan yang valid.')
    setError('')
    setResult(calculated)
  }
  const cargoLabel = form.cargoType === 'HEAVY' ? 'Tambahan barang berat' : 'Tambahan obrok'
  return <section className="panel delivery-fee-panel"><form className="delivery-fee-form" onSubmit={submit}><label>Jarak<span className="unit-input"><input name="distanceKm" type="number" inputMode="decimal" min="0.01" step="any" value={form.distanceKm} onChange={update} placeholder="5.3" required /><b>KM</b></span></label><label>Jenis layanan<select name="serviceType" value={form.serviceType} onChange={update}><option value="DELIVERY">Pengiriman</option><option value="RIDE">Ojek</option><option value="CAKE">Kue Tart (1 tangan)</option></select></label><label>Waktu layanan<input name="serviceTime" type="time" value={form.serviceTime} onChange={update} required /></label>{form.serviceType === 'DELIVERY' && <label>Kondisi barang<select name="cargoType" value={form.cargoType} onChange={update}><option value="NORMAL">Normal</option><option value="HEAVY">Berat / Sulit Dibawa</option><option value="OBROK">Menggunakan Obrok</option></select></label>}{form.serviceType === 'RIDE' && <label>Jenis perjalanan<select name="tripType" value={form.tripType} onChange={update}><option value="ONE_WAY">Sekali Jalan</option><option value="ROUND_TRIP">Pulang Pergi</option></select></label>}{error && <p className="form-error" role="alert">{error}</p>}<button className="button button--primary button--full">Hitung ongkir</button></form>{result ? <output className="fee-result" aria-live="polite"><span className="eyebrow">Hasil perhitungan</span><dl><div><dt>Jarak</dt><dd>{result.distanceKm} km</dd></div><div><dt>Ongkir dasar</dt><dd>{money(result.rawBaseFee)}</dd></div>{result.roundingAdjustment > 0 && <div><dt>Pembulatan</dt><dd>+{money(result.roundingAdjustment)}</dd></div>}{result.cargoSurcharge > 0 && <div><dt>{cargoLabel}</dt><dd>{money(result.cargoSurcharge)}</dd></div>}{result.rideSurcharge > 0 && <div><dt>Tambahan ojek</dt><dd>{money(result.rideSurcharge)}</dd></div>}{result.cakeSurcharge > 0 && <div><dt>Tambahan Kue Tart</dt><dd>{money(result.cakeSurcharge)}</dd></div>}{result.multiplier > 1 && <div><dt>Pulang pergi</dt><dd>× {result.multiplier}</dd></div>}{result.timeSurcharge > 0 && <div><dt>{form.serviceTime < '05:00' ? 'Tambahan setelah 00.00' : 'Tambahan setelah 22.00'}</dt><dd>{money(result.timeSurcharge)}</dd></div>}</dl><div className="fee-result__total"><span>Total ongkir</span><strong>{money(result.totalFee)}</strong></div>{onUse && <button type="button" className="button button--primary button--full" onClick={() => onUse(result.totalFee)}>Gunakan ongkir ini</button>}</output> : <aside className="fee-placeholder"><Calculator size={24} /><b>Hasil akan tampil di sini</b><small>Tarif aktif diterapkan saat tombol Hitung ongkir ditekan.</small></aside>}<p className="fee-warning" role="note">Jumlah ongkir belum termasuk biaya parkir.</p></section>
}

function SettingsPage({ config, onSave }) {
  const [form, setForm] = useState(() => Object.fromEntries(Object.entries(config).map(([key, value]) => [key, String(value)])))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => setForm(Object.fromEntries(Object.entries(config).map(([key, value]) => [key, String(value)]))), [config])
  const fields = [
    ['upTo4Km', 'Sampai 4 km', 'Rp'], ['upTo5Km', 'Sampai 5 km', 'Rp'], ['upTo6Km', 'Sampai 6 km', 'Rp'],
    ['additionalPerKm', 'Tambahan per km', 'Rp'], ['heavySurcharge', 'Barang berat', 'Rp'], ['obrokSurcharge', 'Obrok', 'Rp'],
    ['rideSurcharge', 'Ojek', 'Rp'], ['cakeSurcharge', 'Kue Tart (1 tangan)', 'Rp'],
    ['after10PmSurcharge', 'Setelah 22.00', 'Rp'], ['afterMidnightSurcharge', '00.00–04.59', 'Rp'],
    ['roundTripMultiplier', 'Pulang pergi', '×'],
  ]
  async function submit(event) {
    event.preventDefault()
    const values = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, Number(value)]))
    if (!isValidDeliveryFeeConfig(values)) return setError('Gunakan bilangan bulat nonnegatif, tarif dasar berurutan, dan pengali 1–10.')
    setSaving(true)
    setError('')
    try { await onSave(values) } catch (saveError) { setError(authErrorMessage(saveError)) } finally { setSaving(false) }
  }
  return <div className="page-stack"><PageHeader eyebrow="Konfigurasi" title="Pengaturan" description="Aturan inti pencatatan dan settlement KURJAL." /><section className="panel settings-panel"><div><span className="eyebrow">Setoran</span><h2>Persentase admin</h2><p>Dihitung otomatis dari ongkir setiap order.</p></div><label className="percentage-field"><input value={ADMIN_PERCENTAGE * 100} readOnly /><span>%</span></label><div className="settings-rule"><Clock3 size={19} /><span><b>Periode mingguan</b><small>Minggu 00.00 – Sabtu 23.59 · Asia/Jakarta</small></span></div><div className="settings-rule"><BadgeCheck size={19} /><span><b>Data order</b><small>Catatan yang tersimpan menjadi ledger tetap dan tidak dapat diubah atau dihapus.</small></span></div></section><section className="panel"><div className="panel__head"><div><span className="eyebrow">Tarif ongkir</span><h2>Nominal kalkulator</h2></div></div><form className="tariff-form" onSubmit={submit}>{fields.map(([key, label, prefix]) => <label key={key}>{label}<span className="tariff-input"><b>{prefix}</b><input name={key} type="number" min={key === 'roundTripMultiplier' ? '1' : '0'} max={key === 'roundTripMultiplier' ? '10' : undefined} step="1" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} required /></span></label>)}{error && <p className="form-error" role="alert">{error}</p>}<button className="button button--primary" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan tarif'}</button></form></section></div>
}

function DriverPages({ page, driver, orders, settlement, period, duePeriod, deliveryFeeConfig, onNavigate, onSaveOrder, onSettlement }) {
  if (page === 'record') return <RecordOrderPage driver={driver} config={deliveryFeeConfig} onSave={onSaveOrder} onNavigate={onNavigate} />
  if (page === 'deliveryFee') return <DeliveryFeePage config={deliveryFeeConfig} />
  if (page === 'history') return <HistoryPage orders={orders} period={period} />
  if (page === 'settlement') return <DriverSettlement orders={orders} settlement={settlement} activePeriod={period} duePeriod={duePeriod} onUpdate={onSettlement} />
  if (page === 'profile') return <ProfilePage driver={driver} />
  return <DriverHome driver={driver} orders={orders} settlement={settlement} period={period} onNavigate={onNavigate} />
}

function DriverHome({ driver, orders, settlement, period, onNavigate }) {
  const today = orders.filter((order) => isToday(order.createdAt))
  const week = orders.filter((order) => isInRange(order.createdAt, period))
  return <div className="page-stack"><PageHeader eyebrow="Dashboard driver" title={`Halo, ${driver?.name || 'Driver'}.`} description="Catat order yang sudah selesai agar rekap mingguan selalu akurat." action={<button className="button button--primary desktop-only" onClick={() => onNavigate('record')}><Plus size={16} />Catat order</button>} /><section className="driver-hero"><div><span className="eyebrow">Hari ini</span><strong>{today.length}</strong><p>order tercatat</p></div><dl><div><dt>Total ongkir</dt><dd>{money(sum(today, 'deliveryFee'))}</dd></div><div><dt>Setoran 10%</dt><dd>{money(sum(today, 'adminFee'))}</dd></div></dl><button className="button button--light" onClick={() => onNavigate('record')}><Plus size={17} />Catat order baru</button></section><section className="metric-grid metric-grid--three"><Metric label="Order minggu ini" value={week.length} icon={ClipboardList} /><Metric label="Ongkir minggu ini" value={money(sum(week, 'deliveryFee'))} /><article className="metric metric--status"><span>Setoran periode lalu</span><StatusBadge status={settlement.status} /><strong>{money(settlement.amount)}</strong><small>{settlement.period}</small></article></section><section className="panel"><div className="panel__head"><div><span className="eyebrow">Terbaru</span><h2>Riwayat order</h2></div><button className="text-button" onClick={() => onNavigate('history')}>Lihat semua</button></div><OrderList orders={orders.slice(0, 5)} /></section></div>
}

const emptyOrder = { customerName: '', orderType: 'FOOD', deliveryFee: '', notes: '' }

function RecordOrderPage({ driver, config, onSave, onNavigate }) {
  const [form, setForm] = useState(emptyOrder)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const dialogRef = useRef(null)
  const feeDialogRef = useRef(null)
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  function review(event) {
    event.preventDefault()
    if (!isValidOrder(form)) return setError('Lengkapi nama customer, tipe order, dan ongkir lebih dari Rp0.')
    setError('')
    dialogRef.current?.showModal()
  }

  async function confirm() {
    setSubmitting(true)
    setError('')
    try {
      const order = await onSave(form)
      dialogRef.current?.close()
      setSuccess(order)
      setForm(emptyOrder)
    } catch (saveError) {
      dialogRef.current?.close()
      setError(authErrorMessage(saveError))
    } finally {
      setSubmitting(false)
    }
  }

  if (success) return <div className="page-stack"><PageHeader eyebrow="Catat order" title="Order berhasil disimpan" /><section className="success-panel"><span className="success-mark"><Check size={28} /></span><h2>Catatan sudah masuk</h2><p>{success.customerName} · {typeLabel(success.orderType)} · {money(success.deliveryFee)}</p><div><button className="button button--secondary" onClick={() => setSuccess(null)}><Plus size={16} />Catat lagi</button><button className="button button--primary" onClick={() => onNavigate('home')}>Kembali ke Home</button></div></section></div>

  return <div className="page-stack record-page"><PageHeader eyebrow="Catatan selesai" title="Catat order" description="Masukkan order setelah selesai dikerjakan. Setoran 10% dihitung otomatis." /><section className="panel form-panel"><form onSubmit={review} className="order-form"><label>Nama customer<span>Wajib</span><input autoFocus name="customerName" maxLength="80" value={form.customerName} onChange={change} placeholder="Contoh: Budi Santoso" /></label><label>Tipe order<span>Wajib</span><select name="orderType" value={form.orderType} onChange={change}>{ORDER_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label>Jumlah ongkir<span>Wajib</span><div className="money-input"><b>Rp</b><input name="deliveryFee" value={form.deliveryFee} onChange={change} type="number" inputMode="numeric" min="1" max="10000000" placeholder="0" /></div><small>Setoran: {money(calculateAdminFee(form.deliveryFee || 0))}</small></label><button className="button button--secondary button--full" type="button" onClick={() => feeDialogRef.current?.showModal()}><Calculator size={16} />Cek ongkir</button><label>Catatan<span>Opsional</span><textarea name="notes" maxLength="500" value={form.notes} onChange={change} rows="4" placeholder="Informasi tambahan tentang order" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button--primary button--full" type="submit" disabled={submitting}>{submitting ? 'Menyimpan…' : 'Simpan order'}</button></form><aside className="form-note"><BadgeCheck size={22} /><h3>Sebelum menyimpan</h3><p>Pastikan customer, tipe, dan ongkir sudah benar. Anda akan melihat konfirmasi terlebih dahulu.</p></aside></section><dialog className="confirm-dialog" ref={dialogRef}><form method="dialog"><div className="dialog__head"><div><span className="eyebrow">Konfirmasi</span><h2>Simpan catatan order?</h2></div><button className="icon-button" aria-label="Tutup" disabled={submitting}><X size={19} /></button></div><dl className="confirm-list"><div><dt>Customer</dt><dd>{form.customerName}</dd></div><div><dt>Tipe order</dt><dd>{typeLabel(form.orderType)}</dd></div><div><dt>Jumlah ongkir</dt><dd>{money(Number(form.deliveryFee || 0))}</dd></div><div><dt>Setoran 10%</dt><dd>{money(calculateAdminFee(form.deliveryFee || 0))}</dd></div><div><dt>Catatan</dt><dd>{form.notes || 'Tidak ada catatan'}</dd></div></dl><div className="dialog__actions"><button className="button button--secondary" disabled={submitting}>Periksa lagi</button><button className="button button--primary" type="button" disabled={submitting} onClick={confirm}><Check size={16} />{submitting ? 'Menyimpan…' : 'Simpan'}</button></div></form></dialog><dialog className="fee-dialog" ref={feeDialogRef} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close() }}><div className="dialog__head"><div><span className="eyebrow">Catat order</span><h2>Cek ongkir</h2></div><button className="icon-button" type="button" aria-label="Tutup kalkulator" onClick={() => feeDialogRef.current?.close()}><X size={19} /></button></div><DeliveryFeeCalculator config={config} onUse={(totalFee) => { setForm((current) => ({ ...current, deliveryFee: String(totalFee) })); feeDialogRef.current?.close() }} /></dialog></div>
}

function HistoryPage({ orders, period: currentWeek }) {
  const [period, setPeriod] = useState('ALL')
  const [type, setType] = useState('ALL')
  const [selected, setSelected] = useState(null)
  const filtered = orders.filter((order) => {
    const matchesPeriod = period === 'ALL' || (period === 'today' && isToday(order.createdAt)) || (period === 'week' && isInRange(order.createdAt, currentWeek)) || (period === 'month' && isThisMonth(order.createdAt))
    return matchesPeriod && (type === 'ALL' || order.orderType === type)
  })
  return <div className="page-stack"><PageHeader eyebrow="Catatan pribadi" title="Riwayat order" description="Semua order yang pernah Anda catat." /><div className="filter-bar"><div className="segmented"><button className={period === 'ALL' ? 'active' : ''} onClick={() => setPeriod('ALL')}>Semua</button><button className={period === 'today' ? 'active' : ''} onClick={() => setPeriod('today')}>Hari ini</button><button className={period === 'week' ? 'active' : ''} onClick={() => setPeriod('week')}>Minggu ini</button><button className={period === 'month' ? 'active' : ''} onClick={() => setPeriod('month')}>Bulan ini</button></div><label><span>Tipe</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="ALL">Semua tipe</option>{ORDER_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div><section className="panel orders-layout"><div><div className="panel__head"><div><span className="eyebrow">Hasil</span><h2>{filtered.length} order</h2></div></div><OrderList orders={filtered} onSelect={setSelected} /></div><OrderDetail order={selected || filtered[0]} /></section></div>
}

function DriverSettlement({ orders, settlement, activePeriod, duePeriod, onUpdate }) {
  const activeOrders = orders.filter((order) => isInRange(order.createdAt, activePeriod))
  const dueOrders = orders.filter((order) => isInRange(order.createdAt, duePeriod))
  const [proof, setProof] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  async function submit() {
    setSubmitting(true)
    setError('')
    try {
      await onUpdate(proof)
      setProof(null)
    } catch (uploadError) {
      setError(authErrorMessage(uploadError))
    } finally {
      setSubmitting(false)
    }
  }
  return <div className="page-stack"><PageHeader eyebrow="Setoran 10%" title="Setoran mingguan" description="Pantau estimasi minggu berjalan dan selesaikan tagihan periode yang sudah ditutup." /><section className="panel"><div className="panel__head"><div><span className="eyebrow">Estimasi minggu berjalan</span><h2>{formatPeriod(activePeriod)}</h2></div><span className="quiet-label">Belum jatuh tempo</span></div><div className="metric-grid metric-grid--three"><Metric label="Order berjalan" value={activeOrders.length} icon={ClipboardList} /><Metric label="Total ongkir" value={money(sum(activeOrders, 'deliveryFee'))} /><Metric label="Estimasi setoran 10%" value={money(sum(activeOrders, 'adminFee'))} detail="Jatuh tempo pada Minggu berikutnya" icon={WalletCards} tone="metric--accent" /></div></section><section className="settlement-hero"><span className="eyebrow">Setoran periode lalu · {formatPeriod(duePeriod)}</span><strong>{money(settlement.amount)}</strong><StatusBadge status={settlement.status} /><dl><div><dt>Total order</dt><dd>{dueOrders.length}</dd></div><div><dt>Total ongkir</dt><dd>{money(sum(dueOrders, 'deliveryFee'))}</dd></div><div><dt>Persentase</dt><dd>10%</dd></div></dl></section><section className="panel proof-panel"><div><span className="eyebrow">Bukti pembayaran</span><h2>Kirim bukti setoran</h2><p>Admin akan memeriksa dan mengubah status menjadi Lunas.</p></div>{!dueOrders.length ? <div className="proof-state"><Clock3 size={22} /><span><b>Belum ada kewajiban setoran</b><small>Tidak ada order pada periode sebelumnya.</small></span></div> : settlement.status === 'OPEN' || settlement.status === 'REJECTED' ? <div className="proof-action"><label className="file-input"><input type="file" accept="image/*" onChange={(event) => setProof(event.target.files?.[0] || null)} /><span>{proof?.name || 'Pilih foto bukti (maks. 5 MB)'}</span></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button--primary" disabled={!proof || submitting} onClick={submit}>{submitting ? 'Mengirim…' : 'Kirim bukti'}</button></div> : <div className="proof-state"><BadgeCheck size={22} /><span><b>{settlement.status === 'PAID' ? 'Setoran sudah lunas' : 'Bukti sedang diperiksa'}</b><small>{settlement.status === 'PAID' ? 'Tidak ada tindakan lagi.' : 'Tunggu konfirmasi admin.'}</small></span></div>}</section><section className="panel"><div className="panel__head"><div><span className="eyebrow">Dasar perhitungan setoran</span><h2>Order {formatPeriod(duePeriod)}</h2></div></div>{dueOrders.length ? <OrderList orders={dueOrders} /> : <EmptyState title="Tidak ada setoran periode lalu" detail="Order minggu berjalan masih dihitung sebagai estimasi dan baru jatuh tempo setelah periode ditutup." />}</section></div>
}

function ProfilePage({ driver }) {
  return <div className="page-stack"><PageHeader eyebrow="Akun driver" title="Profil" description="Data akun yang terhubung ke pencatatan order Anda." /><section className="profile-card"><Avatar driver={driver} /><div><h2>{driver.name}</h2><StatusBadge status={driver.accountStatus} /></div><dl><div><dt>WhatsApp</dt><dd>{driver.phone}</dd></div><div><dt>Email</dt><dd>{driver.email}</dd></div><div><dt>Kendaraan</dt><dd>{driver.vehicle}</dd></div><div><dt>Nomor polisi</dt><dd>{driver.plate}</dd></div><div><dt>Bergabung</dt><dd>{driver.joined}</dd></div></dl></section></div>
}

function AccessShell({ children, action }) {
  return <div className="access-shell"><header><Brand />{action}</header><main>{children}</main></div>
}

function LoginPage({ onLogin, onRegister, configurationError }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await onLogin(form.email.trim(), form.password)
    } catch (loginError) {
      setError(authErrorMessage(loginError))
    } finally {
      setSubmitting(false)
    }
  }

  return <section className="login-card"><div className="login-copy"><span className="eyebrow">Portal KURJAL</span><h1>Satu pintu untuk operasional Blitar.</h1><p>Admin dan driver masuk dari portal yang sama. Akses ditentukan otomatis dari profil akun.</p><div><BadgeCheck size={20} /><span><b>Routing aman sesuai role</b><small>Role dan status dibaca dari Firestore.</small></span></div></div><form className="login-form" onSubmit={submit}><span className="eyebrow">Selamat datang</span><h2>Masuk ke KURJAL</h2><p>Gunakan email dan password akun Anda.</p><label>Email<input type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="nama@email.com" required /></label><label>Password<input type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Masukkan password" required /></label>{(error || configurationError) && <p className="form-error" role="alert">{error || configurationError}</p>}<button className="button button--primary button--full" disabled={submitting}>{submitting ? 'Memeriksa akun…' : 'Login'}</button><p className="register-link">Belum punya akun? <button type="button" className="text-button" onClick={onRegister}>Daftar sebagai Driver</button></p></form></section>
}

function RegistrationPage({ onSubmit }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', confirmation: '', vehicle: '', plate: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  async function submit(event) {
    event.preventDefault()
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim() || form.password.length < 8) return setError('Lengkapi data wajib dan gunakan password minimal 8 karakter.')
    if (form.password !== form.confirmation) return setError('Konfirmasi password belum sama.')
    setSubmitting(true)
    setError('')
    try {
      await onSubmit(form)
    } catch (registrationError) {
      setError(authErrorMessage(registrationError))
    } finally {
      setSubmitting(false)
    }
  }
  return <section className="registration-card"><div className="registration-copy"><span className="eyebrow">Pendaftaran driver</span><h1>Mulai mencatat order bersama KURJAL.</h1><p>Isi data berikut. Akun baru berstatus Pending dan baru dapat masuk setelah disetujui admin.</p><ol><li>Daftar akun</li><li>Admin meninjau</li><li>Akses dashboard driver</li></ol></div><form className="registration-form" onSubmit={submit}><label>Nama lengkap<input name="name" value={form.name} onChange={update} autoComplete="name" required /></label><label>Nomor WhatsApp<input name="phone" value={form.phone} onChange={update} inputMode="tel" autoComplete="tel" required /></label><label>Email<input name="email" value={form.email} onChange={update} type="email" autoComplete="email" required /></label><div className="form-pair"><label>Password<input name="password" value={form.password} onChange={update} type="password" minLength="8" autoComplete="new-password" required /></label><label>Konfirmasi password<input name="confirmation" value={form.confirmation} onChange={update} type="password" autoComplete="new-password" required /></label></div><div className="form-pair"><label>Kendaraan <span>Opsional</span><input name="vehicle" value={form.vehicle} onChange={update} /></label><label>Nomor polisi <span>Opsional</span><input name="plate" value={form.plate} onChange={update} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button--primary button--full" disabled={submitting}>{submitting ? 'Membuat akun…' : 'Daftar sebagai driver'}</button></form></section>
}

function ApplicationStatus({ profile, error }) {
  const status = profile?.accountStatus || 'REJECTED'
  const content = error
    ? ['Akses tidak dapat diberikan', error]
    : { PENDING: ['Pendaftaran sedang ditinjau', 'Admin akan memeriksa data Anda. Dashboard driver belum dapat diakses.'], REJECTED: ['Pendaftaran ditolak', 'Akun belum dapat digunakan. Hubungi admin KURJAL untuk informasi lebih lanjut.'], SUSPENDED: ['Akses ditangguhkan', 'Dashboard tidak dapat diakses sampai admin mengaktifkan kembali akun.'] }[status]
  return <section className="application-card"><span className="application-mark"><Clock3 size={30} /></span><StatusBadge status={status} /><h1>{content[0]}</h1><p>{content[1]}</p>{profile && <dl><div><dt>Nama</dt><dd>{profile.name}</dd></div><div><dt>Email</dt><dd>{profile.email}</dd></div><div><dt>Status</dt><dd>{accountLabels[status]}</dd></div></dl>}</section>
}

function SplashScreen({ message = 'Memeriksa sesi dan akses akun…' }) {
  return <div className="splash-screen" role="status"><Brand /><span className="loading-dot" /><p>{message}</p></div>
}

function EmptyState({ title, detail }) { return <div className="empty-state"><Box size={24} /><b>{title}</b><p>{detail}</p></div> }

export default App
