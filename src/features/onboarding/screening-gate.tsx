import { ClipboardList } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '../../components/ui/button'
import { supabase } from '../../lib/supabase'
import { SignOutButton } from '../account/account'
import {
  buildScreeningAnswers, dailyImpacts, habits, isMissingScreeningTable, maxOccupationLength, painAreas, painDurations,
} from './screening'

type Status = 'checking' | 'required' | 'completed' | 'unavailable' | 'error'

export function ScreeningGate({ userId, brand, children }: {
  userId: string
  brand: ReactNode
  children: ReactNode
}) {
  const [status, setStatus] = useState<Status>('checking')
  const [checkAttempt, setCheckAttempt] = useState(0)

  useEffect(() => {
    const client = supabase
    if (!client) return
    const request = new AbortController()
    void (async () => {
      try {
        const { data, error } = await client.from('first_login_screenings').select('completed_at')
          .eq('user_id', userId).abortSignal(request.signal).maybeSingle()
        if (request.signal.aborted) return
        if (error) setStatus(isMissingScreeningTable(error.code) ? 'unavailable' : 'error')
        else setStatus(data ? 'completed' : 'required')
      } catch {
        if (!request.signal.aborted) setStatus('error')
      }
    })()
    return () => request.abort()
  }, [checkAttempt, userId])

  if (status === 'completed') return children

  return <div className="auth-page screening-page">
    <header className="auth-header screening-header">
      {brand}
      <SignOutButton className="screening-sign-out" />
    </header>
    <main className="panel auth-card screening-card" aria-labelledby="screening-title" aria-busy={status === 'checking'}>
      <div className="auth-form-heading">
        <span className="auth-mode-mark"><ClipboardList size={25} strokeWidth={1.8} aria-hidden="true" /></span>
        <div>
          <h1 id="screening-title">แบบคัดกรองก่อนเริ่มฝึก</h1>
          {status === 'required' && <p className="auth-caption">ตอบ 6 ข้อครั้งเดียว คำตอบจะบันทึกไว้ในบัญชีของคุณ</p>}
        </div>
      </div>
      {status === 'checking' && <p role="status">กำลังตรวจสอบสถานะแบบคัดกรอง</p>}
      {status === 'required' && <ScreeningForm onComplete={() => setStatus('completed')} />}
      {(status === 'error' || status === 'unavailable') && <>
        <p className="notice notice-error" role="alert">{status === 'unavailable'
          ? 'ระบบคัดกรองยังไม่พร้อม คุณสามารถเข้าใช้งานก่อนได้'
          : 'ตรวจสอบสถานะแบบคัดกรองไม่สำเร็จ กรุณาลองอีกครั้ง'}</p>
        <div className="screening-actions">
          <Button variant="outline" onClick={() => {
            setStatus('checking')
            setCheckAttempt((attempt) => attempt + 1)
          }}>ลองอีกครั้ง</Button>
          {status === 'unavailable' && <Button onClick={() => setStatus('completed')}>เข้าใช้งานก่อน</Button>}
        </div>
      </>}
    </main>
  </div>
}

