export const habits = [
  ['long_sitting', 'นั่งนาน'],
  ['long_standing', 'ยืนนาน'],
  ['neck_bending', 'ก้มคอหรือก้มหน้า'],
  ['repetitive_arm_use', 'ใช้มือหรือแขนซ้ำ ๆ'],
  ['frequent_reaching', 'ยกแขนหรือเอื้อมมือบ่อย'],
] as const

export const painAreas = [
  ['neck', 'คอ'],
  ['shoulders', 'บ่าและไหล่'],
  ['arms_elbows', 'แขนและข้อศอก'],
  ['wrists_hands', 'ข้อมือและมือ'],
  ['upper_back', 'หลังส่วนบน'],
  ['lower_back', 'หลังส่วนล่าง'],
  ['hips', 'สะโพก'],
  ['thighs_knees', 'ต้นขาและเข่า'],
  ['calves_ankles', 'น่องและข้อเท้า'],
] as const

export const painDurations = [
  ['under_one_week', 'น้อยกว่า 1 สัปดาห์'],
  ['one_to_four_weeks', '1–4 สัปดาห์'],
  ['one_to_three_months', '1–3 เดือน'],
  ['over_three_months', 'มากกว่า 3 เดือน'],
] as const

export const dailyImpacts = [
  ['none', 'ไม่ส่งผล'],
  ['low', 'เล็กน้อย'],
  ['moderate', 'ปานกลาง'],
  ['high', 'มาก'],
] as const

export const maxOccupationLength = 120
type ScreeningAnswers = {
  occupation: string
  habits: string[]
  pain_areas: string[]
  pain_duration: string | null
  pain_score: number
  daily_impact: string
}

function selectedOptions(form: FormData, name: string, options: readonly (readonly [string, string])[]) {
  const values = [...new Set(form.getAll(name))]
  return values.every((value): value is string => options.some(([id]) => id === value)) ? values : null
}

export function buildScreeningAnswers(form: FormData): ScreeningAnswers | null {
  const rawOccupation = form.get('occupation')
  const occupation = typeof rawOccupation === 'string' ? rawOccupation.trim() : ''
  const selectedHabits = selectedOptions(form, 'habits', habits)
  if (!occupation || occupation.length > maxOccupationLength || !selectedHabits) return null

  if (form.get('no_pain') === 'yes') {
    return { occupation, habits: selectedHabits, pain_areas: [], pain_duration: null, pain_score: 0, daily_impact: 'none' }
  }

  const areas = selectedOptions(form, 'pain_areas', painAreas)
  const duration = form.get('pain_duration')
  const impact = form.get('daily_impact')
  const score = form.get('pain_score')
  if (!areas?.length || typeof duration !== 'string' || !painDurations.some(([id]) => id === duration)
    || typeof impact !== 'string' || !dailyImpacts.some(([id]) => id === impact)
    || typeof score !== 'string' || !/^(?:[0-9]|10)$/.test(score)) return null

  return { occupation, habits: selectedHabits, pain_areas: areas, pain_duration: duration, pain_score: Number(score), daily_impact: impact }
}

export function isMissingScreeningTable(code: string | undefined) {
  return code === 'PGRST205' || code === '42P01'
}
