import { ArrowLeft, Camera, ChevronDown, ChevronRight, Clapperboard, Dumbbell, Focus, ScanLine, ShieldCheck, VideoOff } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import shoulderRaiseClip from '../../assets/shoulder-raise-demo.mp4'
import { Button } from '../../components/ui/button'
import { referenceVideoUrl } from '../../lib/supabase'
import type { Exercise, useExercises } from '../exercises/use-exercises'
import { saveDemoWorkout, type CompletedDemoWorkout, type DemoWorkout } from '../workout/save-demo-workout'
import { initialShoulderRaise, measureShoulderRaise, shoulderRaiseDemo, updateShoulderRaise } from './shoulder-raise'
import { useCamera } from './use-camera'

const shoulderRaisePrompt = {
  rest: 'ปล่อยแขนขวาไว้ข้างลำตัวเพื่อเริ่ม',
  lift: 'กางแขนขวาด้านข้างขึ้นถึงระดับไหล่',
  lower: 'ลดแขนขวากลับข้างลำตัวเพื่อจบรอบ',
}

type WorkoutStatus =
  | { phase: 'idle' | 'active' }
  | { phase: 'saving' | 'failed' | 'saved'; workout: CompletedDemoWorkout }

export function Studio({ catalog }: { catalog: ReturnType<typeof useExercises> }) {
  const [params] = useSearchParams()
  const selectedId = params.get('exercise')
  const isDemo = selectedId === shoulderRaiseDemo.id
  const exercise = catalog.exercises.find(({ id }) => id === selectedId)
  if (!isDemo && !exercise) return <ExercisePicker catalog={catalog} hasInvalidSelection={Boolean(selectedId)} />

  return <StudioWorkout key={selectedId} catalog={catalog} exercise={exercise} isDemo={isDemo} />
}

function ExercisePicker({ catalog, hasInvalidSelection }: {
  catalog: ReturnType<typeof useExercises>
  hasInvalidSelection: boolean
}) {
  return <>
    <div className="page-heading">
      <h1>เลือกท่าออกกำลังกาย</h1>
      <p>เลือกท่าที่ต้องการฝึกเพื่อเข้าห้องฝึก</p>
    </div>
    <section className="panel status-panel" aria-labelledby="studio-picker-title">
      <h2 id="studio-picker-title">รายการท่า</h2>
      <ul className="exercise-list studio-choice-list">
        <li>
          <Link to={`?exercise=${shoulderRaiseDemo.id}`} data-quick-tip-target="choose-exercise">
            <Dumbbell size={19} aria-hidden="true" />
            <span><strong>{shoulderRaiseDemo.name} (ทดลอง)</strong>
              <small>ดูคลิปสาธิตและลองนับรอบผ่านกล้อง</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        </li>
        {catalog.exercises.map(({ id, name, description }) => <li key={id}>
          <Link to={`?exercise=${encodeURIComponent(id)}`}>
            <Dumbbell size={19} aria-hidden="true" />
            <span><strong>{name}</strong>{description && <small>{description}</small>}</span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        </li>)}
      </ul>
      {catalog.status === 'loading' && <p role="status">กำลังโหลดรายการท่าเพิ่มเติม</p>}
      {catalog.status === 'error' && <p role="status">โหลดรายการท่าเพิ่มเติมไม่สำเร็จ</p>}
      {hasInvalidSelection && catalog.status === 'ready' && <p role="status">ไม่พบท่าที่เลือก กรุณาเลือกจากรายการ</p>}
    </section>
  </>
}

