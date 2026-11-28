import { describe, expect, it } from 'vitest'
import { buildScreeningAnswers, isMissingScreeningTable } from './screening'

function responses(fields: Record<string, string | string[]>) {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) form.append(name, item)
  }
  return form
}

describe('first-login screening', () => {
  it('normalizes a response with several habits and pain areas', () => {
    expect(buildScreeningAnswers(responses({
      occupation: ' พนักงานสำนักงาน ', habits: ['long_sitting', 'neck_bending', 'long_sitting'],
      pain_areas: ['neck', 'lower_back'], pain_duration: 'one_to_three_months', pain_score: '7', daily_impact: 'moderate',
    }))).toEqual({
      occupation: 'พนักงานสำนักงาน', habits: ['long_sitting', 'neck_bending'],
      pain_areas: ['neck', 'lower_back'], pain_duration: 'one_to_three_months', pain_score: 7, daily_impact: 'moderate',
    })
  })

  it('records explicit no-pain answers without a duration or phantom impact', () => {
    expect(buildScreeningAnswers(responses({ occupation: 'นักศึกษา', no_pain: 'yes', pain_score: '8' }))).toEqual({
      occupation: 'นักศึกษา', habits: [], pain_areas: [], pain_duration: null, pain_score: 0, daily_impact: 'none',
    })
  })

  it('requires an explicit pain response and a valid duration, score, and impact when there is pain', () => {
    expect(buildScreeningAnswers(responses({ occupation: 'นักศึกษา' }))).toBeNull()
    const fields = { occupation: 'นักศึกษา', pain_areas: ['neck'], pain_duration: 'under_one_week', pain_score: '4', daily_impact: 'low' }
    expect(buildScreeningAnswers(responses({ ...fields, pain_score: '11' }))).toBeNull()
    expect(buildScreeningAnswers(responses({ ...fields, pain_score: ' ' }))).toBeNull()
    expect(buildScreeningAnswers(responses({ ...fields, pain_areas: ['other'] }))).toBeNull()
    expect(buildScreeningAnswers(responses({ ...fields, pain_duration: '' }))).toBeNull()
  })

  it('distinguishes a migration that is not installed from a failed check', () => {
    for (const code of ['PGRST205', '42P01']) expect(isMissingScreeningTable(code)).toBe(true)
    for (const code of ['42501', 'PGRST301', undefined]) expect(isMissingScreeningTable(code)).toBe(false)
  })
})
