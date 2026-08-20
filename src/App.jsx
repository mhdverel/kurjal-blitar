import React, { useRef, useState } from 'react'
import {
  BadgeCheck, Banknote, BarChart3, Bike, Box, Check, ChevronRight,
  ClipboardList, Clock3, History, House, LayoutDashboard,
  Menu, PackageCheck, Plus, Search, Settings, UserRound, Users,
  WalletCards, X,
} from 'lucide-react'
import { ADMIN_PERCENTAGE, ORDER_TYPES, calculateAdminFee, isValidOrder } from './ledger.js'

const adminNav = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['drivers', 'Drivers', Users],
  ['orders', 'Orders', ClipboardList],
  ['reports', 'Laporan', BarChart3],
  ['settlements', 'Setoran', WalletCards],
  ['settings', 'Pengaturan', Settings],
]

const driverNav = [
  ['home', 'Home', House],
  ['record', 'Catat', Plus],
  ['history', 'Riwayat', History],
  ['settlement', 'Setoran', WalletCards],
  ['profile', 'Profil', UserRound],
]

const initialDrivers = [
  { id: 'DRV-001', name: 'Peyeng', initials: 'PY', phone: '0812 3344 9911', email: 'peyeng@kurjal.id', vehicle: 'Honda Beat', plate: 'AG 3182 KJ', accountStatus: 'APPROVED', joined: '12 Mei 2026' },
  { id: 'DRV-002', name: 'Raka Pratama', initials: 'RP', phone: '0822 1900 4432', email: 'raka@kurjal.id', vehicle: 'Yamaha Mio', plate: 'AG 4201 KN', accountStatus: 'APPROVED', joined: '3 Juni 2026' },
  { id: 'DRV-003', name: 'Bagus Setiawan', initials: 'BS', phone: '0857 3120 8788', email: 'bagus@kurjal.id', vehicle: 'Honda Vario', plate: 'AG 2718 KA', accountStatus: 'APPROVED', joined: '17 Juni 2026' },
  { id: 'DRV-004', name: 'Nia Kurniasari', initials: 'NK', phone: '0813 7765 9921', email: 'nia@kurjal.id', vehicle: 'Honda Scoopy', plate: 'AG 5518 KQ', accountStatus: 'SUSPENDED', joined: '8 Juli 2026' },
  { id: 'DRV-005', name: 'Ari Nugroho', initials: 'AN', phone: '0819 7754 2210', email: 'ari@gmail.com', vehicle: 'Yamaha Gear', plate: 'AG 6441 KD', accountStatus: 'PENDING', joined: '21 Agustus 2026' },
]

const initialOrders = [
  { id: 'ORD-260821-081', driverId: 'DRV-001', driverName: 'Peyeng', customerName: 'Budi Santoso', orderType: 'FOOD', deliveryFee: 15_000, adminFee: 1_500, notes: 'Titip sambal dipisah', date: '21 Agustus 2026', time: '14.20', period: 'today', status: 'ACTIVE' },
  { id: 'ORD-260821-079', driverId: 'DRV-002', driverName: 'Raka Pratama', customerName: 'Siti Aminah', orderType: 'PACKAGE', deliveryFee: 12_000, adminFee: 1_200, notes: '', date: '21 Agustus 2026', time: '13.42', period: 'today', status: 'ACTIVE' },
  { id: 'ORD-260821-076', driverId: 'DRV-001', driverName: 'Peyeng', customerName: 'Dian Putri', orderType: 'RIDE', deliveryFee: 10_000, adminFee: 1_000, notes: 'Antar ke stasiun', date: '21 Agustus 2026', time: '11.55', period: 'today', status: 'ACTIVE' },
  { id: 'ORD-260821-074', driverId: 'DRV-003', driverName: 'Bagus Setiawan', customerName: 'Rizky Hidayat', orderType: 'PICKUP', deliveryFee: 18_000, adminFee: 1_800, notes: '', date: '21 Agustus 2026', time: '10.18', period: 'today', status: 'ACTIVE' },
  { id: 'ORD-260820-069', driverId: 'DRV-001', driverName: 'Peyeng', customerName: 'Maya Lestari', orderType: 'PACKAGE', deliveryFee: 14_000, adminFee: 1_400, notes: 'Barang mudah pecah', date: '20 Agustus 2026', time: '16.08', period: 'week', status: 'ACTIVE' },
  { id: 'ORD-260820-066', driverId: 'DRV-002', driverName: 'Raka Pratama', customerName: 'Dwi Ananda', orderType: 'OTHER', deliveryFee: 20_000, adminFee: 2_000, notes: 'Antar dokumen', date: '20 Agustus 2026', time: '12.26', period: 'week', status: 'ACTIVE' },
  { id: 'ORD-260819-061', driverId: 'DRV-003', driverName: 'Bagus Setiawan', customerName: 'Rini Wulandari', orderType: 'FOOD', deliveryFee: 13_000, adminFee: 1_300, notes: '', date: '19 Agustus 2026', time: '18.40', period: 'week', status: 'ACTIVE' },
  { id: 'ORD-260814-044', driverId: 'DRV-001', driverName: 'Peyeng', customerName: 'Agus Salim', orderType: 'PICKUP', deliveryFee: 16_000, adminFee: 1_600, notes: '', date: '14 Agustus 2026', time: '09.32', period: 'month', status: 'ACTIVE' },
]