function StudioWorkout({ catalog, exercise, isDemo }: {
  catalog: ReturnType<typeof useExercises>
  exercise: Exercise | undefined
  isDemo: boolean
}) {
  const navigate = useNavigate()
  const videoUrl = isDemo ? shoulderRaiseClip : referenceVideoUrl(exercise?.reference_video_key ?? null)
  const demoState = useRef(initialShoulderRaise)
  const [demo, setDemo] = useState(initialShoulderRaise)
  const lastDemoRefresh = useRef(-Infinity)
  const activeWorkout = useRef<DemoWorkout | null>(null)
  const saveInProgress = useRef(false)
  const [workoutStatus, setWorkoutStatus] = useState<WorkoutStatus>({ phase: 'idle' })
  const [waitingForCamera, setWaitingForCamera] = useState(false)
  const camera = useCamera(useCallback((result: PoseLandmarkerResult | null, timestamp: number) => {
    const workout = activeWorkout.current
    if (!isDemo || !workout) return
    const previous = demoState.current
    const angle = measureShoulderRaise(result?.landmarks[0] ?? [], result?.worldLandmarks[0] ?? [])
    const next = updateShoulderRaise(previous, angle, timestamp)
    demoState.current = next
    if (next.reps > previous.reps && next.lastScore !== null && next.lastPeak !== null && next.lastDurationMs !== null) {
      workout.reps.push({ score: next.lastScore, peak_angle: next.lastPeak, duration_ms: next.lastDurationMs })
    }
    if (next.phase !== previous.phase || (angle === null) !== (previous.angle === null) ||
      (angle !== null && timestamp - lastDemoRefresh.current >= 100)) {
      lastDemoRefresh.current = timestamp
      setDemo(next)
    }
  }, [isDemo]))

  const beginWorkout = useCallback(() => {
    if (activeWorkout.current || saveInProgress.current) return
    demoState.current = initialShoulderRaise
    lastDemoRefresh.current = -Infinity
    setDemo(initialShoulderRaise)
    activeWorkout.current = { id: crypto.randomUUID(), startedAt: Date.now(), reps: [] }
    setWorkoutStatus({ phase: 'active' })
  }, [])

  useEffect(() => {
    if (!waitingForCamera) return
    if (isDemo && camera.enabled && camera.status === 'live') {
      setWaitingForCamera(false)
      beginWorkout()
    } else if (!isDemo || !camera.enabled) {
      setWaitingForCamera(false)
    }
  }, [waitingForCamera, isDemo, camera.enabled, camera.status, beginWorkout])

  function startWorkout() {
    if (waitingForCamera || activeWorkout.current || saveInProgress.current) return
    if (camera.enabled && camera.status === 'live') {
      beginWorkout()
      return
    }
    setWaitingForCamera(true)
    if (!camera.enabled) camera.start()
  }

  function stopCamera() {
    setWaitingForCamera(false)
    camera.stop()
  }

  async function persistWorkout(workout: CompletedDemoWorkout) {
    if (saveInProgress.current) return
    saveInProgress.current = true
    setWorkoutStatus({ phase: 'saving', workout })
    try {
      await saveDemoWorkout(workout)
      setWorkoutStatus({ phase: 'saved', workout })
    } catch {
      setWorkoutStatus({ phase: 'failed', workout })
    } finally {
      saveInProgress.current = false
    }
  }

  function finishWorkout() {
    const workout = activeWorkout.current
    if (!workout) return
    activeWorkout.current = null
    camera.stop()
    setDemo({ ...demoState.current, angle: null })
    void persistWorkout({ ...workout, endedAt: Math.max(workout.startedAt, Date.now()) })
  }

  const message = camera.status === 'live'
    ? isDemo
      ? workoutStatus.phase !== 'active' ? 'กล้องพร้อม กดเริ่มออกกำลังเพื่อเริ่มนับ'
        : demo.angle === null ? 'จัดกล้องให้เห็นไหล่ ศอก และสะโพกขวาชัดเจน' : shoulderRaisePrompt[demo.phase]
      : {
        ready: 'เห็นข้อต่อหลักครบแล้ว',
        adjust: 'ถอยออกเล็กน้อย ให้เห็นไหล่ สะโพก เข่า และข้อเท้า',
        missing: 'ยืนหันเข้าหากล้องและจัดตัวให้อยู่ในกรอบ',
      }[camera.quality]
    : {
        idle: 'กล้องยังปิดอยู่',
        requesting: 'กำลังรอสิทธิ์เข้าถึงกล้อง',
        loading: 'กำลังโหลดระบบตรวจจับท่าทาง',
        error: 'เปิดกล้องไม่สำเร็จ',
      }[camera.status]
  const preview = camera.status === 'live' || camera.status === 'loading'
  const exerciseLocked = waitingForCamera || workoutStatus.phase === 'active' ||
    workoutStatus.phase === 'saving' || workoutStatus.phase === 'failed'

  return <>
    <div className="studio-heading">
      <Button className="studio-back-button" variant="outline" disabled={exerciseLocked} onClick={() => navigate('/studio')}>
        <ArrowLeft size={17} aria-hidden="true" />
      </Button>
      <div className="page-heading">
        <h1>ห้องฝึก</h1>
      </div>
    </div>
    <div className="studio-grid">
      <section className="panel camera-panel studio-reference-panel" aria-labelledby="reference-title">
        <div className="panel-heading">
          <h2 id="reference-title">{isDemo ? shoulderRaiseDemo.name : 'คลิปตัวอย่าง'}</h2>
          {videoUrl && <span className="camera-badge">เล่นวนซ้ำ</span>}
        </div>
        {videoUrl ? <ReferencePreview key={videoUrl} src={videoUrl}
          exerciseName={isDemo ? shoulderRaiseDemo.name : exercise?.name ?? 'ท่าออกกำลังกาย'} /> :
          <div className="studio-media-frame">
            <div className="camera-placeholder" role="status">
              <span className="camera-glyph"><Clapperboard size={29} strokeWidth={1.6} aria-hidden="true" /></span>
              <strong>{catalog.status === 'loading' ? 'กำลังโหลดรายการท่า'
                : catalog.status === 'error' ? 'โหลดรายการท่าไม่สำเร็จ' : 'คลิปตัวอย่างอยู่ระหว่างเตรียม'}</strong>
              <span>{catalog.status === 'error' ? 'ลองโหลดหน้านี้ใหม่' : exercise?.name ?? 'คุณสามารถเปิดกล้องเพื่อจัดตำแหน่งได้'}</span>
            </div>
          </div>}
        {isDemo && <details className="studio-demo-instructions">
          <summary>วิธีทำท่า <ChevronDown size={17} aria-hidden="true" /></summary>
          <ol>
            <li>หันหน้าเข้ากล้อง ปล่อยแขนขวาไว้ข้างลำตัว</li>
            <li>กางแขนขวาออกด้านข้างถึงระดับไหล่ แล้วหยุดสั้น ๆ</li>
            <li>ค่อย ๆ ลดแขนกลับข้างลำตัว ระบบจะนับ 1 รอบ</li>
          </ol>
          <p>ขยับเท่าที่สบายและหยุดหากรู้สึกเจ็บ</p>
        </details>}
        {exercise?.camera_view && <p className="studio-media-note">มุมกล้องที่แนะนำ · {exercise.camera_view}</p>}
      </section>
      <section className="panel camera-panel studio-camera-panel" aria-labelledby="camera-title">
        <div className="panel-heading">
          <h2 id="camera-title">ภาพจากกล้อง</h2>
          <span className={preview ? 'camera-badge camera-badge-live' : 'camera-badge'}>
            <span />{preview ? 'เปิดอยู่' : camera.enabled ? 'กำลังเปิด' : 'ปิดอยู่'}
          </span>
        </div>
        <div className={preview ? 'studio-media-frame camera-frame camera-frame-live' : 'studio-media-frame camera-frame'}>
          <video ref={camera.videoRef} playsInline muted autoPlay hidden={!preview} aria-label="ภาพจากกล้อง" />
          <canvas ref={camera.canvasRef} hidden={!preview} aria-hidden="true" />
          {isDemo && <dl className="studio-live-metrics" aria-label="ผลการฝึกปัจจุบัน">
            <div>
              <dt className="sr-only">จำนวนรอบ</dt>
              <dd>{demo.reps} รอบ</dd>
            </div>
            <div>
              <dt className="sr-only">คะแนนรอบล่าสุด</dt>
              <dd>{demo.lastScore ?? '—'} pt</dd>
            </div>
          </dl>}
          {!preview && <div className="camera-placeholder">
            <button type="button" className="camera-glyph camera-trigger" aria-label="เปิดกล้อง"
              disabled={camera.enabled} onClick={camera.start}>
              <Camera size={32} strokeWidth={1.6} aria-hidden="true" />
            </button>
            <strong>เตรียมกล้องให้พร้อม</strong>
            <span>{camera.enabled ? 'กำลังรอสิทธิ์เข้าถึงกล้อง' : 'แตะไอคอนเพื่อเปิดกล้อง'}</span>
          </div>}
        </div>
        {(camera.enabled || camera.devices.length > 1) && <div className="camera-actions">
          {camera.devices.length > 1 && <label className="camera-select">
            <span>กล้อง</span>
            <select value={camera.deviceId} onChange={(event) => camera.selectDevice(event.target.value)}>
              <option value="">ค่าเริ่มต้น</option>
              {camera.devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>
                {device.label || `กล้อง ${index + 1}`}
              </option>)}
            </select>
          </label>}
          {camera.enabled && <Button variant="outline" onClick={stopCamera}><VideoOff size={17} />ปิดกล้อง</Button>}
        </div>}
        {camera.error && <p className="notice notice-error" role="alert">{camera.error}</p>}
        {isDemo && <div className="studio-workout-actions">
          {waitingForCamera && <p role="status">กำลังเตรียมกล้อง ระบบจะเริ่มฝึกเมื่อกล้องพร้อม</p>}
          {!waitingForCamera && (workoutStatus.phase === 'idle' || workoutStatus.phase === 'saved') &&
            <Button onClick={startWorkout} data-quick-tip-target={workoutStatus.phase === 'idle' ? 'start-workout' : undefined}>
              {workoutStatus.phase === 'saved' ? 'เริ่มออกกำลังอีกครั้ง' : 'เริ่มออกกำลัง'}
            </Button>}
          {workoutStatus.phase === 'active' &&
            <Button onClick={finishWorkout} data-quick-tip-target="finish-workout">สิ้นสุดและบันทึก</Button>}
          {workoutStatus.phase === 'saving' && <p role="status">กำลังบันทึกผลการฝึก</p>}
          {workoutStatus.phase === 'failed' && <>
            <p role="alert">บันทึกไม่สำเร็จ ผลยังอยู่ในหน้านี้</p>
            <Button onClick={() => void persistWorkout(workoutStatus.workout)} data-quick-tip-target="retry-save">ลองบันทึกอีกครั้ง</Button>
          </>}
          {workoutStatus.phase === 'saved' && <>
            <p role="status">บันทึกผลแล้ว · {workoutStatus.workout.reps.length} รอบ</p>
            <Button asChild variant="outline">
              <Link to={`/history?session=${workoutStatus.workout.id}`} data-quick-tip-target="open-result">ดูผลในประวัติ</Link>
            </Button>
          </>}
          {workoutStatus.phase === 'active' && !camera.enabled &&
            <p>แตะไอคอนกล้องในกรอบเพื่อเริ่มตรวจจับและนับรอบ</p>}
        </div>}
      </section>
      <aside className="studio-aside" aria-label="สถานะและการจัดตำแหน่งกล้อง">
        <section className="panel studio-info" aria-labelledby="pose-title">
          <span className="tile tile-mint"><ScanLine size={17} aria-hidden="true" /></span>
          <div>
            <h2 id="pose-title">สถานะการตรวจจับ</h2>
            <p role="status">{message}</p>
            {isDemo ? <>
              <p className="studio-score-note">
                <span>มุมตอนนี้ <strong>{demo.angle === null ? '—' : `${Math.round(demo.angle)}°`}</strong></span>
                {demo.lastPeak !== null && <span>มุมสูงสุด <strong>{demo.lastPeak}°</strong></span>}
              </p>
              <p>คะแนนทดลองอิงความใกล้ระดับไหล่ ระบบบันทึกเฉพาะรอบที่ทำครบ</p>
            </> : <p className="studio-score-note">
              <span>จำนวนครั้งและคะแนน</span>
              <strong>รอกำหนดท่าและเกณฑ์</strong>
            </p>}
          </div>
        </section>
        <section className="panel studio-info" aria-labelledby="framing-title">
          <span className="tile"><Focus size={17} aria-hidden="true" /></span>
          <div>
            <h2 id="framing-title">จัดตำแหน่งกล้อง</h2>
            <p>{isDemo ? 'ตั้งกล้องด้านหน้าให้เห็นไหล่ สะโพก และแขนขวาตลอดการเคลื่อนไหว' :
              'วางกล้องให้มั่นคง ใช้พื้นที่ที่มีแสงพอและให้เห็นร่างกายเต็มกรอบ'}</p>
          </div>
        </section>
        <p className="privacy-note"><ShieldCheck size={17} />ภาพจากกล้องประมวลผลบนอุปกรณ์ของคุณ</p>
      </aside>
    </div>
  </>
}

function ReferencePreview({ src, exerciseName }: { src: string; exerciseName: string }) {
  const [failed, setFailed] = useState(false)

  return <div className={failed ? 'studio-media-frame' : 'studio-media-frame reference-frame'}>
    {failed ? <div className="camera-placeholder">
      <p role="alert">โหลดคลิปตัวอย่างไม่สำเร็จ</p>
      <Button variant="outline" onClick={() => setFailed(false)}>ลองโหลดคลิปอีกครั้ง</Button>
    </div> : <video src={src} aria-label={`คลิปตัวอย่าง ${exerciseName}`} muted autoPlay loop playsInline controls
      onError={() => setFailed(true)} />}
  </div>
}
