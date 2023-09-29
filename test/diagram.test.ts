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

describe('Dynamic diagram', () => {
  const options = {
    project: projectPath,
    skipValidations: true,
    port: '8080',
    darkMode: true,
  }
  let interpreter: Interpreter


  beforeEach(async () => {
    interpreter = await initializeInterpreter('examples/diagram-examples/fish.wlk', options)
  })

  it('should include WKOs', () => {
    getDataDiagram(interpreter).should
      .include.nodeWith({ type: 'object', label: 'george' }).and.to
      .include.nodeWith({ type: 'object', label: 'bobbyTheShark' })
  })

  it('should include edges between WKOs', () => {
    getDataDiagram(interpreter).should.connect('friend', 'bobbyTheShark', 'george')
  })

  it('should include edges between WKOs and custom classes', () => {
    getDataDiagram(interpreter).should.connect('bird', 'bobbyTheShark', 'Bird')
  })

  it('should include edges between WKOs and literal attributes', () => {
    getDataDiagram(interpreter).should.connect('age', 'bobbyTheShark', '5')
      .and.to.connect('name', 'bobbyTheShark', '"Bobby"')
      .and.to.connect('born', 'bobbyTheShark', '2/14/1971')
      .and.to.connect('isHappy', 'bobbyTheShark', 'true')
      .and.to.connect('range1', 'bobbyTheShark', '2..11')
      .and.to.connect('range2', 'bobbyTheShark', '[2, 7, 12]')
      .and.to.connect('aClosure', 'bobbyTheShark', '{ 5 + 2 }')
      .and.to.connect('someObject', 'bobbyTheShark', 'Object')
      .and.to.connect('dictionary', 'bobbyTheShark', 'a Dictionary []')
  })

  it('should include edges with extra info for constants', () => {
    getDataDiagram(interpreter).should.connect('fixedValue🔒', 'bobbyTheShark', '"Fixed"')
  })

  it('should include edges between classes and literal attributes', () => {
    getDataDiagram(interpreter).should.connect('energy', 'Bird', '100')
  })

  it('should resolve circular references successfully', () => {
    getDataDiagram(interpreter).should.connect('friend', 'Bird', 'bobbyTheShark')
      .and.to.connect('bird', 'bobbyTheShark', 'Bird')
  })

  it('should include the REPL object', () => {
    interpreter.exec(new Variable({ isConstant: false, name: 'x' }))
    getDataDiagram(interpreter).should.include.nodeWith({ label: 'REPL', type: 'REPL' })
  })

  it('should include edges between REPL and WKOs', () => {
    interpreter.exec(new Variable({ isConstant: false, name: 'x' }))
    getDataDiagram(interpreter).should.connect('x', 'REPL', 'null')
  })

  it('should have a specific type for null object', () => {
    interpreter.exec(new Variable({ isConstant: false, name: 'x' }))
    getDataDiagram(interpreter).should.include.nodeWith({ label: 'null', type: 'null' })
  })

  it('should include lists and their elements', () => {
    getDataDiagram(interpreter).should
      .include.nodeWith({ type: 'literal', label: 'List' }).and.to
      .include.nodeWith({ type: 'literal', label: '"blue"' }).and.to
      .include.nodeWith({ type: 'literal', label: '"orange"' }).and.to
      .include.nodeWith({ type: 'literal', label: '"grey"' }).and.to
      .connect('0', 'List', '"blue"'  ).and.to
      .connect('1', 'List', '"orange"').and.to
      .connect('2', 'List', '"grey"'  )
  })

  it('should include sets and their elements', () => {
    getDataDiagram(interpreter).should
      .include.nodeWith({ type: 'literal', label: 'Set' }).and.to
      .include.nodeWith({ type: 'literal', label: '"blue"' }).and.to
      .include.nodeWith({ type: 'literal', label: '"orange"' }).and.to
      .include.nodeWith({ type: 'literal', label: '"grey"' }).and.to
      .connect('', 'Set', '"blue"'  ).and.to
      .connect('', 'Set', '"orange"').and.to
      .connect('', 'Set', '"grey"'  )
  })
})