const initialSettlements = [
  { id: 'STL-0821-01', driverId: 'DRV-001', driverName: 'Peyeng', period: '18–24 Agustus 2026', orders: 3, deliveryFee: 39_000, amount: 3_900, status: 'OPEN' },
  { id: 'STL-0821-02', driverId: 'DRV-002', driverName: 'Raka Pratama', period: '18–24 Agustus 2026', orders: 2, deliveryFee: 32_000, amount: 3_200, status: 'WAITING_CONFIRMATION' },
  { id: 'STL-0821-03', driverId: 'DRV-003', driverName: 'Bagus Setiawan', period: '18–24 Agustus 2026', orders: 2, deliveryFee: 31_000, amount: 3_100, status: 'PAID' },
]

const money = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
const sum = (items, key) => items.reduce((total, item) => total + Number(item[key] || 0), 0)
const typeLabel = (value) => ORDER_TYPES.find((type) => type.value === value)?.label || value
const accountLabels = { PENDING: 'Pending', APPROVED: 'Aktif', REJECTED: 'Ditolak', SUSPENDED: 'Ditangguhkan' }
const settlementLabels = { OPEN: 'Belum setor', WAITING_CONFIRMATION: 'Menunggu konfirmasi', PAID: 'Lunas', REJECTED: 'Ditolak' }

function StatusBadge({ status }) {
  const label = accountLabels[status] || settlementLabels[status] || status
  return <span className={`status status--${status.toLowerCase()}`}>{label}</span>
}

