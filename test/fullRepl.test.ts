import chai from 'chai'
import chaiHttp from 'chai-http'
import { join } from 'path'
import chaiAsPromised from 'chai-as-promised'
import { Options, replFn } from '../src/commands/repl'
import { Interface } from 'readline'
import sinon from 'sinon'

chai.should()
chai.use(chaiHttp)
chai.use(chaiAsPromised)
const expect = chai.expect

const baseOptions = {
  darkMode: true,
  port: '8080',
  noDiagram: true,
}

const buildOptionsFor = (path: string, skipValidations = false) => ({
  ...baseOptions,
  project: join('examples', 'bad-files-examples', path),
  skipValidations,
})

const callRepl = (autoImportPath: string, options: Options) =>
  replFn(join(options.project, autoImportPath), options)


describe('REPL integration test for valid project', () => {
  const projectPath = join('examples', 'repl-examples')

  const options = {
    project: projectPath,
    skipValidations: false,
    darkMode: true,
    port: '8080',
    noDiagram: false,
  }
  let processExitSpy: sinon.SinonStub
  let repl: Interface

  beforeEach(async () => {
    processExitSpy = sinon.stub(process, 'exit')
    repl = await replFn(undefined, options)
  })

  afterEach(() => {
    sinon.restore()
  })

  it('should quit successfully', async () => {
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

  it('should return exit code 1 if project has parse errors', async () => {
    await expect(callRepl('fileWithParseErrors.wlk', buildOptionsFor('parse-errors'))).to.eventually.be.rejectedWith(/exit with 1 error code/)
  })

  it('should return exit code 1 if project has validation errors', async () => {
    await expect(callRepl('fileWithValidationErrors.wlk', buildOptionsFor('validation-errors'))).to.eventually.be.rejectedWith(/exit with 1 error code/)
  })

  it('should return exit code 1 if file does not exist - no validation', async () => {
    await expect(callRepl('noFile.wlk', buildOptionsFor('validation-errors', true))).to.eventually.be.rejectedWith(/exit with 1 error code/)
  })

  it('should return exit code 1 if file does not exist - with validation', async () => {
    await expect(callRepl('noFile.wlk', buildOptionsFor('missing-files'))).to.eventually.be.rejectedWith(/exit with 1 error code/)
  })

})