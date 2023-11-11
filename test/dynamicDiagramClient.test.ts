import { Interpreter } from 'wollok-ts/dist/interpreter/interpreter'
import chai from 'chai'
import chaiHttp from 'chai-http'
import { initializeClient, initializeInterpreter } from '../src/commands/repl'
import { join } from 'path'
import { Interface, createInterface as Repl } from 'readline'
import chaiAsPromised from 'chai-as-promised'

chai.should()
chai.use(chaiHttp)
chai.use(chaiAsPromised)
const expect = chai.expect

describe('dynamic diagram client', () => {
  const projectPath = join('examples', 'repl-examples')

  const options = {
    project: projectPath,
    skipValidations: false,
    darkMode: true,
    port: '8080',
    noDiagram: false,
  }
  let interpreter: Interpreter
  let repl: Interface

  beforeEach(async () => {
    interpreter = await initializeInterpreter(undefined, options)
    repl = Repl({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    })
  })

  it('should work for root path', async () => {
    const { enabled, app, server } = await initializeClient(options, repl, interpreter)
    expect(enabled).to.be.true
    const result = await chai.request(app).get('/index.html')
    expect(result).to.have.status(200)
    server!.close()
  })

  it('should return a fake client if noDiagram is set', async () => {
    const noDiagramOptions = {
      ...options,
      noDiagram: true,
    }
    const { enabled, app } = await initializeClient(noDiagramOptions, repl, interpreter)
    expect(enabled).to.be.false
    expect(app).to.be.undefined
  })

  // testing failure cases are extremely complicated due to server listeners and async notifications

})