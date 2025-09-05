import { expect, should } from 'chai'
import sinon from 'sinon'
import { TimeMeasurer } from '../src/time-measurer.js'

should()

describe('Time Measurer', () => {

  let clock: sinon.SinonFakeTimers

  beforeEach(async () => {
    clock = sinon.useFakeTimers()
  })

  afterEach(() => {
    sinon.restore()
  })

  it('time elapsed is calculated based on hrtime', () => {
    const timeMeasurer = new TimeMeasurer()
    clock.tick(2000)
    expect(timeMeasurer.elapsedTime()).to.equal(2000)
  })

})