function App() {
  const [role, setRole] = useState('ADMIN')
  const [page, setPage] = useState('dashboard')
  const [orders, setOrders] = useState(initialOrders)
  const [drivers, setDrivers] = useState(initialDrivers)
  const [settlements, setSettlements] = useState(initialSettlements)
  const [currentDriverId, setCurrentDriverId] = useState('DRV-001')
  const [applicationId, setApplicationId] = useState(null)
  const [accessMode, setAccessMode] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const currentDriver = drivers.find((driver) => driver.id === currentDriverId)
  const application = drivers.find((driver) => driver.id === applicationId)
  const nav = role === 'ADMIN' ? adminNav : driverNav

  const navigate = (nextPage) => { setPage(nextPage); setMenuOpen(false) }
  const switchRole = (nextRole) => { setRole(nextRole); setAccessMode(null); setPage(nextRole === 'ADMIN' ? 'dashboard' : 'home') }

  function registerDriver(form) {
    const id = `DRV-${String(drivers.length + 1).padStart(3, '0')}`
    const name = form.name.trim()
    const driver = {
      id, name,
      initials: name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      phone: form.phone, email: form.email,
      vehicle: form.vehicle || 'Belum diisi', plate: form.plate || '—',
      accountStatus: 'PENDING', joined: '21 Agustus 2026',
    }
    setDrivers((current) => [...current, driver])
    setApplicationId(id)
    setAccessMode('application')
  }

  function updateDriverStatus(id, accountStatus) {
    setDrivers((current) => current.map((driver) => driver.id === id ? { ...driver, accountStatus } : driver))
    if (accountStatus === 'APPROVED') {
      const driver = drivers.find((item) => item.id === id)
      setSettlements((current) => current.some((item) => item.driverId === id) ? current : [...current, {
        id: `STL-${id}`, driverId: id, driverName: driver.name, period: '18–24 Agustus 2026',
        orders: 0, deliveryFee: 0, amount: 0, status: 'OPEN',
      }])
    }
    setNotice(`Status driver diperbarui menjadi ${accountLabels[accountStatus]}.`)
  }

  function updateSettlement(id, status) {
    setSettlements((current) => current.map((item) => item.id === id ? { ...item, status } : item))
    setNotice(`Status setoran diperbarui menjadi ${settlementLabels[status]}.`)
  }

  if (accessMode) return (
    <AccessShell onBack={() => setAccessMode(null)}>
      {accessMode === 'register'
        ? <RegistrationPage onSubmit={registerDriver} />
        : <ApplicationStatus driver={application} onDashboard={() => { setCurrentDriverId(application.id); switchRole('DRIVER') }} />}
    </AccessShell>
  )

  return (
    <div className="app-shell">
      <Sidebar role={role} page={page} nav={nav} open={menuOpen} onNavigate={navigate} onClose={() => setMenuOpen(false)} />
      <div className="workspace">
        <Topbar role={role} page={page} hasApplication={Boolean(applicationId)} onMenu={() => setMenuOpen(true)} onRole={switchRole} onRegister={() => setAccessMode(applicationId ? 'application' : 'register')} onRecord={() => navigate('record')} />
        <main id="main-content" className="main-content">
          {role === 'ADMIN'
            ? <AdminPages page={page} orders={orders} drivers={drivers} settlements={settlements} onDriverStatus={updateDriverStatus} onSettlement={updateSettlement} />
            : <DriverPages page={page} driver={currentDriver} orders={orders.filter((order) => order.driverId === currentDriverId)} settlement={settlements.find((item) => item.driverId === currentDriverId)} onNavigate={navigate} onSaveOrder={(order) => setOrders((current) => [order, ...current])} onSettlement={updateSettlement} />}
        </main>
        <MobileNav page={page} nav={nav} onNavigate={navigate} />
      </div>
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
      <div className="sidebar__note"><Clock3 size={17} /><span>Periode setoran<br /><b>Senin–Minggu</b></span></div>
    </aside>
  </>
}

function Brand() {
  return <div className="brand"><span className="brand__mark"><Bike size={22} /></span><span><b>KURJAL</b><small>BLITAR</small></span></div>
}

function Topbar({ role, page, hasApplication, onMenu, onRole, onRegister, onRecord }) {
  const title = [...adminNav, ...driverNav].find(([key]) => key === page)?.[1] || 'KURJAL'
  return <header className="topbar">
    <button className="icon-button topbar__menu" aria-label="Buka menu" onClick={onMenu}><Menu size={20} /></button>
    <div className="topbar__title"><span>{role === 'ADMIN' ? 'Admin' : 'Driver'}</span><b>{title}</b></div>
    <button className="text-button topbar__register" onClick={onRegister}>{hasApplication ? 'Status pendaftaran' : 'Daftar driver'}</button>
    <div className="role-switch" aria-label="Ganti tampilan demo"><button className={role === 'ADMIN' ? 'active' : ''} onClick={() => onRole('ADMIN')}>Admin</button><button className={role === 'DRIVER' ? 'active' : ''} onClick={() => onRole('DRIVER')}>Driver</button></div>
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
  if (props.page === 'reports') return <ReportsPage orders={props.orders} drivers={props.drivers} />
  if (props.page === 'settlements') return <AdminSettlements items={props.settlements} onUpdate={props.onSettlement} />
  if (props.page === 'settings') return <SettingsPage />
  return <AdminDashboard {...props} />
}

function AdminDashboard({ orders, drivers, settlements }) {
  const today = orders.filter((order) => order.period === 'today')
  const week = orders.filter((order) => order.period !== 'month')
  const pending = drivers.filter((driver) => driver.accountStatus === 'PENDING')
  const approved = drivers.filter((driver) => driver.accountStatus === 'APPROVED')
  return <div className="page-stack">
    <PageHeader eyebrow="Ringkasan operasional" title="Selamat siang, Admin." description="Order dibagikan melalui WhatsApp; dashboard ini khusus pencatatan dan monitoring." />
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
    <section className="week-band"><div><span className="eyebrow">Minggu berjalan · 18–24 Agustus</span><h2>{week.length} order tercatat</h2></div><dl><div><dt>Total ongkir</dt><dd>{money(sum(week, 'deliveryFee'))}</dd></div><div><dt>Setoran 10%</dt><dd>{money(sum(week, 'adminFee'))}</dd></div></dl></section>
  </div>
}

function AttentionRow({ count, label, detail }) {
  return <div className="attention-row"><strong>{count}</strong><span><b>{label}</b><small>{detail}</small></span><ChevronRight size={17} /></div>
}

function OrderList({ orders, showDriver = false, onSelect }) {
  if (!orders.length) return <EmptyState title="Belum ada catatan" detail="Data order akan muncul di sini setelah disimpan driver." />
  return <div className="order-list">{orders.map((order) => <button className="order-row" key={order.id} onClick={() => onSelect?.(order)} disabled={!onSelect}><span className={`type-mark type-mark--${order.orderType.toLowerCase()}`}>{typeLabel(order.orderType).slice(0, 1)}</span><span className="order-row__main"><b>{order.customerName}</b><small>{typeLabel(order.orderType)}{showDriver ? ` · ${order.driverName}` : ''}</small></span><span className="order-row__meta"><b>{money(order.deliveryFee)}</b><small>{order.time}</small></span>{onSelect && <ChevronRight size={17} />}</button>)}</div>
}

function DriversPage({ drivers, orders, onDriverStatus }) {
  const pending = drivers.filter((driver) => driver.accountStatus === 'PENDING')
  return <div className="page-stack">
    <PageHeader eyebrow="Akun & akses" title="Kelola driver" description="Driver baru hanya dapat masuk setelah pendaftarannya disetujui admin." />
    <section className="panel"><div className="panel__head"><div><span className="eyebrow">Pendaftaran baru</span><h2>Menunggu persetujuan</h2></div><span className="count-chip">{pending.length}</span></div>{pending.length ? <div className="approval-list">{pending.map((driver) => <div className="approval-row" key={driver.id}><Avatar driver={driver} /><div><b>{driver.name}</b><small>{driver.phone} · {driver.vehicle} · {driver.plate}</small></div><StatusBadge status={driver.accountStatus} /><div className="row-actions"><button className="button button--secondary" onClick={() => onDriverStatus(driver.id, 'REJECTED')}>Tolak</button><button className="button button--primary" onClick={() => onDriverStatus(driver.id, 'APPROVED')}><Check size={15} />Setujui</button></div></div>)}</div> : <EmptyState title="Antrian kosong" detail="Tidak ada pendaftaran yang menunggu persetujuan." />}</section>
    <section className="panel"><div className="panel__head"><div><span className="eyebrow">Direktori</span><h2>Semua driver</h2></div><label className="compact-search"><Search size={15} /><input aria-label="Cari driver" placeholder="Cari driver" /></label></div><div className="driver-grid">{drivers.filter((driver) => driver.accountStatus !== 'PENDING').map((driver) => { const driverOrders = orders.filter((order) => order.driverId === driver.id); return <article className="driver-card" key={driver.id}><div className="driver-card__head"><Avatar driver={driver} /><StatusBadge status={driver.accountStatus} /></div><h3>{driver.name}</h3><p>{driver.vehicle} · {driver.plate}</p><dl><div><dt>Order</dt><dd>{driverOrders.length}</dd></div><div><dt>Total ongkir</dt><dd>{money(sum(driverOrders, 'deliveryFee'))}</dd></div><div><dt>Setoran</dt><dd>{money(sum(driverOrders, 'adminFee'))}</dd></div></dl><button className="text-button" onClick={() => onDriverStatus(driver.id, driver.accountStatus === 'SUSPENDED' ? 'APPROVED' : 'SUSPENDED')}>{driver.accountStatus === 'SUSPENDED' ? 'Aktifkan kembali' : 'Tangguhkan akun'}</button></article> })}</div></section>
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

function ReportsPage({ orders, drivers }) {
  const [range, setRange] = useState('WEEK')
  const data = range === 'TODAY' ? orders.filter((order) => order.period === 'today') : range === 'MONTH' ? orders : orders.filter((order) => order.period !== 'month')
  return <div className="page-stack">
    <PageHeader eyebrow="Rekap operasional" title="Laporan" description="Ringkasan order, ongkir, dan setoran berdasarkan catatan driver." />
    <div className="segmented">{[['TODAY', 'Harian'], ['WEEK', 'Mingguan'], ['MONTH', 'Bulanan'], ['CUSTOM', 'Custom']].map(([key, label]) => <button key={key} className={range === key ? 'active' : ''} onClick={() => setRange(key)}>{label}</button>)}</div>
    {range === 'CUSTOM' && <div className="date-range"><label>Dari<input type="date" /></label><label>Sampai<input type="date" /></label></div>}
    <section className="metric-grid metric-grid--three"><Metric label="Total order" value={data.length} icon={ClipboardList} /><Metric label="Total ongkir" value={money(sum(data, 'deliveryFee'))} /><Metric label="Total setoran" value={money(sum(data, 'adminFee'))} icon={WalletCards} tone="metric--accent" /></section>
    <section className="report-grid"><div className="panel"><div className="panel__head"><div><span className="eyebrow">Per driver</span><h2>Kontribusi periode</h2></div></div><div className="data-list">{drivers.filter((driver) => driver.accountStatus === 'APPROVED').map((driver) => { const own = data.filter((order) => order.driverId === driver.id); return <div key={driver.id}><span><b>{driver.name}</b><small>{own.length} order</small></span><strong>{money(sum(own, 'deliveryFee'))}</strong></div> })}</div></div><div className="panel"><div className="panel__head"><div><span className="eyebrow">Per tipe</span><h2>Komposisi order</h2></div></div><div className="type-report">{ORDER_TYPES.map((type) => { const count = data.filter((order) => order.orderType === type.value).length; return <div key={type.value}><span>{type.label}</span><div><i style={{ width: `${data.length ? (count / data.length) * 100 : 0}%` }} /></div><b>{count}</b></div> })}</div></div></section>
  </div>
}

function AdminSettlements({ items, onUpdate }) {
  return <div className="page-stack"><PageHeader eyebrow="Setoran mingguan" title="Settlement driver" description="Konfirmasi setoran 10% untuk periode Senin–Minggu." /><section className="metric-grid metric-grid--three"><Metric label="Belum setor" value={items.filter((item) => item.status === 'OPEN').length} /><Metric label="Menunggu konfirmasi" value={items.filter((item) => item.status === 'WAITING_CONFIRMATION').length} icon={Clock3} /><Metric label="Lunas" value={items.filter((item) => item.status === 'PAID').length} icon={BadgeCheck} tone="metric--accent" /></section><section className="panel"><div className="panel__head"><div><span className="eyebrow">Periode aktif</span><h2>18–24 Agustus 2026</h2></div></div><div className="settlement-list">{items.map((item) => <article key={item.id} className="settlement-row"><Avatar driver={{ initials: item.driverName.split(' ').map((part) => part[0]).join('').slice(0, 2) }} /><div><b>{item.driverName}</b><small>{item.orders} order · {money(item.deliveryFee)} ongkir</small></div><strong>{money(item.amount)}</strong><StatusBadge status={item.status} />{item.status === 'WAITING_CONFIRMATION' && <div className="row-actions"><button className="button button--secondary" onClick={() => onUpdate(item.id, 'REJECTED')}>Tolak</button><button className="button button--primary" onClick={() => onUpdate(item.id, 'PAID')}><Check size={15} />Konfirmasi</button></div>}</article>)}</div></section></div>
}

function SettingsPage() {
  return <div className="page-stack"><PageHeader eyebrow="Konfigurasi" title="Pengaturan" description="Aturan inti pencatatan dan settlement KURJAL." /><section className="panel settings-panel"><div><span className="eyebrow">Setoran</span><h2>Persentase admin</h2><p>Dihitung otomatis dari ongkir setiap order.</p></div><label className="percentage-field"><input value={ADMIN_PERCENTAGE * 100} readOnly /><span>%</span></label><div className="settings-rule"><Clock3 size={19} /><span><b>Periode mingguan</b><small>Senin 00.00 – Minggu 23.59 · Asia/Jakarta</small></span></div><div className="settings-rule"><BadgeCheck size={19} /><span><b>Data order</b><small>Catatan aktif disimpan sebagai ledger; penghapusan menggunakan arsip.</small></span></div></section></div>
}

function DriverPages({ page, driver, orders, settlement, onNavigate, onSaveOrder, onSettlement }) {
  if (page === 'record') return <RecordOrderPage driver={driver} onSave={onSaveOrder} onNavigate={onNavigate} />
  if (page === 'history') return <HistoryPage orders={orders} />
  if (page === 'settlement') return <DriverSettlement orders={orders} settlement={settlement} onUpdate={onSettlement} />
  if (page === 'profile') return <ProfilePage driver={driver} />
  return <DriverHome driver={driver} orders={orders} settlement={settlement} onNavigate={onNavigate} />
}

function DriverHome({ driver, orders, settlement, onNavigate }) {
  const today = orders.filter((order) => order.period === 'today')
  const week = orders.filter((order) => order.period !== 'month')
  return <div className="page-stack"><PageHeader eyebrow="Dashboard driver" title={`Halo, ${driver?.name || 'Driver'}.`} description="Catat order yang sudah selesai agar rekap mingguan selalu akurat." action={<button className="button button--primary desktop-only" onClick={() => onNavigate('record')}><Plus size={16} />Catat order</button>} /><section className="driver-hero"><div><span className="eyebrow">Hari ini</span><strong>{today.length}</strong><p>order tercatat</p></div><dl><div><dt>Total ongkir</dt><dd>{money(sum(today, 'deliveryFee'))}</dd></div><div><dt>Setoran 10%</dt><dd>{money(sum(today, 'adminFee'))}</dd></div></dl><button className="button button--light" onClick={() => onNavigate('record')}><Plus size={17} />Catat order baru</button></section><section className="metric-grid metric-grid--three"><Metric label="Order minggu ini" value={week.length} icon={ClipboardList} /><Metric label="Ongkir minggu ini" value={money(sum(week, 'deliveryFee'))} /><article className="metric metric--status"><span>Status setoran</span><StatusBadge status={settlement?.status || 'OPEN'} /><strong>{money(settlement?.amount || sum(week, 'adminFee'))}</strong><small>18–24 Agustus 2026</small></article></section><section className="panel"><div className="panel__head"><div><span className="eyebrow">Terbaru</span><h2>Riwayat order</h2></div><button className="text-button" onClick={() => onNavigate('history')}>Lihat semua</button></div><OrderList orders={orders.slice(0, 5)} /></section></div>
}

const emptyOrder = { customerName: '', orderType: 'FOOD', deliveryFee: '', notes: '' }

function RecordOrderPage({ driver, onSave, onNavigate }) {
  const [form, setForm] = useState(emptyOrder)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const dialogRef = useRef(null)
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  function review(event) {
    event.preventDefault()
    if (!isValidOrder(form)) return setError('Lengkapi nama customer, tipe order, dan ongkir lebih dari Rp0.')
    setError('')
    dialogRef.current?.showModal()
  }

  function confirm() {
    const deliveryFee = Number(form.deliveryFee)
    const order = {
      id: `ORD-${Date.now().toString().slice(-9)}`, driverId: driver.id, driverName: driver.name,
      customerName: form.customerName.trim(), orderType: form.orderType, deliveryFee,
      adminFee: calculateAdminFee(deliveryFee), notes: form.notes.trim(),
      date: new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date()),
      time: new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date()),
      period: 'today', status: 'ACTIVE',
    }
    onSave(order)
    dialogRef.current?.close()
    setSuccess(order)
    setForm(emptyOrder)
  }

  if (success) return <div className="page-stack"><PageHeader eyebrow="Catat order" title="Order berhasil disimpan" /><section className="success-panel"><span className="success-mark"><Check size={28} /></span><h2>Catatan sudah masuk</h2><p>{success.customerName} · {typeLabel(success.orderType)} · {money(success.deliveryFee)}</p><div><button className="button button--secondary" onClick={() => setSuccess(null)}><Plus size={16} />Catat lagi</button><button className="button button--primary" onClick={() => onNavigate('home')}>Kembali ke Home</button></div></section></div>

  return <div className="page-stack record-page"><PageHeader eyebrow="Catatan selesai" title="Catat order" description="Masukkan order setelah selesai dikerjakan. Setoran 10% dihitung otomatis." /><section className="panel form-panel"><form onSubmit={review} className="order-form"><label>Nama customer<span>Wajib</span><input autoFocus name="customerName" value={form.customerName} onChange={change} placeholder="Contoh: Budi Santoso" /></label><label>Tipe order<span>Wajib</span><select name="orderType" value={form.orderType} onChange={change}>{ORDER_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label>Jumlah ongkir<span>Wajib</span><div className="money-input"><b>Rp</b><input name="deliveryFee" value={form.deliveryFee} onChange={change} type="number" inputMode="numeric" min="1" placeholder="0" /></div><small>Setoran: {money(calculateAdminFee(form.deliveryFee || 0))}</small></label><label>Catatan<span>Opsional</span><textarea name="notes" value={form.notes} onChange={change} rows="4" placeholder="Informasi tambahan tentang order" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button--primary button--full" type="submit">Simpan order</button></form><aside className="form-note"><BadgeCheck size={22} /><h3>Sebelum menyimpan</h3><p>Pastikan customer, tipe, dan ongkir sudah benar. Anda akan melihat konfirmasi terlebih dahulu.</p></aside></section><dialog className="confirm-dialog" ref={dialogRef}><form method="dialog"><div className="dialog__head"><div><span className="eyebrow">Konfirmasi</span><h2>Simpan catatan order?</h2></div><button className="icon-button" aria-label="Tutup"><X size={19} /></button></div><dl className="confirm-list"><div><dt>Customer</dt><dd>{form.customerName}</dd></div><div><dt>Tipe order</dt><dd>{typeLabel(form.orderType)}</dd></div><div><dt>Jumlah ongkir</dt><dd>{money(Number(form.deliveryFee || 0))}</dd></div><div><dt>Setoran 10%</dt><dd>{money(calculateAdminFee(form.deliveryFee || 0))}</dd></div><div><dt>Catatan</dt><dd>{form.notes || 'Tidak ada catatan'}</dd></div></dl><div className="dialog__actions"><button className="button button--secondary">Periksa lagi</button><button className="button button--primary" type="button" onClick={confirm}><Check size={16} />Simpan</button></div></form></dialog></div>
}

function HistoryPage({ orders }) {
  const [period, setPeriod] = useState('ALL')
  const [type, setType] = useState('ALL')
  const [selected, setSelected] = useState(null)
  const filtered = orders.filter((order) => (period === 'ALL' || order.period === period) && (type === 'ALL' || order.orderType === type))
  return <div className="page-stack"><PageHeader eyebrow="Catatan pribadi" title="Riwayat order" description="Semua order yang pernah Anda catat." /><div className="filter-bar"><div className="segmented"><button className={period === 'ALL' ? 'active' : ''} onClick={() => setPeriod('ALL')}>Semua</button><button className={period === 'today' ? 'active' : ''} onClick={() => setPeriod('today')}>Hari ini</button><button className={period === 'week' ? 'active' : ''} onClick={() => setPeriod('week')}>Minggu ini</button><button className={period === 'month' ? 'active' : ''} onClick={() => setPeriod('month')}>Bulan ini</button></div><label><span>Tipe</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="ALL">Semua tipe</option>{ORDER_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div><section className="panel orders-layout"><div><div className="panel__head"><div><span className="eyebrow">Hasil</span><h2>{filtered.length} order</h2></div></div><OrderList orders={filtered} onSelect={setSelected} /></div><OrderDetail order={selected || filtered[0]} /></section></div>
}

function DriverSettlement({ orders, settlement, onUpdate }) {
  const week = orders.filter((order) => order.period !== 'month')
  const [proof, setProof] = useState('')
  const amount = settlement?.amount || sum(week, 'adminFee')
  return <div className="page-stack"><PageHeader eyebrow="Setoran 10%" title="Setoran minggu ini" description="Periode 18–24 Agustus 2026 · Senin–Minggu." /><section className="settlement-hero"><span className="eyebrow">Jumlah yang perlu disetor</span><strong>{money(amount)}</strong><StatusBadge status={settlement?.status || 'OPEN'} /><dl><div><dt>Total order</dt><dd>{week.length}</dd></div><div><dt>Total ongkir</dt><dd>{money(sum(week, 'deliveryFee'))}</dd></div><div><dt>Persentase</dt><dd>10%</dd></div></dl></section><section className="panel proof-panel"><div><span className="eyebrow">Bukti pembayaran</span><h2>Kirim bukti setoran</h2><p>Admin akan memeriksa dan mengubah status menjadi Lunas.</p></div>{settlement?.status === 'OPEN' || settlement?.status === 'REJECTED' ? <div className="proof-action"><label className="file-input"><input type="file" accept="image/*" onChange={(event) => setProof(event.target.files?.[0]?.name || '')} /><span>{proof || 'Pilih foto bukti'}</span></label><button className="button button--primary" disabled={!proof} onClick={() => onUpdate(settlement.id, 'WAITING_CONFIRMATION')}>Kirim bukti</button></div> : <div className="proof-state"><BadgeCheck size={22} /><span><b>{settlement?.status === 'PAID' ? 'Setoran sudah lunas' : 'Bukti sedang diperiksa'}</b><small>{settlement?.status === 'PAID' ? 'Tidak ada tindakan lagi.' : 'Tunggu konfirmasi admin.'}</small></span></div>}</section><section className="panel"><div className="panel__head"><div><span className="eyebrow">Dasar perhitungan</span><h2>Order minggu ini</h2></div></div><OrderList orders={week} /></section></div>
}

function ProfilePage({ driver }) {
  return <div className="page-stack"><PageHeader eyebrow="Akun driver" title="Profil" description="Data akun yang terhubung ke pencatatan order Anda." /><section className="profile-card"><Avatar driver={driver} /><div><h2>{driver.name}</h2><StatusBadge status={driver.accountStatus} /></div><dl><div><dt>WhatsApp</dt><dd>{driver.phone}</dd></div><div><dt>Email</dt><dd>{driver.email}</dd></div><div><dt>Kendaraan</dt><dd>{driver.vehicle}</dd></div><div><dt>Nomor polisi</dt><dd>{driver.plate}</dd></div><div><dt>Bergabung</dt><dd>{driver.joined}</dd></div></dl></section></div>
}

function AccessShell({ children, onBack }) {
  return <div className="access-shell"><header><Brand /><button className="text-button" onClick={onBack}>Kembali ke aplikasi</button></header><main>{children}</main></div>
}

function RegistrationPage({ onSubmit }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', confirmation: '', vehicle: '', plate: '' })
  const [error, setError] = useState('')
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  function submit(event) {
    event.preventDefault()
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim() || form.password.length < 8) return setError('Lengkapi data wajib dan gunakan password minimal 8 karakter.')
    if (form.password !== form.confirmation) return setError('Konfirmasi password belum sama.')
    onSubmit(form)
  }
  return <section className="registration-card"><div className="registration-copy"><span className="eyebrow">Pendaftaran driver</span><h1>Mulai mencatat order bersama KURJAL.</h1><p>Isi data berikut. Akun baru berstatus Pending dan baru dapat masuk setelah disetujui admin.</p><ol><li>Daftar akun</li><li>Admin meninjau</li><li>Akses dashboard driver</li></ol></div><form className="registration-form" onSubmit={submit}><label>Nama lengkap<input name="name" value={form.name} onChange={update} required /></label><label>Nomor WhatsApp<input name="phone" value={form.phone} onChange={update} inputMode="tel" required /></label><label>Email<input name="email" value={form.email} onChange={update} type="email" required /></label><div className="form-pair"><label>Password<input name="password" value={form.password} onChange={update} type="password" minLength="8" required /></label><label>Konfirmasi password<input name="confirmation" value={form.confirmation} onChange={update} type="password" required /></label></div><div className="form-pair"><label>Kendaraan <span>Opsional</span><input name="vehicle" value={form.vehicle} onChange={update} /></label><label>Nomor polisi <span>Opsional</span><input name="plate" value={form.plate} onChange={update} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button--primary button--full">Daftar sebagai driver</button></form></section>
}

function ApplicationStatus({ driver, onDashboard }) {
  if (!driver) return <EmptyState title="Pendaftaran tidak ditemukan" detail="Kembali dan isi formulir pendaftaran driver." />
  const content = { PENDING: ['Pendaftaran sedang ditinjau', 'Admin akan memeriksa data Anda. Dashboard driver belum dapat diakses.'], APPROVED: ['Pendaftaran disetujui', 'Akun Anda sudah aktif dan dashboard driver siap digunakan.'], REJECTED: ['Pendaftaran ditolak', 'Akun belum dapat digunakan. Hubungi admin KURJAL untuk informasi lebih lanjut.'], SUSPENDED: ['Akses ditangguhkan', 'Dashboard tidak dapat diakses sampai admin mengaktifkan kembali akun.'] }[driver.accountStatus]
  return <section className="application-card"><span className="application-mark">{driver.accountStatus === 'APPROVED' ? <Check size={30} /> : <Clock3 size={30} />}</span><StatusBadge status={driver.accountStatus} /><h1>{content[0]}</h1><p>{content[1]}</p><dl><div><dt>Nama</dt><dd>{driver.name}</dd></div><div><dt>WhatsApp</dt><dd>{driver.phone}</dd></div><div><dt>Status</dt><dd>{accountLabels[driver.accountStatus]}</dd></div></dl>{driver.accountStatus === 'APPROVED' && <button className="button button--primary" onClick={onDashboard}>Masuk ke dashboard</button>}</section>
}

function EmptyState({ title, detail }) { return <div className="empty-state"><Box size={24} /><b>{title}</b><p>{detail}</p></div> }

export default App
