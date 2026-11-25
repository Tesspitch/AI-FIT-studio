import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { canDrawLandmark } from './quality'

export async function createPoseRuntime() {
  const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
  const files = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}mediapipe`)
  const detector = await PoseLandmarker.createFromOptions(files, {
    runningMode: 'VIDEO',
    numPoses: 1,
    baseOptions: {
      modelAssetPath: import.meta.env.VITE_POSE_MODEL_URL?.trim() ||
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
    },
  })
  return { detector, connections: PoseLandmarker.POSE_CONNECTIONS }
}

export function drawPose(canvas: HTMLCanvasElement, video: HTMLVideoElement,
  points: NormalizedLandmark[], connections: Array<{ start: number; end: number }>) {
  if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth
  if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width, height } = canvas
  ctx.clearRect(0, 0, width, height)
  ctx.lineWidth = Math.max(2, width / 260)
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#a3f3d4'
  ctx.fillStyle = '#e8dcff'
  ctx.beginPath()
  for (const { start, end } of connections) {
    const a = points[start]
    const b = points[end]
    if (!canDrawLandmark(a) || !canDrawLandmark(b)) continue
    ctx.moveTo(a.x * width, a.y * height)
    ctx.lineTo(b.x * width, b.y * height)
  }
  ctx.stroke()
  for (const point of points) {
    if (!canDrawLandmark(point)) continue
    const x = point.x * width
    const y = point.y * height
    const radius = Math.max(3, width / 180)
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
}
