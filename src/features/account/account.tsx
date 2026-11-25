import { isAuthError, type Session, type User } from '@supabase/supabase-js'
import { CalendarDays, ChevronRight, Dumbbell, LogIn, LogOut, Pencil, UserRound, UserRoundPlus } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/button'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { isGoogleSignInEnabled, supabase } from '../../lib/supabase'
import { buildHistoryRows, exerciseName, type HistorySession } from '../workout/history-rows'

function accountReturnUrl() {
  return new URL('/', window.location.origin).href
}

function getAuthReturnMessage() {
  const url = new URL(window.location.href)
  const response = [url.searchParams, new URLSearchParams(url.hash.slice(1))]
  const error = response.find((params) => params.has('error') || params.has('error_code'))
  if (!error) return ''
  if (error.get('error_code') === 'otp_expired') {
    return 'ลิงก์ยืนยันอีเมลหมดอายุ กรุณาขอลิงก์ใหม่โดยสมัครด้วยอีเมลเดิม'
  }
  return 'ยืนยันตัวตนไม่สำเร็จ กรุณากลับไปลองเข้าสู่ระบบอีกครั้ง'
}

export function useAccount() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)
  const [verified, setVerified] = useState<{ token: string; user: User | null; expiresAt: number | undefined } | null>(null)
  const accessToken = session?.access_token
  const expiresAt = session?.expires_at

  useEffect(() => {
    if (!supabase) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) setVerified(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !accessToken) return
    let active = true
    void supabase.auth.getUser(accessToken).then(({ data, error }) => {
      if (!active) return
      const user = error || data.user?.is_anonymous ? null : data.user
      setVerified({ token: accessToken, user, expiresAt })
    }).catch(() => {
      if (active) setVerified({ token: accessToken, user: null, expiresAt })
    })
    return () => { active = false }
  }, [accessToken, expiresAt])

  if (!accessToken) return { user: null, loading: session === undefined }
  if (verified?.token === accessToken) return { user: verified.user, loading: false }

  // An already verified session can remain visible during a same-account token refresh.
  const previousUser = verified?.user
  if (previousUser && previousUser.id === session?.user?.id && (verified?.expiresAt ?? 0) * 1000 > Date.now()) {
    return { user: previousUser, loading: false }
  }
  return { user: null, loading: true }
}

export function Account({ user, profileState }: { user: User; profileState: ReturnType<typeof useProfile> }) {
  return <>
    <div className="page-heading"><h1>โปรไฟล์</h1><p>จัดการบัญชีและข้อมูลส่วนตัวของคุณ</p></div>
    <Profile key={user.id} user={user} profileState={profileState} />
  </>
}

