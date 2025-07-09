import { expect, should } from 'chai'
import { join } from 'path'
import ast from '../src/commands/ast'
import sinon from 'sinon'
import { spyCalledWithSubstring } from './assertions'
import logger from 'loglevel'

should()

const projectPath = join('examples', 'ast-examples')

describe('ast', () => {

  let processExitSpy: sinon.SinonStub
  let consoleLogSpy: sinon.SinonStub

  beforeEach(() => {
    processExitSpy = sinon.stub(process, 'exit')
    consoleLogSpy = sinon.stub(logger, 'info')
  })

  it('returns ast as json for project', async () => {
    await ast({ project: projectPath + '/ok-project', entityFQN: 'example' })
    expect (processExitSpy.calledWith(0)).to.be.true
    expect(spyCalledWithSubstring(consoleLogSpy, '"name": "example"')).to.be.true
    expect(spyCalledWithSubstring(consoleLogSpy, '"name": "Animal"')).to.be.true
    expect(spyCalledWithSubstring(consoleLogSpy, '"name": "pepita"')).to.be.true
  })

  it('if entity is provided, it filters ast correctly', async () => {
    await ast({ project: projectPath + '/ok-project', entityFQN: 'example.Animal' })
    expect (processExitSpy.calledWith(0)).to.be.true
    expect(spyCalledWithSubstring(consoleLogSpy, '"name": "Animal"')).to.be.true
    expect(spyCalledWithSubstring(consoleLogSpy, '"name": "pepita"')).to.be.false
  })

  it('if no file and not entity is provided, it returns all the nodes from the project', async () => {
    await ast({ project: projectPath + '/ok-project' })
    expect (processExitSpy.calledWith(0)).to.be.true
    expect(spyCalledWithSubstring(consoleLogSpy, '"name": "example"')).to.be.true
    expect(spyCalledWithSubstring(consoleLogSpy, '"name": "Animal"')).to.be.true
    expect(spyCalledWithSubstring(consoleLogSpy, '"name": "pepita"')).to.be.true
    expect(spyCalledWithSubstring(consoleLogSpy, '"name": "Extra"')).to.be.true
  })

  it('if no project is provided, it returns an error', async () => {
    await ast({ project: '' })
    expect (processExitSpy.calledWith(1)).to.be.true
  })

  afterEach(() => {
    sinon.restore()
  })
})