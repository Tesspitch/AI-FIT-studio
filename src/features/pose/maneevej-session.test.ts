import { describe, expect, it } from 'vitest'
import { getRestSeconds, getRoundScore, getRoundSeconds, initialSession, routineReducer, summarizeManeevej, type RoundResult } from './maneevej-session'

const result: RoundResult = { left: 0, right: 0, score: 100, elapsedMs: 4500 }

describe('Maneevej set', () => {
  it('completes two rounds of each exercise with the appropriate rest', () => {
    let state = routineReducer(initialSession, { type: 'start', roundIndex: 0 })
    for (let index = 0; index < 10; index++) {
      expect(state.rounds.length).toBe(index)
      expect(state.phase).toBe('active')
      const finishedAt = 1000 * (index + 1)
      state = routineReducer(state, { type: 'finish', roundIndex: index, finishedAt, result })
      const rest = getRestSeconds(index + 1)
      expect(rest).toBe(index === 9 ? 0 : index % 2 ? 30 : 15)
      expect(state.restUntil).toBe(rest ? finishedAt + rest * 1000 : null)
      expect(state.phase).toBe(index === 9 ? 'done' : 'rest')
      if (state.restUntil !== null) {
        const ended = { type: 'rest-ended', roundIndex: index + 1, now: state.restUntil } as const
        expect(routineReducer(state, { ...ended, now: ended.now - 1 })).toBe(state)
        expect(routineReducer(state, { type: 'start', roundIndex: index + 1 })).toBe(state)
        state = routineReducer(state, ended)
      }
    }
    expect(state.rounds.reduce((elapsed, round) => elapsed + round.elapsedMs, 0)).toBe(45000)
    expect(routineReducer(state, { type: 'restart' })).toEqual(initialSession)
  })

  it('ignores repeated completion and events from a previous round', () => {
    const completed = { type: 'finish', roundIndex: 0, finishedAt: 5000, result } as const
    let state = routineReducer(initialSession, { type: 'start', roundIndex: 0 })
    state = routineReducer(state, completed)
    expect(routineReducer(state, completed)).toBe(state)
    expect(routineReducer(state, { type: 'start', roundIndex: 0 })).toBe(state)
    const second = routineReducer(state, { type: 'rest-ended', roundIndex: 1, now: 20000 })
    expect(second.phase).toBe('active')
    expect(routineReducer(second, completed)).toBe(second)
  })

  it('skips a whole exercise without adding workout results', () => {
    const active = routineReducer(initialSession, { type: 'start', roundIndex: 0 })
    const next = routineReducer(active, { type: 'skip-exercise', roundIndex: 0 })
    expect(next).toMatchObject({ phase: 'active', roundIndex: 2, rounds: [], testOnly: true })
    expect(routineReducer(next, { type: 'finish', roundIndex: 0, finishedAt: 7000, result })).toBe(next)

    const last = [2, 4, 6, 8].reduce(
      (state, roundIndex) => routineReducer(state, { type: 'skip-exercise', roundIndex }), next)
    expect(last).toMatchObject({ phase: 'done', roundIndex: 10, rounds: [], testOnly: true })
    expect(routineReducer(last, { type: 'restart' })).toBe(initialSession)
  })

  it('skips the waiting time and starts the upcoming round once', () => {
    const active = routineReducer(initialSession, { type: 'start', roundIndex: 0 })
    const rest = routineReducer(active, { type: 'finish', roundIndex: 0, finishedAt: 7000, result })
    const next = routineReducer(rest, { type: 'skip-rest', roundIndex: 1 })
    expect(next).toMatchObject({ phase: 'active', roundIndex: 1, rounds: [result], restUntil: null, testOnly: true })
    expect(routineReducer(next, { type: 'rest-ended', roundIndex: 1, now: 22000 })).toBe(next)
  })

  it('keeps real scores with their original exercise when advancing early', () => {
    let state = routineReducer(initialSession, { type: 'start', roundIndex: 0 })
    state = routineReducer(state, { type: 'finish', roundIndex: 0, finishedAt: 4500, result, early: true })
    expect(state).toMatchObject({ phase: 'active', roundIndex: 1, testOnly: true, restUntil: null })
    state = routineReducer(state, { type: 'skip-exercise', roundIndex: 1, result: { ...result, score: 0 } })
    state = routineReducer(state, { type: 'skip-exercise', roundIndex: 2 })
    state = routineReducer(state, { type: 'skip-exercise', roundIndex: 4, result })
    const summary = summarizeManeevej(state.rounds)
    expect(summary.exercises.map(({ score }) => score)).toEqual([50, null, 100, null, null])
    expect(summary.score).toBe(75)
    expect(summary.durationMs).toBe(13500)
  })

  it('adds two seconds to a clip and uses a 25-second default without usable metadata', () => {
    expect(getRoundSeconds(20)).toBe(22)
    expect(getRoundSeconds(12.25)).toBe(14.25)
    for (const duration of [null, 0, NaN, Infinity]) expect(getRoundSeconds(duration)).toBe(25)
  })

  it('leaves insufficient camera data unscored and averages exercises equally', () => {
    expect(getRoundScore({ sequence: 100, motion: 80, control: 60, nextStep: null }, 300, 1000)).toBe(87)
    expect(getRoundScore({ sequence: 100, motion: 100, control: 97, nextStep: null }, 300, 1000)).toBe(99.6)
    const partial = { sequence: 50, motion: 80, control: 60, nextStep: 3 }
    expect(getRoundScore(partial, 500, 1000)).toBe(62)
    expect(getRoundScore(partial, 499, 1000)).toBeNull()
    const scores = [100, null, 0, 0, 0, 100, null, null, 0, 0] as const
    const summary = summarizeManeevej(scores.map((score) => ({ ...result, score })))
    expect(summary.exercises.map((exercise) => exercise.score)).toEqual([100, 0, 50, null, 0])
    expect(summary.score).toBe(37.5)
    expect(summary.durationMs).toBe(45000)
  })
})