export function SignOutButton({ className }: { className: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function signOut() {
    if (!confirming || pending || !supabase) return
    setPending(true)
    setFailed(false)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) setFailed(true)
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return <div className={className}>
    <Button variant="ghost" aria-label="ออกจากระบบ"
      title="ออกจากระบบ" onClick={() => {
        setFailed(false)
        setConfirming(true)
      }}>
      <LogOut size={17} aria-hidden="true" />
      <span className="sign-out-label">ออกจากระบบ</span>
    </Button>
    {confirming && <ConfirmDialog title="ออกจากระบบหรือไม่?"
      description="คุณจะกลับไปหน้าล็อกอิน และต้องเข้าสู่ระบบอีกครั้งเพื่อใช้งาน"
      confirmLabel="ยืนยันการออกจากระบบ" pendingLabel="กำลังออกจากระบบ" pending={pending}
      error={failed ? 'ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง' : undefined}
      onCancel={() => setConfirming(false)} onConfirm={() => void signOut()} />}
  </div>
}

export function SignIn({ register, onModeChange }: { register: boolean; onModeChange: (register: boolean) => void }) {
  const [pending, setPending] = useState<'email' | 'google' | null>(null)
  const [message, setMessage] = useState(getAuthReturnMessage)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const data = new FormData(event.currentTarget)
    const credentials = { email: String(data.get('email')).trim(), password: String(data.get('password')) }
    setPending('email')
    setMessage('')
    try {
      const result = register ? await supabase!.auth.signUp({
        ...credentials,
        options: { emailRedirectTo: accountReturnUrl() },
      })
        : await supabase!.auth.signInWithPassword(credentials)
      if (result.error) throw result.error
      if (!result.data.session) setMessage('ตรวจอีเมลเพื่อยืนยันบัญชีแล้วกลับมาเข้าสู่ระบบ')
    } catch (error) {
      if (isAuthError(error)) {
        if (error.code === 'over_email_send_rate_limit') {
          setMessage('ระบบส่งอีเมลยืนยันถึงขีดจำกัดแล้ว กรุณารอแล้วลองใหม่ หรือดำเนินการต่อด้วย Google')
          return
        }
        if (error.status === 429) {
          setMessage('มีคำขอมากเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง')
          return
        }
        if (error.code === 'email_address_not_authorized') {
          setMessage('ระบบยังส่งอีเมลยืนยันไปยังอีเมลนี้ไม่ได้ คุณสามารถดำเนินการต่อด้วย Google ได้')
          return
        }
        if (error.code === 'email_not_confirmed') {
          setMessage('กรุณาเปิดลิงก์ยืนยันในอีเมลก่อนเข้าสู่ระบบ หากไม่พบให้ตรวจโฟลเดอร์สแปม')
          return
        }
      }
      setMessage(register ? 'สมัครสมาชิกไม่สำเร็จ โปรดตรวจข้อมูลแล้วลองอีกครั้ง'
        : 'เข้าสู่ระบบไม่สำเร็จ โปรดตรวจอีเมลและรหัสผ่านแล้วลองอีกครั้ง')
    } finally {
      setPending(null)
    }
  }

  async function signInWithGoogle() {
    if (pending) return
    setPending('google')
    setMessage('')
    try {
      if (!await isGoogleSignInEnabled()) {
        setMessage('Google ยังไม่พร้อมใช้งานในขณะนี้ คุณสามารถเข้าสู่ระบบด้วยอีเมลได้')
        return
      }
      const { error } = await supabase!.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: accountReturnUrl(),
          queryParams: { prompt: 'select_account' },
        },
      })
      if (error) throw error
    } catch {
      setMessage('เชื่อมต่อ Google ไม่สำเร็จ กรุณาลองอีกครั้ง')
    } finally {
      setPending(null)
    }
  }

  return <section className="auth-card panel" aria-labelledby="auth-title">
    <div className="auth-form-heading">
      <span className="auth-mode-mark" key={register ? 'register' : 'sign-in'} aria-hidden="true">
        {register ? <UserRoundPlus size={26} strokeWidth={1.8} /> : <LogIn size={25} strokeWidth={1.8} />}
      </span>
      <div>
        <h1 id="auth-title">{register ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</h1>
        <p className="auth-caption">{register ? 'สร้างบัญชีเพื่อเริ่มฝึกกับ Office Reset' : 'เข้าสู่ Office Reset เพื่อเริ่มฝึก'}</p>
      </div>
    </div>
    <form className="account-form" onSubmit={submit}>
      <label>อีเมล<input name="email" type="email" autoComplete="email" placeholder="name@example.com" required /></label>
      <label>รหัสผ่าน<input name="password" type="password" placeholder={register ? 'อย่างน้อย 6 ตัวอักษร' : undefined} minLength={register ? 6 : undefined}
        autoComplete={register ? 'new-password' : 'current-password'} required /></label>
      <Button type="submit" disabled={pending !== null}>{pending === 'email' ? 'กำลังดำเนินการ' : register ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</Button>
    </form>
    <div className="auth-divider">หรือ</div>
    <Button className="auth-google" variant="outline" disabled={pending !== null} onClick={() => void signInWithGoogle()}>
      <LogIn size={17} aria-hidden="true" />{pending === 'google' ? 'กำลังเปิด Google' : 'ดำเนินการต่อด้วย Google'}
    </Button>
    {message && <p className="notice" role="status">{message}</p>}
    <div className="auth-switch">
      <span>{register ? 'มีบัญชีแล้ว' : 'ยังไม่มีบัญชี'}</span>
      <Button variant="ghost" disabled={pending !== null} onClick={() => { onModeChange(!register); setMessage('') }}>
        {register ? 'กลับไปเข้าสู่ระบบ' : 'สร้างบัญชีใหม่'}
      </Button>
    </div>
  </section>
}

type ProfileFields = {
  display_name: string | null
  age: number | null
  height_cm: number | null
  weight_kg: number | null
  experience_level: string | null
}

const experienceOptions = [
  { value: 'beginner', label: 'เพิ่งเริ่มออกกำลังกาย' },
  { value: 'occasional', label: 'ออกกำลังกายเป็นครั้งคราว' },
  { value: 'regular', label: 'ออกกำลังกายเป็นประจำ' },
]

function accountAvatarUrl(metadata: User['user_metadata']) {
  for (const value of [metadata.avatar_url, metadata.picture]) {
    if (typeof value !== 'string') continue
    try {
      const url = new URL(value)
      if (url.protocol === 'https:' && !url.username && !url.password) return url.href
    } catch {
      continue
    }
  }
  return null
}

export function AccountAvatar({ user, size }: { user: User | null; size: 'header' | 'profile' }) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null)
  const avatarUrl = user ? accountAvatarUrl(user.user_metadata) : null
  return <span className={`account-avatar account-avatar-${size}`} aria-hidden="true">
    <UserRound size={size === 'profile' ? 31 : 17} strokeWidth={1.7} />
    {avatarUrl && failedAvatar !== avatarUrl && <img src={avatarUrl} alt="" referrerPolicy="no-referrer"
      onError={() => setFailedAvatar(avatarUrl)} />}
  </span>
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<ProfileFields | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    if (!supabase || !userId) return
    const controller = new AbortController()
    void supabase.from('profiles').select('display_name, age, height_cm, weight_kg, experience_level')
      .eq('id', userId).abortSignal(controller.signal).maybeSingle().then(({ data, error }) => {
        if (controller.signal.aborted) return
        if (error) setLoadFailed(true)
        else setProfile(data ?? { display_name: null, age: null, height_cm: null, weight_kg: null, experience_level: null })
      })
    return () => controller.abort()
  }, [userId])

  return { profile, setProfile, loadFailed }
}

