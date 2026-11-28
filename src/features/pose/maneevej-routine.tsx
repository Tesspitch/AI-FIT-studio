import { Camera, Check, ChevronDown, Clapperboard, Focus, RotateCcw, ShieldCheck, SkipForward, Volume2 } from 'lucide-react'
import { useCallback, useEffect, useReducer, useRef, useState, type Ref } from 'react'
import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision'
import { Link, useNavigate } from 'react-router-dom'
import sawasdeeClip from '../../assets/maneevej/1.mp4'
import moPaengClip from '../../assets/maneevej/2.mp4'
import removeShirtClip from '../../assets/maneevej/3.mp4'
import backstrokeClip from '../../assets/maneevej/4.mp4'
import releaseEnergyClip from '../../assets/maneevej/5.mp4'
import preparationClip from '../../assets/maneevej/get_ready.mp4'
import { BackButton } from '../../components/ui/back-button'
import { Button } from '../../components/ui/button'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { saveManeevejRoutine, type ManeevejWorkout } from '../workout/save-maneevej-routine'
import {
  createManeevejTracker, maneevejExercises, measureManeevej, updateManeevej, type ManeevejExercise,
} from './maneevej'
import {
  formatRoutineTime, getRestSeconds, getRoundScore, getRoundSeconds, initialSession, roundsPerExercise,
  routineReducer, summarizeManeevej, totalRounds, type RecordedRound, type RoundResult,
} from './maneevej-session'
import { ReferencePreview } from './reference-preview'
import { measureRoundQuality, roundQualityTip } from './maneevej-scoring'
import { useCamera } from './use-camera'

const demoClips: Record<ManeevejExercise['id'], string> = {
  sawasdee: sawasdeeClip,
  'mo-paeng': moPaengClip,
  'remove-shirt': removeShirtClip,
  backstroke: backstrokeClip,
  'release-energy': releaseEnergyClip,
}

