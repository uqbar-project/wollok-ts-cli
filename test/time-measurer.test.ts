import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TimeMeasurer } from '../src/time-measurer.js'

describe('Time Measurer', () => {

  beforeEach(async () => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('time elapsed is calculated based on hrtime', () => {
    const timeMeasurer = new TimeMeasurer()
    vi.advanceTimersByTime(2000)
    expect(timeMeasurer.elapsedTime()).to.equal(2000)
  })

})