function Profile({ user, profileState }: { user: User; profileState: ReturnType<typeof useProfile> }) {
  const { profile, setProfile, loadFailed } = profileState
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [draftToSave, setDraftToSave] = useState<ProfileFields | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const editingStarted = useRef(false)
  const editButton = useRef<HTMLButtonElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      nameInput.current?.focus({ preventScroll: true })
    } else if (editingStarted.current) {
      editButton.current?.focus({ preventScroll: true })
      editingStarted.current = false
    }
  }, [editing])

  function requestSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || draftToSave) return
    const data = new FormData(event.currentTarget)
    const text = (key: string) => String(data.get(key) ?? '').trim() || null
    const number = (key: string) => text(key) === null ? null : Number(text(key))
    setDraftToSave({
      display_name: text('display_name'), age: number('age'),
      height_cm: number('height_cm'), weight_kg: number('weight_kg'), experience_level: text('experience_level'),
    })
    setSaveFailed(false)
  }

  async function save() {
    if (!draftToSave || busy || !supabase) return
    setBusy(true)
    setSaveFailed(false)
    try {
      const { error } = await supabase.from('profiles').upsert({ id: user.id, ...draftToSave })
      if (error) throw error
      setProfile(draftToSave)
      setDraftToSave(null)
      setEditing(false)
      setMessage('บันทึกโปรไฟล์แล้ว')
    } catch {
      setSaveFailed(true)
    } finally {
      setBusy(false)
    }
  }
  const experience = profile?.experience_level
  const experienceLabel = experienceOptions.find(({ value }) => value === experience)?.label
  const previousExperience = experience && !experienceLabel ? experience : null
  const providerName = [user.user_metadata.full_name, user.user_metadata.name]
    .find((value): value is string => typeof value === 'string' && Boolean(value.trim()))
  const details = profile ? [
    { label: 'ชื่อที่แสดง', value: profile.display_name },
    { label: 'อายุ', value: profile.age === null ? null : `${profile.age} ปี` },
    { label: 'ส่วนสูง', value: profile.height_cm === null ? null : `${profile.height_cm} ซม.` },
    { label: 'น้ำหนัก', value: profile.weight_kg === null ? null : `${profile.weight_kg} กก.` },
    { label: 'ประสบการณ์ออกกำลังกาย', value: experienceLabel ?? experience },
  ] : []

  return <div className="profile-layout">
    <section className="panel status-panel profile-panel" aria-labelledby="profile-details">
      <div className="profile-identity">
        <AccountAvatar user={user} size="profile" />
        <div>
          <h2 id="profile-details">{profile?.display_name || providerName || 'ข้อมูลบัญชี'}</h2>
          {user.email && <p className="profile-email">{user.email}</p>}
        </div>
      </div>
      {profile && !editing && <section className="profile-details" aria-labelledby="profile-personal">
        <div className="profile-details-header">
          <h3 id="profile-personal">ข้อมูลส่วนตัว</h3>
          <Button ref={editButton} variant="outline" disabled={busy} onClick={() => {
            editingStarted.current = true
            setMessage('')
            setEditing(true)
          }}><Pencil size={16} aria-hidden="true" />แก้ไขโปรไฟล์</Button>
        </div>
        <dl className="profile-values">
          {details.map(({ label, value }) => <div className="profile-value" key={label}>
            <dt>{label}</dt>
            <dd className={value ? undefined : 'muted'}>{value || 'ยังไม่ระบุ'}</dd>
          </div>)}
        </dl>
      </section>}
      {profile && editing && <form className="account-form profile-form" onSubmit={requestSave}>
        <fieldset disabled={busy}>
          <legend>ข้อมูลส่วนตัว</legend>
          <p className="profile-hint">ทุกช่องเว้นว่างได้ และกลับมาแก้ไขภายหลังได้</p>
          <label>ชื่อที่แสดง
            <input ref={nameInput} name="display_name" autoComplete="nickname" placeholder="เช่น มิน" defaultValue={profile.display_name ?? ''} maxLength={100} />
          </label>
          <div className="profile-measurements">
            <label>อายุ (ปี)
              <input name="age" type="number" inputMode="numeric" min={1} step={1} placeholder="เช่น 22"
                aria-describedby="profile-age-hint" defaultValue={profile.age ?? ''} />
              <span id="profile-age-hint" className="profile-hint">กรอกเป็นจำนวนเต็ม</span>
            </label>
            <label>ส่วนสูง (ซม.)
              <input name="height_cm" type="number" inputMode="decimal" min={1} step="any" placeholder="เช่น 165.5"
                defaultValue={profile.height_cm ?? ''} />
            </label>
            <label>น้ำหนัก (กก.)
              <input name="weight_kg" type="number" inputMode="decimal" min={1} step="any" placeholder="เช่น 58.5"
                defaultValue={profile.weight_kg ?? ''} />
            </label>
          </div>
          <label>ประสบการณ์ออกกำลังกาย
            <select name="experience_level" defaultValue={experience ?? ''}>
              <option value="">ไม่ระบุ</option>
              {experienceOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              {previousExperience && <option value={previousExperience}>{previousExperience} (ข้อมูลเดิม)</option>}
            </select>
          </label>
        </fieldset>
        <div className="profile-actions">
          <Button variant="outline" disabled={busy} onClick={() => { setMessage(''); setEditing(false) }}>ยกเลิก</Button>
          <Button type="submit" disabled={busy}>{busy ? 'กำลังบันทึก' : 'บันทึกโปรไฟล์'}</Button>
        </div>
      </form>}
      {!profile && !message && <p role="status">{loadFailed ? 'โหลดข้อมูลโปรไฟล์ไม่สำเร็จ' : 'กำลังโหลดข้อมูลโปรไฟล์'}</p>}
      {message && <p className="notice" role="status">{message}</p>}
    </section>
    {!editing && <SignOutButton className="profile-account-actions" />}
    {draftToSave && <ConfirmDialog title="บันทึกโปรไฟล์หรือไม่?"
      description="ยืนยันเพื่อบันทึกข้อมูลโปรไฟล์ที่แก้ไขไว้"
      confirmLabel="ยืนยันการบันทึก" pendingLabel="กำลังบันทึก" pending={busy}
      error={saveFailed ? 'บันทึกโปรไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง' : undefined}
      onCancel={() => setDraftToSave(null)} onConfirm={() => void save()} />}
  </div>
}

