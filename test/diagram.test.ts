import { should, use } from 'chai'
import { join } from 'path'
import { interprete, Interpreter } from 'wollok-ts'
import { initializeInterpreter } from '../src/commands/repl.ts'
import { getDynamicDiagram } from '../src/utils.ts'
import { diagramAssertions } from './assertions.ts'

use(diagramAssertions)
should()

const projectPath = join('examples', 'diagram-examples')
const simpleFile = join(projectPath, 'fish.wlk')
const fileWithImports = join(projectPath, 'using-imports', 'base.wlk')

describe('Dynamic diagram', () => {
  const options = {
    assets: 'assets',
    project: projectPath,
    skipValidations: true,
    port: '8080',
    host: 'localhost',
    darkMode: true,
    skipDiagram: true, // we don't want to open a socket
  }
  let interpreter: Interpreter


  beforeEach(async () => {
    interpreter = await initializeInterpreter(simpleFile, options)
  })

  it('should include WKOs', () => {
    getDynamicDiagram(interpreter).should
      .include.nodeWith({ type: 'object', label: 'george' }).and.to
      .include.nodeWith({ type: 'object', label: 'bobbyTheShark' })
  })

  it('should include edges between WKOs', () => {
    getDynamicDiagram(interpreter).should.connect('friend', 'bobbyTheShark', 'george')
  })

  it('should include edges between WKOs and custom classes', () => {
    getDynamicDiagram(interpreter).should.connect('bird', 'bobbyTheShark', 'Bird')
  })

  it('should include edges between WKOs and literal attributes', () => {
    getDynamicDiagram(interpreter).should.connect('age', 'bobbyTheShark', '5')
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
    getDynamicDiagram(interpreter).should.connect('fixedValue🔒', 'bobbyTheShark', '"Fixed"')
  })

  it('should include edges between classes and literal attributes', () => {
    getDynamicDiagram(interpreter).should.connect('energy', 'Bird', '100')
  })

  it('should resolve circular references successfully', () => {
    getDynamicDiagram(interpreter).should.connect('friend', 'Bird', 'bobbyTheShark')
      .and.to.connect('bird', 'bobbyTheShark', 'Bird')
  })

  it('should include the REPL object', () => {
    interprete(interpreter, 'var x')
    getDynamicDiagram(interpreter).should.include.nodeWith({ label: 'REPL', type: 'REPL' })
  })

  it('should include edges between REPL and WKOs', () => {
    interprete(interpreter, 'var x')
    getDynamicDiagram(interpreter).should.connect('x', 'REPL', 'null', 1.5)
  })

  it('should include constant edges between REPL and WKOs', () => {
    interprete(interpreter, 'const x = 7')
    getDynamicDiagram(interpreter).should.connect('x🔒', 'REPL', '7', 1.5)
  })

  it('should have a specific type for null object', () => {
    interprete(interpreter, 'var x')
    getDynamicDiagram(interpreter).should.include.nodeWith({ label: 'null', type: 'null' })
  })

  it('should include lists and their elements', () => {
    getDynamicDiagram(interpreter).should
      .include.nodeWith({ type: 'literal', label: 'List' }).and.to
      .include.nodeWith({ type: 'literal', label: '"blue"' }).and.to
      .include.nodeWith({ type: 'literal', label: '"orange"' }).and.to
      .include.nodeWith({ type: 'literal', label: '"grey"' }).and.to
      .connect('0', 'List', '"blue"', 1, 'dotted').and.to
      .connect('1', 'List', '"orange"', 1, 'dotted').and.to
      .connect('2', 'List', '"grey"', 1, 'dotted')
  })

  it('should include sets and their elements', () => {
    getDynamicDiagram(interpreter).should
      .include.nodeWith({ type: 'literal', label: 'Set' }).and.to
      .include.nodeWith({ type: 'literal', label: '"blue"' }).and.to
      .include.nodeWith({ type: 'literal', label: '"orange"' }).and.to
      .include.nodeWith({ type: 'literal', label: '"grey"' }).and.to
      .connect('', 'Set', '"blue"', 1, 'dotted').and.to
      .connect('', 'Set', '"orange"', 1, 'dotted').and.to
      .connect('', 'Set', '"grey"', 1, 'dotted')
  })


  it('should only include imported WKOs', async () => {
    interpreter = await initializeInterpreter(fileWithImports, options)
    const dataDiagram = getDynamicDiagram(interpreter)
    dataDiagram.should
      .include.nodeWith({ type: 'object', label: 'a' }).and.to
      .include.nodeWith({ type: 'object', label: 'b' }).and.to
      .include.nodeWith({ type: 'object', label: 'c' }).and.to
      .include.nodeWith({ type: 'object', label: 'd' })
    dataDiagram.filter(_ => _.data.type == 'object' ).should.have.length(4)
  })
})