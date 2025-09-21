import { existsSync } from 'fs'
import { expect, MockInstance } from 'vitest'


declare module 'vitest' {
  interface Assertion {
    pathExists(): void
  }
  interface AsymmetricMatchersContaining {
    pathExists(): void
  }
}

expect.extend({
  pathExists(received: string) {
    if (typeof received !== 'string' || received.length === 0) {
      return {
        pass: false,
        message: () => `expected a non-empty string path, but got ${received}`,
      }
    }

    const pass = existsSync(received)

    return {
      pass,
      message: () => `expected path '${received}' ${this.isNot ? 'not ' : ''}to exist`,
    }
  },
})


export const spyCalledWithSubstring = (spy: MockInstance, value: string, debug = false): boolean => {
  if (debug) console.info(`Checking for value [${value}] in spy`)
  return spy.mock.calls.some(call =>
    call.some(arg => typeof arg === 'string' && arg.includes(value))
  )
}