export function ManeevejRoutine() {
  const navigate = useNavigate()
  const [session, dispatch] = useReducer(routineReducer, initialSession)
  const [run, setRun] = useState<Pick<ManeevejWorkout, 'id' | 'startedAt'> | null>(null)
  const [confirmExit, setConfirmExit] = useState(false)
  const [clipInfo, setClipInfo] = useState<{ roundIndex: number; duration: number | null } | null>(null)
  const [blockedSoundRound, setBlockedSoundRound] = useState<number | null>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const clipRef = useRef<HTMLVideoElement>(null)
  const { roundIndex, testOnly } = session
  const exerciseIndex = Math.floor(roundIndex / roundsPerExercise)
  const round = roundIndex % roundsPerExercise + 1
  const exercise = maneevejExercises[exerciseIndex]
  const clip = exercise && demoClips[exercise.id]
  const clipDuration = !clip ? null : clipInfo?.roundIndex === roundIndex ? clipInfo.duration : undefined
  const active = session.phase === 'active'
  const preparing = session.phase === 'ready'
  const resting = session.phase === 'rest'
  const done = session.phase === 'done'
  const lastExercise = exerciseIndex === maneevejExercises.length - 1

  useEffect(() => {
    title.current?.focus()
  }, [session.phase, roundIndex])

  function registerClipDuration(duration: number | null) {
    setClipInfo({ roundIndex, duration })
  }

  const playRoundClip = useCallback(() => {
    const video = clipRef.current
    if (!video) return
    video.currentTime = 0
    void video.play().catch((error: unknown) => {
      if (clipRef.current !== video || !(error instanceof DOMException) || error.name !== 'NotAllowedError') return
      video.muted = true
      setBlockedSoundRound(roundIndex)
      void video.play().catch(() => {})
    })
  }, [roundIndex])

  function enableClipSound() {
    const video = clipRef.current
    if (!video || video.ended) return
    video.muted = false
    void video.play().then(() => {
      if (clipRef.current === video) setBlockedSoundRound(null)
    }).catch(() => {
      if (clipRef.current === video) {
        video.muted = true
        void video.play().catch(() => {})
      }
    })
  }

  const finishRound = useCallback((result: RoundResult) => {
    dispatch({ type: 'finish', roundIndex, finishedAt: Date.now(), result })
  }, [roundIndex])

  const finishRest = useCallback(() => {
    dispatch({ type: 'rest-ended', roundIndex, now: Date.now() })
  }, [roundIndex])

  function startRoutine() {
    setClipInfo(null)
    setBlockedSoundRound(null)
    setRun({ id: crypto.randomUUID(), startedAt: Date.now() })
    dispatch({ type: 'start', roundIndex })
  }

  return <>
    <div className="page-heading back-heading studio-heading">
      <BackButton label="กลับไปเลือกท่า" onClick={() => !done && (active || roundIndex > 0)
        ? setConfirmExit(true) : navigate('/studio')} />
      <h1>ชุดบริหารมณีเวช</h1>
    </div>
    <ol className="routine-progress" aria-label="ลำดับท่าในชุด">
      {maneevejExercises.map(({ id, name }, index) => <li key={id} aria-current={index === exerciseIndex ? 'step' : undefined}
        data-complete={(!testOnly && index < exerciseIndex) || undefined}>
        <span aria-hidden="true">{!testOnly && index < exerciseIndex ? <Check size={14} /> : index + 1}</span>{name}
      </li>)}
    </ol>
    {(active || done) && <div className="routine-heading">
      <p>{done ? (testOnly ? 'โหมดทดสอบ' : `ครบทั้ง 5 ท่า · ${totalRounds} รอบ`)
        : `รอบที่ ${round} / ${roundsPerExercise}`}</p>
      <h2 ref={title} tabIndex={-1}>{done ? (testOnly ? 'จบการทดสอบ' : 'จบชุดบริหารมณีเวช') : exercise.name}</h2>
    </div>}
    {preparing ? <section className="panel routine-preparation" aria-labelledby="routine-ready-title">
      <div className="routine-preparation-heading">
        <span className="tile" aria-hidden="true"><Focus size={22} /></span>
        <div>
          <h2 id="routine-ready-title" ref={title} tabIndex={-1}>เตรียมตัวก่อนฝึก</h2>
          <p>เริ่มจาก{maneevejExercises[0].name} · 5 ท่า ท่าละ {roundsPerExercise} รอบ</p>
        </div>
      </div>
      <ReferencePreview src={preparationClip} exerciseName="เตรียมตัวก่อนฝึก" loop={false} muted={false} />
      <ol>
        <li><strong>จัดพื้นที่ให้พร้อม</strong><span>เว้นที่ให้กางแขนและขยับได้สะดวก</span></li>
        <li><strong>ตั้งกล้องไว้ด้านหน้า</strong><span>ให้เห็นไหล่ สะโพก และแขนทั้งสองข้างตลอดการฝึก</span></li>
        <li><strong>เตรียมตัวทำตามคลิป</strong><span>กดเริ่มและอนุญาตให้ใช้กล้องเมื่อเบราว์เซอร์ถาม คลิปจะเล่นจากต้นพร้อมตัวจับเวลาเมื่อกล้องพร้อม</span></li>
      </ol>
      <Button onClick={startRoutine}><Camera size={18} aria-hidden="true" />เริ่มออกกำลังกาย</Button>
    </section> : resting && session.restUntil !== null
      ? <RoutineRest key={roundIndex} restUntil={session.restUntil} restSeconds={getRestSeconds(roundIndex)}
        round={round} nextExercise={exercise.name} titleRef={title} onEnd={finishRest}
        onSkip={import.meta.env.DEV ? () => dispatch({ type: 'skip-rest', roundIndex }) : undefined} />
      : active ? <div className="studio-grid routine-grid">
      <RoutineReference key={`clip-${roundIndex}`} exercise={exercise} src={clip} videoRef={clipRef}
        onDuration={registerClipDuration} onEnableSound={blockedSoundRound === roundIndex ? enableClipSound : undefined} />
      <RoutineCamera key={roundIndex} exercise={exercise} round={round}
        clipDuration={clipDuration} onBegin={playRoundClip} onFinish={finishRound}
        onFinishEarly={import.meta.env.DEV && round < roundsPerExercise
          ? (result) => dispatch({ type: 'finish', roundIndex, finishedAt: Date.now(), result, early: true }) : undefined}
        onSkipExercise={import.meta.env.DEV
          ? (result) => dispatch({ type: 'skip-exercise', roundIndex, result }) : undefined}
        lastExercise={lastExercise} />
    </div> : run && <RoutineSummary run={run} rounds={session.rounds} testOnly={testOnly}
      onRestart={() => dispatch({ type: 'restart' })} />}
    {confirmExit && <ConfirmDialog title="ออกจากชุดฝึกหรือไม่?"
      description="หากออกตอนนี้ คุณจะต้องเริ่มชุดใหม่" confirmLabel="ออกจากชุดฝึก" pendingLabel="กำลังออก"
      pending={false} onCancel={() => setConfirmExit(false)} onConfirm={() => navigate('/studio')} />}
  </>
}