const dateFormat = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

function feedbackMessages(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(feedbackMessages)
  if (typeof value !== 'object' || value === null || !('message' in value) || typeof value.message !== 'string') return []
  return [value.message]
}

export function History({ user }: { user: User | null }) {
  const [params] = useSearchParams()
  return <>
    <div className="page-heading"><h1>ประวัติการฝึก</h1><p>ดูผลการฝึกที่ผ่านมาและรายละเอียดแต่ละครั้ง</p></div>
    {user && supabase ? <HistoryResults key={user.id} userId={user.id}
      selectedExerciseId={params.get('exercise')} selectedId={params.get('session')} /> :
      <section className="panel status-panel narrow">
        <span className="tile"><CalendarDays size={22} /></span>
        <h2>ประวัติของคุณ</h2>
        <p>{supabase ? 'เข้าสู่ระบบเพื่อดูประวัติการฝึกของคุณ' : 'ประวัติการฝึกจะพร้อมเมื่อเชื่อมต่อบัญชี'}</p>
        <Button asChild variant="outline"><Link to="/profile">ดูสถานะบัญชี</Link></Button>
      </section>}
  </>
}

function HistoryResults({ userId, selectedExerciseId, selectedId }: {
  userId: string
  selectedExerciseId: string | null
  selectedId: string | null
}) {
  const [sessions, setSessions] = useState<HistorySession[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => {
    const controller = new AbortController()
    void supabase!.from('workout_sessions')
      .select('id, started_at, total_reps, overall_score, workout_exercises(id, exercise_id, total_reps, exercises(name), rep_evaluations(rep_number, form_score, feedback))')
      .eq('user_id', userId).order('started_at', { ascending: false }).order('id', { ascending: false })
      .abortSignal(controller.signal).then(({ data, error }) => {
        if (controller.signal.aborted) return
        if (error) setStatus('error')
        else {
          setSessions(data)
          setStatus('ready')
        }
      })
    return () => controller.abort()
  }, [userId])

  if (status !== 'ready') return <p className="panel status-panel" role="status">
    {status === 'loading' ? 'กำลังโหลดประวัติ' : 'โหลดประวัติไม่สำเร็จ กรุณาลองเปิดหน้าใหม่'}
  </p>

  const rows = buildHistoryRows(sessions)
  const visibleRows = selectedExerciseId ? rows.filter(({ exerciseId }) => exerciseId === selectedExerciseId) : rows
  const selectedRow = selectedId ? visibleRows.find(({ session }) => session.id === selectedId) : undefined
  const selected = selectedExerciseId ? selectedRow?.session : sessions.find(({ id }) => id === selectedId)
  if (selectedId && !selected) return <section className="panel status-panel">
    <Link className="text-link" to="/history">กลับไปที่ประวัติ</Link>
    <h2>ไม่พบผลการฝึก</h2>
  </section>

  if (selected) {
    const entries = selected.workout_exercises.filter((entry) => !selectedExerciseId || entry.exercise_id === selectedExerciseId)
    const dateLabel = dateFormat.format(new Date(selected.started_at))
    return <section className="panel status-panel">
      <Link className="text-link" to="/history">กลับไปที่ประวัติ</Link>
      <h2 tabIndex={-1} data-quick-tip-target="history-result">{selectedExerciseId ? selectedRow?.name : dateLabel}</h2>
      {selectedExerciseId && <p><time dateTime={selected.started_at}>{dateLabel}</time></p>}
      <p>{selectedExerciseId ? selectedRow?.reps : selected.total_reps} รอบ · คะแนนรวมการฝึก {selected.overall_score ?? 'N/A'}</p>
      {entries.map((entry) => <div key={entry.id}>
        {!selectedExerciseId && <h3>{exerciseName(entry)}</h3>}
        {entry.rep_evaluations.length === 0 ? <p>ไม่มีรอบที่ประเมินได้ในครั้งนี้</p> : <ol className="rep-list">
          {entry.rep_evaluations.slice().sort((a, b) => a.rep_number - b.rep_number).map((rep) => <li key={rep.rep_number}>
            <strong>ครั้งที่ {rep.rep_number} · {rep.form_score} คะแนน</strong>
            {feedbackMessages(rep.feedback).map((message, index) => <p key={index}>{message}</p>)}
          </li>)}
        </ol>}
      </div>)}
    </section>
  }

  return <section className="panel status-panel">
    {selectedExerciseId && <Link className="text-link" to="/history">ดูรายการฝึกทั้งหมด</Link>}
    <h2 tabIndex={visibleRows.length ? undefined : -1} data-quick-tip-target={visibleRows.length ? undefined : 'history-empty'}>
      {visibleRows.length ? 'รายการฝึกที่ผ่านมา' : 'ยังไม่มีประวัติการฝึก'}
    </h2>
    {visibleRows.length > 0 && <ul className="exercise-list history-list">
      {visibleRows.map(({ exerciseId, name, reps, session }, index) => <li key={`${session.id}/${exerciseId}`}>
        <Link to={`/history?${new URLSearchParams({ exercise: exerciseId, session: session.id })}`}
          data-quick-tip-target={index === 0 ? 'choose-history' : undefined}>
          <Dumbbell size={19} aria-hidden="true" />
          <span><strong>{name}</strong>
            <small><time dateTime={session.started_at}>{dateFormat.format(new Date(session.started_at))}</time>
              {' · '}{reps} รอบ · คะแนนรวม {session.overall_score ?? 'N/A'}</small></span>
          <ChevronRight size={17} aria-hidden="true" />
        </Link>
      </li>)}
    </ul>}
  </section>
}
