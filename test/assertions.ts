import { ElementDefinition } from 'cytoscape'

type ElementDefinitionQuery = Partial<ElementDefinition['data']>

declare global {
    export namespace Chai {
        interface Assertion { // TODO: split into the separate modules
            connect: (label: string, sourceLabel: string, targetLabel: string, width?: number, style?: string ) => Assertion
        }

        interface Include {
            nodeWith: (query: ElementDefinitionQuery) => Assertion
        }
    }
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

  Assertion.addMethod('connect', function ( label: string, source: string, target: string, width = 1, style = 'solid') {
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