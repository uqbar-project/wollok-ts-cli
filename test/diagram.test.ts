import { join } from 'path'
import { interprete, Interpreter } from 'wollok-ts'
import { initializeInterpreter } from '../src/commands/repl.js'
import { getDynamicDiagram } from '../src/utils.js'
import { beforeEach, describe, expect, it } from 'vitest'

type ElementDefinitionQuery = Record<string, any>

expect.extend({
  nodeWith(received: any[], query: ElementDefinitionQuery) {
    if (!Array.isArray(received)) {
      return {
        pass: false,
        message: () =>
          `Expected an array of elements, but got ${typeof received}`,
      }
    }

    const diagram = received.map(({ data }) =>
      Object.fromEntries(
        Object.entries(data).filter(([key]) => Object.keys(query).includes(key))
      )
    )

    const pass = diagram.some((entry) =>
      Object.entries(query).every(([k, v]) => entry[k] === v)
    )

    return {
      pass,
      message: () =>
        pass
          ? `Expected diagram NOT to contain node with ${JSON.stringify(query)}`
          : `Expected diagram to contain node with ${JSON.stringify(query)}`,
    }
  },

  connect(
    received: any[],
    label: string,
    source: string,
    target: string,
    width = 1,
    style = 'solid'
  ) {
    if (!Array.isArray(received)) {
      return {
        pass: false,
        message: () =>
          `Expected an array of elements, but got ${typeof received}`,
      }
    }

    const sourceNode = received.find(({ data }) => data.label === source)
    const targetNode = received.find(({ data }) => data.label === target)

    if (!sourceNode || !targetNode) {
      return {
        pass: false,
        message: () =>
          `Could not find source "${source}" or target "${target}" in diagram`,
      }
    }

    const connection = {
      label,
      source: sourceNode.data.id,
      target: targetNode.data.id,
      ...width && { width },
      ...style && { style },
    }

    // we reuse the nodeWith matcher internally
    const pass = received.some(({ data }) =>
      Object.entries(connection).every(([k, v]) => data[k] === v)
    )

    return {
      pass,
      message: () =>
        pass
          ? `Expected diagram NOT to contain connection ${JSON.stringify(connection)}`
          : `Expected diagram to contain connection ${JSON.stringify(connection)}`,
    }
  },
})

declare module 'vitest' {
  interface Assertion {
    nodeWith(query: ElementDefinitionQuery): void
    connect(label: string, source: string, target: string, width?: number, style?: string): void
  }
}

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
    const diagram = getDynamicDiagram(interpreter)

    expect(diagram).nodeWith({ type: 'object', label: 'george' })
    expect(diagram).nodeWith({ type: 'object', label: 'bobbyTheShark' })
  })

  it('should include edges between WKOs', () => {
    const diagram = getDynamicDiagram(interpreter)
    expect(diagram).connect('friend', 'bobbyTheShark', 'george')
  })

  it('should include edges between WKOs and custom classes', () => {
    const diagram = getDynamicDiagram(interpreter)
    expect(diagram).connect('bird', 'bobbyTheShark', 'Bird')
  })

  it('should include edges between WKOs and literal attributes', () => {
    const diagram = getDynamicDiagram(interpreter)
    expect(diagram).connect('age', 'bobbyTheShark', '5')
    expect(diagram).connect('name', 'bobbyTheShark', '"Bobby"')
    expect(diagram).connect('born', 'bobbyTheShark', '2/14/1971')
    expect(diagram).connect('isHappy', 'bobbyTheShark', 'true')
    expect(diagram).connect('range1', 'bobbyTheShark', '2..11')
    expect(diagram).connect('range2', 'bobbyTheShark', '[2, 7, 12]')
    expect(diagram).connect('aClosure', 'bobbyTheShark', '{ 5 + 2 }')
    expect(diagram).connect('someObject', 'bobbyTheShark', 'Object')
    expect(diagram).connect('dictionary', 'bobbyTheShark', 'a Dictionary []')
  })

  it('should include edges with extra info for constants', () => {
    expect(getDynamicDiagram(interpreter)).connect('fixedValue🔒', 'bobbyTheShark', '"Fixed"')
  })

  it('should include edges between classes and literal attributes', () => {
    expect(getDynamicDiagram(interpreter)).connect('energy', 'Bird', '100')
  })

  it('should resolve circular references successfully', () => {
    const diagram = getDynamicDiagram(interpreter)
    expect(diagram).connect('friend', 'Bird', 'bobbyTheShark')
    expect(diagram).connect('bird', 'bobbyTheShark', 'Bird')
  })

  it('should include the REPL object', () => {
    interprete(interpreter, 'var x')
    expect(getDynamicDiagram(interpreter)).nodeWith({ label: 'REPL', type: 'REPL' })
  })

  it('should include edges between REPL and WKOs', () => {
    interprete(interpreter, 'var x')
    expect(getDynamicDiagram(interpreter)).connect('x', 'REPL', 'null', 1.5)
  })

  it('should include constant edges between REPL and WKOs', () => {
    interprete(interpreter, 'const x = 7')
    expect(getDynamicDiagram(interpreter)).connect('x🔒', 'REPL', '7', 1.5)
  })

  it('should have a specific type for null object', () => {
    interprete(interpreter, 'var x')
    expect(getDynamicDiagram(interpreter)).nodeWith({ label: 'null', type: 'null' })
  })

  it('should include lists and their elements', () => {
    const diagram = getDynamicDiagram(interpreter)
    expect(diagram).nodeWith({ type: 'literal', label: 'List' })
    expect(diagram).nodeWith({ type: 'literal', label: '"blue"' })
    expect(diagram).nodeWith({ type: 'literal', label: '"orange"' })
    expect(diagram).nodeWith({ type: 'literal', label: '"grey"' })
    expect(diagram).connect('0', 'List', '"blue"', 1, 'dotted')
    expect(diagram).connect('1', 'List', '"orange"', 1, 'dotted')
    expect(diagram).connect('2', 'List', '"grey"', 1, 'dotted')
  })

  it('should include sets and their elements', () => {
    const diagram = getDynamicDiagram(interpreter)
    expect(diagram).nodeWith({ type: 'literal', label: 'Set' })
    expect(diagram).nodeWith({ type: 'literal', label: '"blue"' })
    expect(diagram).nodeWith({ type: 'literal', label: '"orange"' })
    expect(diagram).nodeWith({ type: 'literal', label: '"grey"' })
    expect(diagram).connect('', 'Set', '"blue"', 1, 'dotted')
    expect(diagram).connect('', 'Set', '"orange"', 1, 'dotted')
    expect(diagram).connect('', 'Set', '"grey"', 1, 'dotted')
  })

  it('should only include imported WKOs', async () => {
    interpreter = await initializeInterpreter(fileWithImports, options)
    const dataDiagram = getDynamicDiagram(interpreter)
    expect(dataDiagram).nodeWith({ type: 'object', label: 'a' })
    expect(dataDiagram).nodeWith({ type: 'object', label: 'b' })
    expect(dataDiagram).nodeWith({ type: 'object', label: 'c' })
    expect(dataDiagram).nodeWith({ type: 'object', label: 'd' })
    expect(dataDiagram.filter(_ => _.data.type == 'object' ).length).toBe(4)
  })
})