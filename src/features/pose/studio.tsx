import { Camera, Clapperboard, Focus, ScanLine, ShieldCheck, VideoOff } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/button'
import { referenceVideoUrl } from '../../lib/supabase'
import type { useExercises } from '../exercises/use-exercises'
import { useCamera } from './use-camera'

export function Studio({ catalog }: { catalog: ReturnType<typeof useExercises> }) {
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('exercise') ?? catalog.exercises[0]?.id
  const exercise = catalog.exercises.find(({ id }) => id === selectedId)
  const videoUrl = referenceVideoUrl(exercise?.reference_video_key ?? null)
  const camera = useCamera()
  const message = camera.status === 'live'
    ? {
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

  return <>
    <div className="studio-heading">
      <div className="page-heading">
        <h1>ห้องฝึก</h1>
        <p>ดูคลิปตัวอย่างและเปรียบเทียบกับภาพตัวเองระหว่างฝึก</p>
      </div>
      {catalog.exercises.length > 0 && <label className="studio-exercise-picker">
        <span>ท่าออกกำลังกาย</span>
        <select value={exercise?.id ?? ''} onChange={(event) => {
          const next = new URLSearchParams(params)
          next.set('exercise', event.target.value)
          setParams(next, { replace: true })
        }}>
          <option value="" disabled>เลือกท่าออกกำลังกาย</option>
          {catalog.exercises.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>}
    </div>
    <div className="studio-grid">
      <section className="panel camera-panel" aria-labelledby="reference-title">
        <div className="panel-heading">
          <h2 id="reference-title">คลิปตัวอย่าง</h2>
          {videoUrl && <span className="camera-badge">เล่นวนซ้ำ</span>}
        </div>
        {videoUrl && exercise ? <ReferencePreview key={videoUrl} src={videoUrl} exerciseName={exercise.name} /> :
          <div className="studio-media-frame">
            <div className="camera-placeholder" role="status">
              <span className="camera-glyph"><Clapperboard size={29} strokeWidth={1.6} aria-hidden="true" /></span>
              <strong>{catalog.status === 'loading' ? 'กำลังโหลดรายการท่า'
                : catalog.status === 'error' ? 'โหลดรายการท่าไม่สำเร็จ' : 'คลิปตัวอย่างอยู่ระหว่างเตรียม'}</strong>
              <span>{catalog.status === 'error' ? 'ลองโหลดหน้านี้ใหม่' : exercise?.name ?? 'คุณสามารถเปิดกล้องเพื่อจัดตำแหน่งได้'}</span>
            </div>
          </div>}
        {exercise?.camera_view && <p className="studio-media-note">มุมกล้องที่แนะนำ · {exercise.camera_view}</p>}
      </section>
      <section className="panel camera-panel" aria-labelledby="camera-title">
        <div className="panel-heading">
          <h2 id="camera-title">ภาพจากกล้อง</h2>
          <span className={preview ? 'camera-badge camera-badge-live' : 'camera-badge'}>
            <span />{preview ? 'เปิดอยู่' : 'ปิดอยู่'}
          </span>
        </div>
        <div className={preview ? 'studio-media-frame camera-frame camera-frame-live' : 'studio-media-frame camera-frame'}>
          <video ref={camera.videoRef} playsInline muted autoPlay hidden={!preview} aria-label="ภาพจากกล้อง" />
          <canvas ref={camera.canvasRef} hidden={!preview} aria-hidden="true" />
          {!preview && <div className="camera-placeholder">
            <span className="camera-glyph"><Camera size={32} strokeWidth={1.6} /></span>
            <strong>เตรียมกล้องให้พร้อม</strong>
            <span>เปิดกล้องเพื่อดูตำแหน่งร่างกายในกรอบ</span>
          </div>}
        </div>
        <div className="camera-actions">
          {camera.enabled ? <Button variant="outline" onClick={camera.stop}><VideoOff size={17} />ปิดกล้อง</Button>
            : <Button onClick={camera.start}><Camera size={17} />เปิดกล้อง</Button>}
          {camera.devices.length > 1 && <label className="camera-select">
            <span>กล้อง</span>
            <select value={camera.deviceId} onChange={(event) => camera.selectDevice(event.target.value)}>
              <option value="">ค่าเริ่มต้น</option>
              {camera.devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>
                {device.label || `กล้อง ${index + 1}`}
              </option>)}
            </select>
          </label>}
        </div>
        {camera.error && <p className="notice notice-error" role="alert">{camera.error}</p>}
      </section>
    </div>
    <aside className="studio-aside" aria-label="สถานะและการจัดตำแหน่งกล้อง">
      <section className="panel studio-info" aria-labelledby="pose-title">
        <span className="tile tile-mint"><ScanLine size={17} aria-hidden="true" /></span>
        <div>
          <h2 id="pose-title">สถานะการตรวจจับ</h2>
          <p role="status">{message}</p>
          <p className="studio-score-note">
            <span>จำนวนครั้งและคะแนน</span>
            <strong>รอกำหนดท่าและเกณฑ์</strong>
          </p>
        </div>
      </section>
      <section className="panel studio-info" aria-labelledby="framing-title">
        <span className="tile"><Focus size={17} aria-hidden="true" /></span>
        <div>
          <h2 id="framing-title">จัดตำแหน่งกล้อง</h2>
          <p>วางกล้องให้มั่นคง ใช้พื้นที่ที่มีแสงพอและให้เห็นร่างกายเต็มกรอบ</p>
        </div>
      </section>
      <p className="privacy-note"><ShieldCheck size={17} />ภาพจากกล้องประมวลผลบนอุปกรณ์ของคุณ</p>
    </aside>
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
