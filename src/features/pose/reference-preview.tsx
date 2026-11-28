import { useState, type Ref } from 'react'
import { Button } from '../../components/ui/button'

export function ReferencePreview({ src, exerciseName, videoRef, automatic = false,
  loop = !automatic, muted = !automatic, onDuration }: {
  src: string
  exerciseName: string
  videoRef?: Ref<HTMLVideoElement>
  automatic?: boolean
  loop?: boolean
  muted?: boolean
  onDuration?: (seconds: number | null) => void
}) {
  const [failed, setFailed] = useState(false)

  return <div className={failed ? 'studio-media-frame' : 'studio-media-frame reference-frame'}>
    {failed ? <div className="camera-placeholder">
      <p role="alert">โหลดคลิปตัวอย่างไม่สำเร็จ</p>
      <Button variant="outline" onClick={() => setFailed(false)}>ลองโหลดคลิปอีกครั้ง</Button>
    </div> : <video ref={videoRef} src={src} aria-label={`คลิปตัวอย่าง ${exerciseName}`} muted={muted}
      autoPlay={!automatic} loop={loop} playsInline controls={!automatic}
      onLoadedMetadata={(event) => onDuration?.(event.currentTarget.duration)}
      onError={() => {
        setFailed(true)
        onDuration?.(null)
      }} />}
  </div>
}
