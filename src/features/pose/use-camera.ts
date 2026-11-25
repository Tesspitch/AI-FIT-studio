import { useEffect, useRef, useState } from 'react'
import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision'
import { assessPose, type PoseQuality } from './quality'
import { createPoseRuntime, drawPose } from './runtime'

type CameraStatus = 'idle' | 'requesting' | 'loading' | 'live' | 'error'

function cameraError(error: unknown) {
  switch (error instanceof DOMException ? error.name : '') {
    case 'NotAllowedError': return 'อนุญาตให้เว็บไซต์เข้าถึงกล้องในการตั้งค่าเบราว์เซอร์ แล้วลองอีกครั้ง'
    case 'NotFoundError':
    case 'OverconstrainedError': return 'ไม่พบกล้องที่เลือก ลองเชื่อมต่อกล้องหรือเลือกกล้องอื่น'
    case 'NotReadableError': return 'กล้องอาจกำลังถูกใช้โดยแอปอื่น ลองปิดแอปนั้นแล้วเปิดกล้องอีกครั้ง'
    default: return 'เปิดกล้องไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง'
  }
}

type PoseListener = (result: PoseLandmarkerResult | null, timestamp: number) => void

export function useCamera(onPose?: PoseListener) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const poseListener = useRef(onPose)
  const [enabled, setEnabled] = useState(false)
  const [deviceId, setDeviceId] = useState('')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [quality, setQuality] = useState<PoseQuality>('missing')
  const [error, setError] = useState('')

  useEffect(() => {
    poseListener.current = onPose
  }, [onPose])

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!enabled || !video || !canvas) return
    let current = true
    let stream: MediaStream | undefined
    let runtime: Awaited<ReturnType<typeof createPoseRuntime>> | undefined
    let frame = 0
    let lastFrame = -1
    let lastRun = -Infinity

    function release() {
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
      runtime?.detector.close()
      runtime = undefined
      if (video?.srcObject === stream) video!.srcObject = null
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    }
    function fail(message: string) {
      if (!current) return
      current = false
      release()
      poseListener.current?.(null, performance.now())
      setError(message)
      setStatus('error')
      setEnabled(false)
    }
    function tick(timestamp: number) {
      if (!current || !runtime || !video || !canvas) return
      if (video.readyState >= 2 && video.currentTime !== lastFrame && timestamp - lastRun >= 32) {
        lastFrame = video.currentTime
        lastRun = timestamp
        try {
          const result = runtime.detector.detectForVideo(video, timestamp)
          const points = result.landmarks[0] ?? []
          drawPose(canvas, video, points, runtime.connections)
          setQuality(assessPose(points))
          poseListener.current?.(result, timestamp)
        } catch {
          fail('ระบบตรวจจับท่าทางหยุดทำงาน กรุณาลองเปิดกล้องใหม่')
          return
        }
      }
      frame = requestAnimationFrame(tick)
    }

    async function start() {
      setStatus('requesting')
      setQuality('missing')
      setError('')
      const media = navigator.mediaDevices
      if (!window.isSecureContext || !media?.getUserMedia) {
        fail('กล้องต้องใช้งานผ่าน HTTPS หรือ localhost ในเบราว์เซอร์ที่รองรับ')
        return
      }
      try {
        const next = await media.getUserMedia({
          audio: false,
          video: {
            width: { ideal: 960 }, height: { ideal: 720 },
            ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
          },
        })
        if (!current) {
          next.getTracks().forEach((track) => track.stop())
          return
        }
        stream = next
        stream.getVideoTracks().forEach((track) => track.addEventListener('ended', () => fail('การเชื่อมต่อกล้องหยุดลง ลองเปิดกล้องอีกครั้ง'), { once: true }))
        video!.srcObject = stream
        setStatus('loading')
        await video!.play()
        if (!current) return
        void media.enumerateDevices().then((list) => {
          if (current) setDevices(list.filter((device) => device.kind === 'videoinput' && device.deviceId))
        }).catch(() => {})
      } catch (cause) {
        fail(cameraError(cause))
        return
      }
      try {
        const next = await createPoseRuntime()
        if (!current) {
          next.detector.close()
          return
        }
        runtime = next
        setStatus('live')
        frame = requestAnimationFrame(tick)
      } catch {
        fail('โหลด MediaPipe ไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองเปิดกล้องอีกครั้ง')
      }
    }
    void start()
    return () => {
      current = false
      release()
    }
  }, [deviceId, enabled])

  return {
    videoRef, canvasRef, devices, deviceId, status, quality, error, enabled,
    selectDevice: (id: string) => {
      poseListener.current?.(null, performance.now())
      setDeviceId(id)
    },
    start: () => setEnabled(true),
    stop: () => {
      poseListener.current?.(null, performance.now())
      setEnabled(false)
      setStatus('idle')
      setError('')
      setQuality('missing')
    },
  }
}
