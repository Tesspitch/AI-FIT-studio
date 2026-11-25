import { Activity, ArrowUpRight, CalendarDays, Repeat2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/button'
import { supabase } from '../../lib/supabase'

type SessionResult = {
  id: string
  started_at: string
  total_reps: number
  overall_score: number | null
}

type OverviewState =
  | { status: 'loading' | 'error' }
  | { status: 'ready'; sessions: SessionResult[] }

const sessionLimit = 10
const chartLimit = 7
const shortDate = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' })
const fullDate = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
const scoreFormat = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1 })
const deltaFormat = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1, signDisplay: 'exceptZero' })

export function WorkoutOverview({ userId }: { userId: string }) {
  const [result, setResult] = useState<OverviewState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const client = supabase
    if (!client) return
    const controller = new AbortController()
    void client.from('workout_sessions')
      .select('id, started_at, total_reps, overall_score')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(sessionLimit)
      .abortSignal(controller.signal)
      .then(({ data, error }) => {
        if (controller.signal.aborted) return
        setResult(error ? { status: 'error' } : { status: 'ready', sessions: data })
      })
    return () => controller.abort()
  }, [userId, attempt])

  return <section className="panel workout-overview" aria-labelledby="workout-overview-title">
    <div className="panel-heading">
      <h2 id="workout-overview-title">สรุปการฝึก</h2>
      <Link to="/history" className="text-link">ดูประวัติ <ArrowUpRight size={16} aria-hidden="true" /></Link>
    </div>
    {result.status === 'loading' && <p className="workout-message" role="status">กำลังโหลดผลการฝึก</p>}
    {result.status === 'error' && <div className="workout-message" role="status">
      <p>โหลดผลการฝึกไม่สำเร็จ</p>
      <Button variant="outline" onClick={() => {
        setResult({ status: 'loading' })
        setAttempt((current) => current + 1)
      }}>ลองอีกครั้ง</Button>
    </div>}
    {result.status === 'ready' && (result.sessions.length ? <WorkoutResults sessions={result.sessions} /> :
      <div className="workout-empty">
        <span className="tile"><Activity size={20} aria-hidden="true" /></span>
        <div><strong>ยังไม่มีผลการฝึกที่บันทึก</strong><p>เมื่อมีผลการฝึก คะแนนและแนวโน้มจะแสดงที่นี่</p></div>
      </div>)}
  </section>
}

function WorkoutResults({ sessions }: { sessions: SessionResult[] }) {
  const scored = sessions.filter((session): session is SessionResult & { overall_score: number } =>
    typeof session.overall_score === 'number' && Number.isFinite(session.overall_score)
    && session.overall_score >= 0 && session.overall_score <= 100)
  const totalReps = sessions.reduce((total, { total_reps }) => total + total_reps, 0)
  const average = scored.length ? scored.reduce((total, { overall_score }) => total + overall_score, 0) / scored.length : null
  const points = scored.slice(0, chartLimit).reverse()
  const delta = scored.length > 1 ? Math.round((scored[0].overall_score - scored[1].overall_score) * 10) / 10 : null

  return <>
    <p className="workout-period">{sessions.length} การฝึกล่าสุด</p>
    <dl className="workout-metrics">
      <div><dt><CalendarDays size={17} aria-hidden="true" />ครั้งที่ฝึก</dt><dd>{sessions.length}</dd></div>
      <div><dt><Repeat2 size={17} aria-hidden="true" />จำนวน Rep</dt><dd>{scoreFormat.format(totalReps)}</dd></div>
      <div><dt><Activity size={17} aria-hidden="true" />คะแนนเฉลี่ย</dt>
        <dd>{average === null ? '—' : <>{scoreFormat.format(average)} <small>/ 100</small></>}</dd></div>
    </dl>
    <div className="workout-trend-heading">
      <h3>แนวโน้มคะแนน</h3>
      {delta !== null && <span className="score-change">เทียบคะแนนก่อนหน้า {deltaFormat.format(delta)} คะแนน</span>}
    </div>
    {points.length ? <div className="workout-chart">
      <div className="score-axis" aria-hidden="true"><span>100</span><span>50</span><span>0</span></div>
      <ol className="score-points" aria-label="คะแนนการฝึก เรียงจากเก่าไปใหม่">
        {points.map(({ id, started_at, overall_score }) => {
          const date = new Date(started_at)
          const score = scoreFormat.format(overall_score)
          return <li key={id} className="score-point">
            <Link className="score-plot-link" to={`/history?session=${encodeURIComponent(id)}`}
              aria-label={`${fullDate.format(date)} · ${score} คะแนนจาก 100`}>
              <span className="score-bar" style={{ height: `${overall_score}%` }} />
              <span className="score-number" style={{ bottom: `${overall_score}%` }}>{score}</span>
            </Link>
            <time dateTime={started_at}>{shortDate.format(date)}</time>
          </li>
        })}
      </ol>
    </div> : <p className="workout-message">ยังไม่มีคะแนนรวมในผลการฝึกล่าสุด</p>}
  </>
}