function ScreeningForm({ onComplete }: { onComplete: () => void }) {
  const [noPain, setNoPain] = useState(false)
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [painScore, setPainScore] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const painHeading = useRef<HTMLLegendElement>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const client = supabase
    if (!client || pending.current) return
    const answers = buildScreeningAnswers(new FormData(event.currentTarget))
    if (!answers) {
      if (!noPain && !selectedAreas.length) {
        setError('กรุณาเลือกบริเวณที่ปวด หรือเลือกไม่มีอาการปวดในข้อ 3')
        painHeading.current?.focus()
      } else {
        setError('กรุณาตรวจคำตอบให้ครบก่อนบันทึก')
      }
      return
    }

    pending.current = true
    setSaving(true)
    setError('')
    try {
      const { error } = await client.from('first_login_screenings')
        .upsert(answers, { onConflict: 'user_id', ignoreDuplicates: true })
      if (error) throw error
      onComplete()
    } catch {
      setError('บันทึกคำตอบไม่สำเร็จ คำตอบยังอยู่ในหน้านี้ กรุณาลองอีกครั้ง')
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  return <form className="screening-form" onSubmit={submit}>
    <fieldset className="screening-questions" disabled={saving}>
      <label className="screening-occupation">
        <strong>1. ปัจจุบันท่านประกอบอาชีพอะไร?</strong>
        <input name="occupation" type="text" maxLength={maxOccupationLength} required
          autoComplete="off" placeholder="เช่น พนักงานสำนักงาน นักศึกษา" />
      </label>

      <fieldset className="screening-question">
        <legend>2. ท่านมีพฤติกรรมใดเป็นประจำ?</legend>
        <p>เลือกได้หลายข้อ หากไม่มีให้เว้นว่าง</p>
        <div className="screening-options">
          {habits.map(([value, label]) => <label key={value}><input type="checkbox" name="habits" value={value} />{label}</label>)}
        </div>
      </fieldset>

      <fieldset className="screening-question">
        <legend ref={painHeading} tabIndex={-1}>3. ท่านปวดบริเวณใดบ้าง?</legend>
        <p>เลือกได้หลายข้อ</p>
        <div className="screening-options">
          {painAreas.map(([value, label]) => <label key={value}>
            <input type="checkbox" name="pain_areas" value={value} disabled={noPain}
              checked={selectedAreas.includes(value)} onChange={(event) => {
                const checked = event.currentTarget.checked
                setSelectedAreas((areas) => checked ? [...areas, value] : areas.filter((area) => area !== value))
                setError('')
              }} />{label}
          </label>)}
          <label><input type="checkbox" name="no_pain" value="yes" checked={noPain} onChange={(event) => {
            const checked = event.currentTarget.checked
            setNoPain(checked)
            if (checked) {
              setSelectedAreas([])
              setPainScore(0)
            }
            setError('')
          }} />ไม่มีอาการปวด</label>
        </div>
      </fieldset>

      <fieldset className="screening-question" disabled={noPain}>
        <legend>4. ท่านมีอาการปวดมานานเท่าใด?</legend>
        {noPain ? <p>ข้ามข้อนี้เมื่อไม่มีอาการปวด</p> : <div className="screening-options">
          {painDurations.map(([value, label]) => <label key={value}>
            <input type="radio" name="pain_duration" value={value} required={selectedAreas.length > 0} />{label}
          </label>)}
        </div>}
      </fieldset>

      <fieldset className="screening-question" disabled={noPain}>
        <legend><label htmlFor="screening-pain-score">5. ระดับความปวดของท่าน (Pain Score) อยู่ที่เท่าใด?</label></legend>
        <div className="screening-scale">
          <input id="screening-pain-score" name="pain_score" type="range" min={0} max={10} step={1}
            value={painScore} aria-describedby="screening-score-ends"
            onChange={(event) => setPainScore(event.currentTarget.valueAsNumber)} />
          <output htmlFor="screening-pain-score">{painScore} / 10</output>
        </div>
        <p className="screening-scale-ends" id="screening-score-ends"><span>0 = ไม่ปวด</span><span>10 = ปวดมากที่สุด</span></p>
      </fieldset>

      <fieldset className="screening-question" disabled={noPain}>
        <legend>6. อาการปวดส่งผลต่อชีวิตประจำวันหรือไม่?</legend>
        {noPain ? <p>ไม่ส่งผล</p> : <div className="screening-options">
          {dailyImpacts.map(([value, label]) => <label key={value}>
            <input type="radio" name="daily_impact" value={value} required={selectedAreas.length > 0} />{label}
          </label>)}
        </div>}
      </fieldset>
    </fieldset>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    <div className="screening-actions">
      <Button type="submit" disabled={saving}>{saving ? 'กำลังบันทึก' : 'บันทึกและเข้าใช้งาน'}</Button>
    </div>
  </form>
}
