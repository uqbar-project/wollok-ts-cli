// import { ElementDefinition } from 'cytoscape'
// import { existsSync } from 'fs'
import { MockInstance } from 'vitest'


// declare global {
//   export namespace Chai {
//     interface Assertion { // TODO: split into the separate modules
//       connect: (label: string, sourceLabel: string, targetLabel: string, width?: number, style?: string) => Assertion
//       pathExists(): Assertion
//     }

//     interface Include {
//       nodeWith: (query: ElementDefinitionQuery) => Assertion
//     }
//   }
// }

// export const pathAssertions: Chai.ChaiPlugin = (chai) => {
//   const { Assertion } = chai

//   Assertion.addMethod('pathExists', function () {
//     new Assertion(this._obj).to.be.an('string').length.above(0)
//     const exists = existsSync(this._obj)
//     this.assert(
//       exists,
//       `expected path ${this._obj} to exist`,
//       `expected path ${this._obj} not to exist`,
//       this._obj
//     )
//   })
// }


export const spyCalledWithSubstring = (spy: MockInstance, value: string, debug = false): boolean => {
  if (debug) console.info(`Checking for value [${value}] in spy`)
  return spy.mock.calls.some(call =>
    call.some(arg => typeof arg === 'string' && arg.includes(value))
  )
}