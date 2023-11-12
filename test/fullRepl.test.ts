import chai from 'chai'
import chaiHttp from 'chai-http'
import { join } from 'path'
import chaiAsPromised from 'chai-as-promised'
import replFn from '../src/commands/repl'
import { Interface } from 'readline'
import sinon from 'sinon'

chai.should()
chai.use(chaiHttp)
chai.use(chaiAsPromised)
const expect = chai.expect

describe('REPL integration test', () => {
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

  it('should quit successfully', async () => {
    repl.emit('line', ':q')
    expect(processExitSpy.calledWith(0)).to.be.true
  })

})