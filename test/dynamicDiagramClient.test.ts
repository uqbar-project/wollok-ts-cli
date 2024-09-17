import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiHttp from 'chai-http'
import { join } from 'path'
import { Interface, createInterface as Repl } from 'readline'
import { Interpreter } from 'wollok-ts'
import { initializeClient, initializeInterpreter } from '../src/commands/repl'

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
    host: 'localhost',
    skipDiagram: false,
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

  it('should return a fake client if skipDiagram is set', async () => {
    const skipDiagramOptions = {
      ...options,
      skipDiagram: true,
    }
    const { enabled, app, server } = await initializeClient(skipDiagramOptions, repl, interpreter)
    expect(enabled).to.be.false
    expect(app).to.be.undefined
    expect(server).to.be.undefined
  })

  // testing failure cases are extremely complicated due to server listeners and async notifications

})