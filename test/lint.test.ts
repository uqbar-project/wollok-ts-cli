import { expect, should } from 'chai'
import { join } from 'path'
import lint from '../src/commands/lint.js'
import sinon from 'sinon'
import { spyCalledWithSubstring } from './assertions.js'
import logger from 'loglevel'

should()

const projectPath = join('examples', 'lint-examples')

describe('lint', () => {

  let processExitSpy: sinon.SinonStub
  let consoleLogSpy: sinon.SinonStub

  beforeEach(() => {
    processExitSpy = sinon.stub(process, 'exit')
    consoleLogSpy = sinon.stub(logger, 'info')
  })

  it('ok project does not find errors or warnings', async () => {
    await lint({ project: projectPath + '/ok-project' })
    expect (processExitSpy.calledWith(0)).to.be.true
    expect(spyCalledWithSubstring(consoleLogSpy, 'No errors or warnings found!')).to.be.true
  })

  it('failed project finds errors and warnings', async () => {
    await lint({ project: projectPath + '/error-project' })
    expect (processExitSpy.calledWith(2)).to.be.true
    expect(spyCalledWithSubstring(consoleLogSpy, '1 Error')).to.be.true
    expect(spyCalledWithSubstring(consoleLogSpy, '1 Warning')).to.be.true
  })

  it('project with several errors finds errors and warnings', async () => {
    await lint({ project: projectPath + '/several-errors-project' })
    expect (processExitSpy.calledWith(2)).to.be.true
    expect(spyCalledWithSubstring(consoleLogSpy, '2 Errors')).to.be.true
    expect(spyCalledWithSubstring(consoleLogSpy, '3 Warnings')).to.be.true
  })

  it('filtering by file finds errors and warnings', async () => {
    await lint({ project: projectPath + '/error-project', entityFQN: 'testExample' })
    expect (processExitSpy.calledWith(2)).to.be.true
    expect(spyCalledWithSubstring(consoleLogSpy, '1 Error')).to.be.true
    expect(spyCalledWithSubstring(consoleLogSpy, '0 Warnings')).to.be.true
  })

  it('filtering by file finds errors and warnings', async () => {
    await lint({ project: projectPath + '/error-project', entityFQN: 'example' })
    expect (processExitSpy.calledWith(2)).to.be.true
    expect(spyCalledWithSubstring(consoleLogSpy, '1 Warning')).to.be.true
    expect(spyCalledWithSubstring(consoleLogSpy, '0 Errors')).to.be.true
  })

  it('filtering by unexistent entity return error exit code', async () => {
    await lint({ project: projectPath + '/error-project', entityFQN: 'nonExistentEntity' })
    expect (processExitSpy.calledWith(1)).to.be.true
  })

  afterEach(() => {
    sinon.restore()
  })
})