function RoutineSummary({ run, rounds, testOnly, onRestart }: {
  run: Pick<ManeevejWorkout, 'id' | 'startedAt'>
  rounds: RecordedRound[]
  testOnly: boolean
  onRestart: () => void
}) {
  const [workout] = useState(() => ({ ...run, endedAt: Math.max(run.startedAt, Date.now()), rounds }))
  const [status, setStatus] = useState<'saving' | 'saved' | 'error' | 'test'>(testOnly ? 'test' : 'saving')
  const attempted = useRef(false)
  const pending = useRef(false)
  const summary = summarizeManeevej(rounds)

  const persist = useCallback(async () => {
    if (testOnly || pending.current) return
    pending.current = true
    setStatus('saving')
    try {
      await saveManeevejRoutine(workout)
      setStatus('saved')
    } catch {
      setStatus('error')
    } finally {
      pending.current = false
    }
  }, [testOnly, workout])

  useEffect(() => {
    if (testOnly || attempted.current) return
    attempted.current = true
    void persist()
  }, [persist, testOnly])

  return <section className="panel routine-summary" aria-labelledby="routine-result-title">
    <h3 id="routine-result-title">{testOnly ? 'สรุปคะแนนทดสอบ' : 'สรุปชุดฝึก'}</h3>
    <dl className="history-summary-metrics">
      <div><dt>คะแนนคุณภาพท่าเฉลี่ย</dt><dd>{summary.score === null ? '—' : `${summary.score}%`}</dd></div>
      <div><dt>เวลาฝึกจริง</dt><dd>{formatRoutineTime(summary.durationMs)}</dd></div>
    </dl>
    <p>คิดจากลำดับท่า 50% · มุมและช่วงเคลื่อนไหว 35% · การควบคุม 15%</p>
    {status === 'saving' && <p role="status">กำลังบันทึกลงประวัติ</p>}
    {status === 'test' && <p>ชุดทดสอบไม่ถูกบันทึกลงประวัติ</p>}
    {status === 'error' && <p className="notice notice-error" role="alert">บันทึกลงประวัติไม่สำเร็จ คุณยังดูผลรายท่าและลองบันทึกอีกครั้งได้</p>}
    <details className="studio-demo-instructions" open={testOnly || undefined}>
      <summary>ดูคะแนนรายท่า <ChevronDown size={17} aria-hidden="true" /></summary>
      <ul>{summary.exercises.map(({ id, name, score, durationMs, rounds: exerciseRounds }, index) => {
        return <li key={id}>
          <span>{name}<small>{formatRoutineTime(durationMs)}</small>
            {exerciseRounds.map(({ roundIndex, score, quality }) => <small key={roundIndex} className="routine-score-breakdown">
              <strong>รอบ {roundIndex % roundsPerExercise + 1} · {score === null ? 'ประเมินไม่ได้' : `${score}%`}</strong>
              {quality && <>
                <span>ลำดับ {quality.sequence}% · มุมและช่วงเคลื่อนไหว {quality.motion}% · ควบคุม {quality.control}%</span>
                <span>{roundQualityTip(maneevejExercises[index], quality)}</span>
              </>}
            </small>)}
            {id === 'backstroke' && <small>กล้องตรวจพบ · ซ้าย {exerciseRounds.reduce((count, round) => count + round.left, 0)}
              {' · '}ขวา {exerciseRounds.reduce((count, round) => count + round.right, 0)}</small>}</span>
          <strong>{exerciseRounds.length === 0 ? 'ยังไม่ได้ทดสอบ' : score === null ? 'ประเมินไม่ได้' : `${score}%`}</strong>
        </li>
      })}</ul>
    </details>
    <div className="routine-actions">
      <Button variant="outline" disabled={status === 'saving'} onClick={onRestart}>
        <RotateCcw size={17} aria-hidden="true" />{testOnly ? 'เริ่มทดสอบใหม่' : 'ฝึกชุดนี้อีกครั้ง'}
      </Button>
      {status === 'saved' && <Button asChild><Link to={`/history?session=${workout.id}`}>ดูรายละเอียดในประวัติ</Link></Button>}
      {status === 'error' && <Button onClick={() => void persist()}>ลองบันทึกอีกครั้ง</Button>}
    </div>
  </section>
}

