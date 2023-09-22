import { should, use } from 'chai'
import { join } from 'path'
import { Interpreter } from 'wollok-ts/dist/interpreter/interpreter'
import { initializeInterpreter } from '../src/commands/repl'
import { getDataDiagram } from '../src/services/diagram-generator'
import { diagramAssertions } from './assertions'
import { Variable } from 'wollok-ts'

use(diagramAssertions)
should()


const projectPath = join('examples', 'diagram-examples')

describe('Dinamic diagram', () => {
  const options = {
    project: projectPath,
    skipValidations: true,
    port: '8080',
  }
  let interpreter: Interpreter


  beforeEach(async () => {
    interpreter = await initializeInterpreter(undefined, options)
  })

  it('should include WKOs', () => {
    getDataDiagram(interpreter).should
      .include.nodeWith({ label: 'george' }).and.to
      .include.nodeWith({ label: 'bobbyTheShark' })
  })

  it('should include edges between WKOs', () => {
    getDataDiagram(interpreter).should.connect('friend', 'bobbyTheShark', 'george')
  })

  it('should include edges between WKOs and literal attributes', () => {
    getDataDiagram(interpreter).should.connect('age', 'bobbyTheShark', '5')
  })

  it('should include the REPL object', () => {
    interpreter.exec(new Variable({ isConstant: false, name: 'x' }))
    getDataDiagram(interpreter).should.include.nodeWith({ label: 'REPL', type: 'REPL' })
  })

  it('should include edges between REPL and WKOs', () => {
    interpreter.exec(new Variable({ isConstant: false, name: 'x' }))
    getDataDiagram(interpreter).should.connect('x', 'REPL', 'null')
  })

  it('should include lists and their elements', () => {
    getDataDiagram(interpreter).should
      .include.nodeWith({ label: 'List' }).and.to
      .include.nodeWith({ label: '"blue"' }).and.to
      .include.nodeWith({ label: '"orange"' }).and.to
      .include.nodeWith({ label: '"grey"' }).and.to
      .connect('0', 'List', '"blue"'  ).and.to
      .connect('1', 'List', '"orange"').and.to
      .connect('2', 'List', '"grey"'  )
  })

  it('should include sets and their elements', () => {
    getDataDiagram(interpreter).should
      .include.nodeWith({ label: 'Set' }).and.to
      .include.nodeWith({ label: '"blue"' }).and.to
      .include.nodeWith({ label: '"orange"' }).and.to
      .include.nodeWith({ label: '"grey"' }).and.to
      .connect('', 'Set', '"blue"'  ).and.to
      .connect('', 'Set', '"orange"').and.to
      .connect('', 'Set', '"grey"'  )
  })
})