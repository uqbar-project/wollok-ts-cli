import { ElementDefinition } from 'cytoscape'

type ElementDefinitionQuery = Partial<ElementDefinition['data']>

declare global {
    export namespace Chai {
        interface Assertion { // TODO: split into the separate modules
            connect: (label: string, sourceLabel: string, targetLabel: string) => Assertion
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

  Assertion.addMethod('connect', function ( label: string, source: string, target: string ) {
    const { data: { id: sourceId } } = this._obj.find(({ data }: any) => data.label === source)
    const { data: { id: targetId } } = this._obj.find(({ data }: any) => data.label === target)
    new Assertion(this._obj).to.include.nodeWith({ label, source: sourceId, target: targetId })
  })
}