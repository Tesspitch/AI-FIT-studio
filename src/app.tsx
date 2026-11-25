import {
  CalendarDays, Camera, ChevronRight, ClipboardList,
  Droplets, Dumbbell, Focus, House, PanelLeftClose, PanelLeftOpen, ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { Button } from './components/ui/button'
import { useExercises } from './features/exercises/use-exercises'
import { Account, AccountAvatar, History, SignIn, SignOutButton, useAccount, useProfile } from './features/account/account'
import { Studio } from './features/pose/studio'
import { WorkoutOverview } from './features/workout/workout-overview'
import { referenceVideoUrl, supabase } from './lib/supabase'
import hero from './assets/studio-hero.png'
import signInArt from './assets/sign-in-studio.png'
import officeResetLogo from './assets/office-reset-logo-stretch.png'

const pages = [
  { path: '/', label: 'ภาพรวม', icon: House },
  { path: '/studio', label: 'ห้องฝึก', icon: Dumbbell },
  { path: '/history', label: 'ประวัติ', icon: CalendarDays },
]

const prepSteps = [
  { label: 'จัดพื้นที่ให้พร้อม', detail: 'เผื่อระยะให้ขยับตัวได้สะดวก', icon: Focus, color: 'lavender' },
  { label: 'ตั้งกล้องให้เห็นเต็มตัว', detail: 'วางกล้องให้มั่นคงในที่มีแสงพอ', icon: Camera, color: 'mint' },
  { label: 'เตรียมน้ำดื่มไว้ใกล้ตัว', detail: 'พักและดื่มน้ำได้ตามต้องการ', icon: Droplets, color: 'pink' },
]

export function App() {
  const { pathname, search, hash } = useLocation()
  const { user, loading } = useAccount()
  if (loading) return <SignInPage loading />
  if (!user) {
    if (pathname === '/') return <SignInPage loading={false} />
    if (pathname.replace(/\/$/, '') === '/profile') {
      return <Navigate to={{ pathname: '/', search, hash }} replace />
    }
    return <Navigate to="/" replace />
  }
  return <Workspace key={user.id} pathname={pathname} user={user} />
}

function Brand() {
  return <Link to="/" className="brand" aria-label="Office Reset หน้าแรก">
    <img className="brand-mark" src={officeResetLogo} alt="" width={39} height={39} />
    <span>Office <span className="brand-accent">Reset</span></span>
  </Link>
}

function SignInPage({ loading }: { loading: boolean }) {
  const [register, setRegister] = useState(false)
  return <div className="auth-page" data-mode={register ? 'register' : 'sign-in'}>
    <header className="auth-header"><Brand /></header>
    <main className="auth-layout">
      <section className="auth-intro" aria-labelledby="auth-intro-title">
        <div className="auth-intro-copy">
          <h2 id="auth-intro-title">พักจากโต๊ะสักนิด</h2>
          <p>ยืดเหยียดระหว่างวันสำหรับคนทำงานหน้าคอม พร้อมดูท่าทางของตัวเองผ่านกล้อง</p>
        </div>
        <img src={signInArt} alt="" fetchPriority="high" />
        <div className="auth-privacy"><ShieldCheck size={17} aria-hidden="true" />ภาพจากกล้องประมวลผลบนอุปกรณ์ของคุณ</div>
      </section>
      {loading ? <section className="auth-card panel" aria-busy="true">
        <h1>เข้าสู่ระบบ</h1><p className="auth-caption" role="status">กำลังตรวจสอบบัญชี</p>
      </section> : supabase ? <SignIn register={register} onModeChange={setRegister} /> : <section className="auth-card panel">
        <h1>เข้าสู่ระบบ</h1><p className="auth-caption" role="status">ระบบบัญชียังไม่พร้อม กรุณาลองใหม่ภายหลัง</p>
      </section>}
    </main>
  </div>
}

function Workspace({ pathname, user }: { pathname: string; user: NonNullable<ReturnType<typeof useAccount>['user']> }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('ai-fit.sidebar-collapsed') === 'true'
    } catch {
      return false
    }
  })
  const pageLabel = (pathname === '/profile' ? 'โปรไฟล์' : pages.find(({ path }) => path === pathname)?.label) ?? 'รายละเอียดท่า'
  const catalog = useExercises()
  const profileState = useProfile(user.id)
  const displayName = profileState.profile?.display_name?.trim()
  const toggleLabel = sidebarCollapsed ? 'ขยายแถบด้านข้าง' : 'ย่อแถบด้านข้าง'

  function toggleSidebar() {
    const collapsed = !sidebarCollapsed
    setSidebarCollapsed(collapsed)
    try {
      localStorage.setItem('ai-fit.sidebar-collapsed', String(collapsed))
    } catch {
      // The current view still responds if storage is unavailable.
    }
  }

  return <div className={sidebarCollapsed ? 'app-shell sidebar-collapsed' : 'app-shell'}>
    <aside className="sidebar" id="workspace-sidebar">
      <Brand />
      <Button className="sidebar-toggle" variant="outline" aria-label={toggleLabel} title={toggleLabel}
        aria-expanded={!sidebarCollapsed} aria-controls="workspace-sidebar" onClick={toggleSidebar}>
        {sidebarCollapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
      </Button>
      <nav aria-label="เมนูหลัก">
        {pages.map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} end={path === '/'}
          aria-label={label} title={sidebarCollapsed ? label : undefined}
          className={path === '/studio' ? 'studio-nav-link' : undefined}>
          <span className="nav-icon"><Icon size={19} strokeWidth={1.8} aria-hidden="true" /></span><span className="nav-label">{label}</span>
        </NavLink>)}
      </nav>
      <SignOutButton className="sidebar-sign-out" />
    </aside>
    <div className="workspace">
      <header className="topbar">
        <span className="topbar-label">{pageLabel}</span>
        <NavLink to="/profile" className="topbar-profile"
          aria-label={displayName ? `โปรไฟล์ของ ${displayName}` : undefined}>
          <AccountAvatar user={user} size="header" />
          <span className="topbar-profile-name">{displayName || 'โปรไฟล์'}</span>
        </NavLink>
      </header>
      <main key={pathname} className={pathname.replace(/\/$/, '') === '/studio'
        ? 'main-content route-enter studio-content' : 'main-content route-enter'}>
        <Routes>
          <Route path="/" element={<Dashboard catalog={catalog} userId={user.id} />} />
          <Route path="/studio" element={<Studio catalog={catalog} />} />
          <Route path="/exercise/:id" element={<ExercisePage catalog={catalog} />} />
          <Route path="/history" element={<History user={user} />} />
          <Route path="/profile" element={<Account user={user} profileState={profileState} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  </div>
}

