import { ElementDefinition } from 'cytoscape'
import { existsSync, readFileSync } from 'fs'

type ElementDefinitionQuery = Partial<ElementDefinition['data']>

declare global {
  export namespace Chai {
    interface Assertion { // TODO: split into the separate modules
      connect: (label: string, sourceLabel: string, targetLabel: string, width?: number, style?: string) => Assertion
      pathExists: Assertion
      jsonKeys(expectedKeys: string[]): Assertion;
      jsonMatch(expected: Record<string, any>): Assertion;
    }

    interface Include {
      nodeWith: (query: ElementDefinitionQuery) => Assertion
    }
  }
}

export const pathAssertions: Chai.ChaiPlugin = (chai) => {
  const { Assertion } = chai

  Assertion.addProperty('pathExists', function () {
    const path:string = this._obj
    const exists = existsSync(path)
    this.assert(
      exists,
      `expected this path to exist: '${path}'`,
      `expected this path to not exist: '${path}'`,
      true,
      exists,
      false
    )
  })
}


export const diagramAssertions: Chai.ChaiPlugin = (chai) => {
  const { Assertion } = chai

  chai.config.truncateThreshold = 0

  chai.use(function (_chai, utils) {
    utils.objDisplay = function (obj) { return `[${obj}]` }
  })

  Assertion.addMethod('nodeWith', function (query: ElementDefinitionQuery) {

    new Assertion(this._obj).to.be.an('array')
    const diagram = this._obj.map(
      ({ data }: any) => Object.fromEntries(
        Object.entries(data).filter(([key]) => Object.keys(query).includes(key))
      )
    )
    new Assertion(diagram).to.deep.contain(query)
  })

  Assertion.addMethod('connect', function (label: string, source: string, target: string, width = 1, style = 'solid') {
    const { data: { id: sourceId } } = this._obj.find(({ data }: any) => data.label === source)
    const { data: { id: targetId } } = this._obj.find(({ data }: any) => data.label === target)
    const connection = {
      label,
      source: sourceId,
      target: targetId,
      ...width && { width },
      ...style && { style },
    }
    new Assertion(this._obj).to.include.nodeWith(connection)
  })
}


// TODO: refactor
export const spyCalledWithSubstring = (spy: sinon.SinonStub, value: string, debug = false): boolean => {
  if (debug) console.info(`Checking for value [${value}] in spy`)
  for (let i = 0; i < spy.callCount; i++) {
    const call = spy.getCall(i)
    if (debug) console.info(` ${i}: `)
    for (let j = 0; j < call.args.length; j++) {
      if (debug) console.info(`   ${j}: ${call.args[j]}`)
      if (call.args[j].includes(value)) return true
    }
  }
  return false
}

export const jsonAssertions: Chai.ChaiPlugin = (chai) => {
  const { Assertion } = chai

  const getNestedValue = (obj: Record<string, any>, path: string): any =>
    path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj)

  const matchPartial = (
    expected: Record<string, any>,
    actual: Record<string, any>,
    prefix: string = ''
  ): boolean =>
    Object.keys(expected).every((key) => {
      const fullPath = prefix ? `${prefix}.${key}` : key
      if (typeof expected[key] === 'object' && expected[key] !== null) {
        if (typeof actual[key] !== 'object' || actual[key] === null) {
          return false
        }
        return matchPartial(expected[key], actual[key], fullPath)
      }
      return actual[key] === expected[key]
    })

  const getJsonContent = (filePath: string): any => {
    if (!existsSync(filePath)) {
      throw new chai.AssertionError(`Expected file "${filePath}" to exist`)
    }

    try {
      return JSON.parse(readFileSync(filePath, 'utf8'))
    } catch (error) {
      throw new chai.AssertionError(
        `Failed to parse JSON from file "${filePath}": ${String(error)}`
      )
    }
  }

  Assertion.addMethod('jsonKeys', function (expectedKeys: string[]) {
    const filePath = this._obj as string

    const jsonContent = getJsonContent(filePath)

    expectedKeys.forEach((key) =>
      this.assert(
        getNestedValue(jsonContent, key) !== undefined,
        `Expected JSON to have key "${key}"`,
        `Expected JSON not to have key "${key}"`,
        key
      )
    )
  })

  Assertion.addMethod('jsonMatch', function (expected: Record<string, any>) {
    const filePath = this._obj as string

    const jsonContent = getJsonContent(filePath)

    this.assert(
      matchPartial(expected, jsonContent),
      `Expected JSON to match: ${JSON.stringify(expected)}, but got: ${JSON.stringify(jsonContent)}`,
      `Expected JSON not to match: ${JSON.stringify(expected)}`,
      expected,
      jsonContent,
      true
    )
  })
}