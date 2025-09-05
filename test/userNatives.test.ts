import { expect } from 'chai'
import logger from 'loglevel'
import { join } from 'path'
import sinon from 'sinon'
import test from '../src/commands/test.ts'
import { logger as fileLogger } from '../src/logger.ts'
import { spyCalledWithSubstring } from './assertions.ts'

describe('UserNatives', () => {
  let fileLoggerInfoSpy: sinon.SinonStub
  let loggerInfoSpy: sinon.SinonStub
  let processExitSpy: sinon.SinonStub


  const options = {
    project: join('examples', 'user-natives'),
    skipValidations: false,
    file: undefined,
    describe: undefined,
    test: undefined,
  }


  beforeEach(() => {
    loggerInfoSpy = sinon.stub(logger, 'info')
    fileLoggerInfoSpy = sinon.stub(fileLogger, 'info')
    processExitSpy = sinon.stub(process, 'exit')
  })

  afterEach(() => {
    sinon.restore()
  })

  it('passes all the tests successfully and exits normally', async () => {
    await test(undefined, options )

    expect(processExitSpy.callCount).to.equal(0)
    expect(spyCalledWithSubstring(loggerInfoSpy, 'Running 1 tests')).to.be.true
    expect(spyCalledWithSubstring(loggerInfoSpy, '1 passed')).to.be.true
    expect(spyCalledWithSubstring(loggerInfoSpy, '0 failed')).to.be.false
    expect(spyCalledWithSubstring(loggerInfoSpy, '0 errored')).to.be.false
    expect(fileLoggerInfoSpy.calledOnce).to.be.true
    expect(fileLoggerInfoSpy.firstCall.firstArg.result).to.deep.equal({
      ok: 1,
      failed: 0,
      errored: 0,
    })
  })
})