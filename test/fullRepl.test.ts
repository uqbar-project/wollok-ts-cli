import chai from 'chai'
import chaiHttp from 'chai-http'
import { join } from 'path'
import chaiAsPromised from 'chai-as-promised'
import { Options, replFn } from '../src/commands/repl'
import { Interface } from 'readline'
import sinon from 'sinon'
import { ENTER } from '../src/utils'
import { spyCalledWithSubstring } from './assertions'
import * as wollok from 'wollok-ts'

chai.should()
chai.use(chaiHttp)
chai.use(chaiAsPromised)
const expect = chai.expect

const baseOptions = {
  darkMode: true,
  port: '8080',
  host: 'localhost',
  skipDiagram: true,
}

const buildOptionsFor = (path: string, skipValidations = false) => ({
  ...baseOptions,
  project: join('examples', 'bad-files-examples', path),
  skipValidations,
})

const callRepl = (autoImportPath: string, options: Options) =>
  replFn(join(options.project, autoImportPath), options)

// Be careful, if you are in developing mode
// and some of these tests fail it will lead to exit code 13
// because an active session of the dynamic diagram
// will remain running in background
describe('REPL integration test for valid project', () => {
  const projectPath = join('examples', 'repl-examples')

  const options = {
    project: projectPath,
    skipValidations: false,
    darkMode: true,
    host: 'localhost',
    port: '8080',
    skipDiagram: true,
  }
  let processExitSpy: sinon.SinonStub
  let consoleLogSpy: sinon.SinonStub
  let repl: Interface

  beforeEach(async () => {
    processExitSpy = sinon.stub(process, 'exit')
    consoleLogSpy = sinon.stub(console, 'log')
    repl = await replFn(undefined, options)
  })

  afterEach(() => {
    sinon.restore()
  })

  it('should process values & quit successfully', async () => {
    repl.write('const a = 1' + ENTER)
    repl.write('const b = a + 5' + ENTER)
    repl.write('b' + ENTER)
    expect(spyCalledWithSubstring(consoleLogSpy, '6')).to.be.true
    repl.emit('line', ':q')
    expect(processExitSpy.calledWith(0)).to.be.true
  })

  it('should quit successfully if project has validation errors but skip validation config is passed', async () => {
    const repl = await callRepl('fileWithValidationErrors.wlk', buildOptionsFor('validation-errors', true))
    repl.emit('line', ':q')
    expect(processExitSpy.calledWith(0)).to.be.true
  })


})

describe('REPL integration test for invalid project', () => {
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

    await expect(callRepl('fileWithParseErrors.wlk', buildOptionsFor('parse-errors'))).to.eventually.be.rejectedWith(/exit with 12 error code/)
  })

  it('should return exit code 12 if project has validation errors', async () => {
    await expect(callRepl('fileWithValidationErrors.wlk', buildOptionsFor('validation-errors'))).to.eventually.be.rejectedWith(/exit with 12 error code/)
  })

  it('should return exit code 12 if file does not exist - no validation', async () => {
    await expect(callRepl('noFile.wlk', buildOptionsFor('validation-errors', true))).to.eventually.be.rejectedWith(/exit with 12 error code/)
  })

  it('should return exit code 12 if file does not exist - with validation', async () => {
    await expect(callRepl('noFile.wlk', buildOptionsFor('missing-files'))).to.eventually.be.rejectedWith(/exit with 12 error code/)
  })

})