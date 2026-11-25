export type PoseQuality = 'missing' | 'adjust' | 'ready'

type Landmark = { x: number; y: number; visibility?: number; presence?: number }

// Camera framing checks only. Exercise thresholds and scores are defined separately.
const framingPoints = [11, 12, 23, 24, 25, 26, 27, 28]
const minConfidence = 0.5

export function canDrawLandmark(point?: Landmark): point is Landmark {
  return Boolean(point
    && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1
    && (point.visibility === undefined || point.visibility >= minConfidence)
    && (point.presence === undefined || point.presence >= minConfidence))
}

export function assessPose(points: readonly Landmark[]): PoseQuality {
  if (!points.length) return 'missing'
  return framingPoints.every((index) => canDrawLandmark(points[index])) ? 'ready' : 'adjust'
}