function Dashboard({ catalog, userId }: { catalog: ReturnType<typeof useExercises>; userId: string }) {
  return <>
    <div className="page-heading">
      <h1>ภาพรวมการฝึก</h1>
      <p>พักจากหน้าคอมและติดตามการบริหารร่างกายของคุณ</p>
    </div>
    <section className="hero" aria-labelledby="hero-title">
      <img src={hero} alt="" className="hero-art" fetchPriority="high" />
      <div className="hero-copy">
        <h2 id="hero-title">พักจากโต๊ะ<br className="hero-break" /> แล้วขยับร่างกาย</h2>
        <p>ยืดเหยียดในช่วงพักและดูท่าทางของตัวเอง<br className="hero-break" /> ผ่านกล้องระหว่างฝึก</p>
        <Button asChild>
          <Link to="/studio"><Camera size={18} strokeWidth={2} />เปิดห้องฝึก</Link>
        </Button>
      </div>
    </section>
    <WorkoutOverview userId={userId} />
    <div className="dashboard-grid">
      <section className="panel prep-panel">
        <h2>เตรียมตัวก่อนฝึก</h2>
        <ul>
          {prepSteps.map(({ label, detail, icon: Icon, color }) => <li key={label}>
            <span className={`tile tile-${color}`}><Icon size={21} strokeWidth={1.8} /></span>
            <div><strong>{label}</strong><p>{detail}</p></div>
          </li>)}
        </ul>
      </section>
      <section className="panel catalog-panel">
        <h2>รายการท่า</h2>
        {catalog.exercises.length ? <ul className="exercise-list">
          {catalog.exercises.map((exercise) => <li key={exercise.id}>
            <Link to={`/exercise/${exercise.id}`}><Dumbbell size={17} />{exercise.name}<ChevronRight size={16} /></Link>
          </li>)}
        </ul> : <div className="catalog-empty" aria-live="polite">
          <span className="empty-illustration"><ClipboardList size={34} strokeWidth={1.6} /></span>
          <strong>{catalog.status === 'loading' ? 'กำลังโหลดรายการท่า' : catalog.status === 'error' ? 'โหลดรายการท่าไม่สำเร็จ' : 'รายการท่าอยู่ระหว่างเตรียม'}</strong>
          <p>{catalog.status === 'error' ? 'ลองเปิดหน้านี้ใหม่อีกครั้ง' : 'ระหว่างนี้ลองเปิดกล้องเพื่อจัดตำแหน่งได้'}</p>
          <Button variant="outline" asChild><Link to="/studio">ไปที่ห้องฝึก</Link></Button>
        </div>}
      </section>
    </div>
  </>
}

function ExercisePage({ catalog }: { catalog: ReturnType<typeof useExercises> }) {
  const { id } = useParams()
  const exercise = catalog.exercises.find((item) => item.id === id)
  if (!exercise) return <div className="panel status-panel">
    <h1>{catalog.status === 'loading' ? 'กำลังโหลดท่า' : 'ไม่พบข้อมูลท่า'}</h1>
    <Button variant="outline" asChild><Link to="/">กลับไปที่ภาพรวม</Link></Button>
  </div>
  const video = referenceVideoUrl(exercise.reference_video_key)
  return <>
    <div className="page-heading"><h1>{exercise.name}</h1>{exercise.description && <p>{exercise.description}</p>}</div>
    <section className="panel status-panel">
      <h2>คลิปตัวอย่าง</h2>
      {video ? <video className="reference-video" controls playsInline preload="metadata" src={video} />
        : <p>คลิปตัวอย่างอยู่ระหว่างเตรียม</p>}
      {exercise.camera_view && <p>มุมกล้องที่แนะนำ · {exercise.camera_view}</p>}
      <Button asChild><Link to={`/studio?exercise=${encodeURIComponent(exercise.id)}`}><Camera size={18} />เปิดห้องฝึก</Link></Button>
    </section>
  </>
}