function RoutineReference({ exercise, src, videoRef, onDuration, onEnableSound }: {
  exercise: ManeevejExercise
  src?: string
  videoRef: Ref<HTMLVideoElement>
  onDuration: (seconds: number | null) => void
  onEnableSound?: () => void
}) {
  return <section className="panel camera-panel studio-reference-panel" aria-labelledby="routine-reference-title">
    <div className="panel-heading">
      <h3 id="routine-reference-title">คลิปตัวอย่าง</h3>
      {onEnableSound && <Button variant="outline" onClick={onEnableSound}>
        <Volume2 size={16} aria-hidden="true" />เปิดเสียงคลิป
      </Button>}
    </div>
    {src ? <ReferencePreview src={src} exerciseName={exercise.name} videoRef={videoRef}
      automatic onDuration={onDuration} /> : <div className="studio-media-frame routine-clip-placeholder">
      <div className="camera-placeholder">
        <span className="camera-glyph"><Clapperboard size={28} strokeWidth={1.6} aria-hidden="true" /></span>
        <strong>คลิปอยู่ระหว่างเตรียม</strong>
        <span>ดูขั้นตอนของท่านี้ด้านล่างได้</span>
      </div>
    </div>}
    <details className="studio-demo-instructions" open={src ? undefined : true}>
      <summary>วิธีทำท่า <ChevronDown size={17} aria-hidden="true" /></summary>
      <ol>{exercise.steps.map((step) => <li key={step}>{step}</li>)}</ol>
    </details>
    <p className="studio-media-note"><Focus size={16} aria-hidden="true" /> ตั้งกล้อง{exercise.view}</p>
  </section>
}

function useCountdown(deadline: number | null, onEnd: () => void) {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (deadline === null) return
    let timer: number
    function tick(endAt: number) {
      const current = Date.now()
      setNow(current)
      if (current >= endAt) onEnd()
      else timer = window.setTimeout(() => tick(endAt), Math.min(250, endAt - current))
    }
    tick(deadline)
    return () => window.clearTimeout(timer)
  }, [deadline, onEnd])

  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000))
}

function RoutineRest({ restUntil, restSeconds, round, nextExercise, titleRef, onEnd, onSkip }: {
  restUntil: number
  restSeconds: number
  round: number
  nextExercise: string
  titleRef: Ref<HTMLHeadingElement>
  onEnd: () => void
  onSkip?: () => void
}) {
  const remaining = useCountdown(restUntil, onEnd) ?? 0
  return <section className="panel routine-rest-countdown" aria-labelledby="routine-rest-title">
    <h2 id="routine-rest-title" ref={titleRef} tabIndex={-1}>{round === 1 ? 'พักก่อนท่าถัดไป' : 'พักก่อนรอบที่ 2'}</h2>
    <p className="routine-timer" role="timer" aria-label="เวลาพักที่เหลือ">{remaining}<small>วินาที</small></p>
    <progress max={restSeconds} value={remaining} aria-label="เวลาพักที่เหลือเทียบกับเวลาพักทั้งหมด" />
    <p className="routine-rest-tip">{round === 1
      ? 'พักแขนสักครู่ จิบน้ำได้ถ้าต้องการ'
      : 'ปล่อยแขนลง ผ่อนหัวไหล่ และหายใจตามปกติ'}</p>
    <p className="routine-rest-next"><strong>ถัดไป {nextExercise} · รอบ {round}/{roundsPerExercise}</strong>
      <span>เริ่มอัตโนมัติเมื่อหมดเวลาพัก</span>
    </p>
    {import.meta.env.DEV && onSkip && <Button variant="outline" onClick={onSkip}>
      <SkipForward size={16} aria-hidden="true" />ข้ามพัก (Dev)
    </Button>}
  </section>
}

