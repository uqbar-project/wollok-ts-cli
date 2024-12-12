import { expect } from 'chai'
import logger from 'loglevel'
import { join } from 'path'
import sinon from 'sinon'
import { Environment } from 'wollok-ts'
import test, { getTarget, matchingTestDescription, sanitize, tabulationForNode, validateParameters } from '../src/commands/test'
import { logger as fileLogger } from '../src/logger'
import { buildEnvironmentForProject } from '../src/utils'
import { spyCalledWithSubstring } from './assertions'

describe('UserNatives', () => {

  describe('smoke test for test default function', () => {

    let fileLoggerInfoSpy: sinon.SinonStub
    let loggerInfoSpy: sinon.SinonStub
    let loggerErrorSpy: sinon.SinonStub
    let processExitSpy: sinon.SinonStub

    const projectPath = join('examples', 'user-natives')

    const emptyOptions = {
      project: projectPath,
      skipValidations: true,
      file: undefined,
      describe: undefined,
      test: undefined,
    }

    beforeEach(() => {
      loggerInfoSpy = sinon.stub(logger, 'info')
      fileLoggerInfoSpy = sinon.stub(fileLogger, 'info')
      processExitSpy = sinon.stub(process, 'exit')
      loggerErrorSpy = sinon.stub(logger, 'error')
    })

    afterEach(() => {
      sinon.restore()
    })

    it('passes all the tests successfully and exits normally', async () => {
      await test(undefined, {
        ...emptyOptions,
        file: 'userNatives.wtest',
      })

      expect(processExitSpy.callCount).to.equal(0)
      expect(spyCalledWithSubstring(loggerInfoSpy, 'Running 1 tests')).to.be.true
      expect(spyCalledWithSubstring(loggerInfoSpy, '1 passed')).to.be.true
      expect(spyCalledWithSubstring(loggerInfoSpy, '0 failed')).to.be.false
      expect(spyCalledWithSubstring(loggerInfoSpy, '0 errored')).to.be.false
      expect(fileLoggerInfoSpy.calledOnce).to.be.true
      expect(fileLoggerInfoSpy.firstCall.firstArg.result).to.deep.equal({ ok: 1, failed: 0, errored: 0 })
    })
  })
})