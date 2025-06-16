import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiHttp from 'chai-http'
import { join } from 'path'
import { Interface } from 'readline'
import sinon from 'sinon'
import { Server } from 'socket.io'
import * as wollok from 'wollok-ts'
import { Options, replFn } from '../src/commands/repl'
import { ENTER } from '../src/utils'
import { spyCalledWithSubstring } from './assertions'
import { fakeIO } from './mocks'

chai.should()
chai.use(chaiHttp)
chai.use(chaiAsPromised)
const expect = chai.expect

const baseOptions = {
  darkMode: true,
  port: '8080',
  host: 'localhost',
  skipDiagram: true,
  assets: 'assets',
}

const buildOptionsFor = (path: string, skipValidations = false) => ({
  ...baseOptions,
  project: join('examples', 'bad-files-examples', path),
  skipValidations,
})

const startReplCommand = (autoImportPath: string, options: Options) =>
  replFn(join(options.project, autoImportPath), options)

describe('REPL command', () => {
  const projectPath = join('examples', 'repl-examples')

  const options = {
    project: projectPath,
    skipValidations: false,
    ...baseOptions,
  }
  let processExitSpy: sinon.SinonStub
  let consoleLogSpy: sinon.SinonStub
  let initializeGameClientSpy: sinon.SinonStub
  let repl: Interface
  let io: Server

  beforeEach(async () => {
    processExitSpy = sinon.stub(process, 'exit')
    consoleLogSpy = sinon.stub(console, 'log')
    io = fakeIO()
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    initializeGameClientSpy = sinon.stub(require('../src/game'), 'initializeGameClient').returns(io)
    repl = await replFn(undefined, options)
  })

  afterEach(() => {
    sinon.restore()
    repl.close()
    io.close()
  })

  it('should process values & quit successfully', async () => {
    repl.write('const a = 1' + ENTER)
    repl.write('const b = a + 5' + ENTER)
    repl.write('b' + ENTER)
    expect(spyCalledWithSubstring(consoleLogSpy, '6')).to.be.true
    repl.emit('line', ':q')
    expect(processExitSpy.calledWith(0)).to.be.true
  })

  it('should init game server', async () => {
    expect(initializeGameClientSpy.called).to.be.false
    repl.write('game.start()' + ENTER)
    expect(spyCalledWithSubstring(consoleLogSpy, 'true')).to.be.true
    expect(initializeGameClientSpy.called).to.be.true
  })

  it('should quit successfully if project has validation errors but skip validation config is passed', async () => {
    const repl = await startReplCommand('fileWithValidationErrors.wlk', buildOptionsFor('validation-errors', true))
    repl.emit('line', ':q')
    expect(processExitSpy.calledWith(0)).to.be.true
    repl.close()
  })


})

describe('REPL command - invalid project', () => {
  beforeEach(async () => {
    sinon.stub(process, 'exit').callsFake((code?: number | undefined) => {
      throw new Error(code && code > 0 ? `exit with ${code} error code` : 'ok')
    })
  })

  afterEach(() => {
    sinon.restore()
  })

  it('should return exit code 12 if project has parse errors', async () => {
    sinon.stub(wollok, 'buildEnvironment').throws(new Error('Failed to parse fileWithParseErrors.wlk'))

    await expect(startReplCommand('fileWithParseErrors.wlk', buildOptionsFor('parse-errors'))).to.eventually.be.rejectedWith(/exit with 12 error code/)
  })

  it('should return exit code 12 if project has validation errors', async () => {
    await expect(startReplCommand('fileWithValidationErrors.wlk', buildOptionsFor('validation-errors'))).to.eventually.be.rejectedWith(/exit with 12 error code/)
  })

  it('should return exit code 12 if file does not exist - no validation', async () => {
    await expect(startReplCommand('noFile.wlk', buildOptionsFor('validation-errors', true))).to.eventually.be.rejectedWith(/exit with 12 error code/)
  })

  it('should return exit code 12 if file does not exist - with validation', async () => {
    await expect(startReplCommand('noFile.wlk', buildOptionsFor('missing-files'))).to.eventually.be.rejectedWith(/exit with 12 error code/)
  })

})