function RoutineCamera({ exercise, round, clipDuration, onBegin, onFinish, onFinishEarly, onSkipExercise, lastExercise }: {
  exercise: ManeevejExercise
  round: number
  clipDuration: number | null | undefined
  onBegin: () => void
  onFinish: (result: RoundResult) => void
  onFinishEarly?: (result: RoundResult) => void
  onSkipExercise?: (result?: RoundResult) => void
  lastExercise: boolean
}) {
  const tracker = useRef(createManeevejTracker())
  const [snapshot, setSnapshot] = useState(createManeevejTracker)
  const [roundClock, setRoundClock] = useState<{ deadline: number; durationMs: number } | null>(null)
  const [clipTimedOut, setClipTimedOut] = useState(false)
  const started = useRef(false)
  const finished = useRef(false)
  const visibleMs = useRef(0)
  const getResult = useCallback((early: boolean): RoundResult | undefined => {
    if (!roundClock) return
    const { left, right, bestPhases, stage } = tracker.current
    const elapsedMs = early
      ? Math.max(1, Math.min(roundClock.durationMs, Date.now() - (roundClock.deadline - roundClock.durationMs)))
      : roundClock.durationMs
    const quality = measureRoundQuality(exercise, bestPhases, stage > 0)
    const score = getRoundScore(quality, visibleMs.current, elapsedMs)
    return { left, right, score, elapsedMs, quality: score === null ? null : quality }
  }, [exercise, roundClock])
  const finish = useCallback(() => {
    if (finished.current) return
    const result = getResult(false)
    if (!result) return
    finished.current = true
    onFinish(result)
  }, [getResult, onFinish])

  function finishEarly() {
    if (finished.current || !onFinishEarly) return
    const result = getResult(true)
    if (!result) return
    finished.current = true
    onFinishEarly(result)
  }

  function skipExercise() {
    if (finished.current || !onSkipExercise) return
    finished.current = true
    onSkipExercise(getResult(true))
  }

  const camera = useCamera(useCallback((result: PoseLandmarkerResult | null, timestamp: number) => {
    if (finished.current || !started.current || tracker.current.reps > 0) return
    const state = tracker.current
    const { stage, tracking, timestamp: previousTimestamp } = state
    const pose = result ? measureManeevej(result.landmarks[0] ?? [], result.worldLandmarks[0] ?? []) : null
    updateManeevej(exercise.id, state, pose, timestamp)
    if (tracking && state.tracking && previousTimestamp !== null && timestamp - previousTimestamp <= 250) {
      visibleMs.current += timestamp - previousTimestamp
    }
    if (stage !== state.stage || tracking !== state.tracking || state.reps > 0) setSnapshot({ ...state })
  }, [exercise.id]))
  const startCamera = camera.start
  const live = camera.status === 'live'
  const preview = live || camera.status === 'loading'
  const waitingForClip = clipDuration === undefined && !clipTimedOut

  useEffect(() => {
    startCamera()
  }, [startCamera])

  useEffect(() => {
    if (clipDuration !== undefined) return
    const timer = window.setTimeout(() => setClipTimedOut(true), 5000)
    return () => window.clearTimeout(timer)
  }, [clipDuration])

  useEffect(() => {
    if (started.current || waitingForClip || (!live && camera.status !== 'error')) return
    const durationMs = Math.round(getRoundSeconds(clipDuration ?? null) * 1000)
    started.current = true
    setRoundClock({ deadline: Date.now() + durationMs, durationMs })
    onBegin()
  }, [camera.status, clipDuration, live, onBegin, waitingForClip])

  const remaining = useCountdown(roundClock?.deadline ?? null, finish)
  const endingSoon = remaining !== null && remaining > 0 && remaining <= 3
  const endsSet = lastExercise && round === roundsPerExercise

  const status = camera.status === 'error' ? 'เปิดกล้องหรือระบบติดตามไม่สำเร็จ'
    : camera.status === 'loading' ? 'กำลังโหลดระบบตรวจจับท่าทาง'
    : !live ? 'กำลังเตรียมกล้อง'
    : !roundClock ? 'กำลังเตรียมคลิป'
    : snapshot.reps > 0 ? 'ตรวจจับการเคลื่อนไหวครบรอบแล้ว'
    : snapshot.tracking ? exercise.steps[snapshot.stage] : 'จัดกล้องให้เห็นไหล่ สะโพก ศอก และข้อมือ'

  return <>
    <section className="panel camera-panel studio-camera-panel" aria-labelledby="routine-camera-title">
      <div className="panel-heading">
        <h3 id="routine-camera-title">ภาพจากกล้อง</h3>
        <span className={live ? 'camera-badge camera-badge-live' : 'camera-badge'}><span />{live ? 'เปิดอยู่' : camera.enabled ? 'กำลังเปิด' : 'ปิดอยู่'}</span>
      </div>
      {import.meta.env.DEV && onSkipExercise && <div className="routine-dev-actions">
        {onFinishEarly && <Button variant="outline" disabled={!roundClock} onClick={finishEarly}>
          จบรอบนี้ (Dev)
        </Button>}
        <Button variant="outline" onClick={skipExercise}><SkipForward size={16} aria-hidden="true" />
          {lastExercise ? 'ดูผลคะแนนทดสอบ (Dev)' : 'เก็บคะแนนและไปท่าถัดไป (Dev)'}
        </Button>
      </div>}
      <div className={preview ? 'studio-media-frame camera-frame camera-frame-live' : 'studio-media-frame camera-frame'}>
        <video ref={camera.videoRef} playsInline muted autoPlay hidden={!preview} aria-label="ภาพจากกล้อง" />
        <canvas ref={camera.canvasRef} hidden={!preview} aria-hidden="true" />
        {(preview || roundClock) && <dl className="studio-live-metrics">
          <div><dt className="sr-only">รอบปัจจุบัน</dt><dd>รอบ {round}/{roundsPerExercise}</dd></div>
          <div><dt className="sr-only">เวลาฝึกที่เหลือ</dt>
            <dd role="timer" aria-label="เวลาฝึกที่เหลือ">{remaining === null ? '—' : formatRoutineTime(remaining * 1000)}</dd>
          </div>
        </dl>}
        {!preview && <div className="camera-placeholder">
          <span className="camera-glyph"><Camera size={29} strokeWidth={1.6} aria-hidden="true" /></span>
          <strong>{status}</strong>
        </div>}
        {endingSoon && <>
          <div className="routine-round-countdown" aria-hidden="true">
            <span>{endsSet ? 'จบชุดใน' : 'เริ่มพักใน'}</span>
            <strong>{remaining}</strong>
          </div>
          <span className="sr-only" role="status">{endsSet ? 'ใกล้จบชุดฝึก' : 'ใกล้ถึงช่วงพัก'}</span>
        </>}
      </div>
      {camera.error && <p className="notice notice-error" role="alert">{camera.error}</p>}
      {camera.status === 'error' && <div className="studio-workout-actions">
        <Button variant="outline" onClick={startCamera}>ลองเปิดกล้องอีกครั้ง</Button>
      </div>}
    </section>
    <aside className="studio-aside routine-tracking" aria-label="สถานะการตรวจจับ">
      <section className="panel studio-info">
        <span className="tile tile-mint"><Focus size={17} aria-hidden="true" /></span>
        <div>
          <h3>สถานะการตรวจจับ</h3>
          <p role="status">{status}</p>
          <p>หมดเวลาแล้วระบบจะไปต่ออัตโนมัติ</p>
        </div>
      </section>
      <p className="privacy-note"><ShieldCheck size={17} aria-hidden="true" />ภาพจากกล้องประมวลผลบนอุปกรณ์ของคุณ</p>
    </aside>
  </>
}
