import { fail } from 'assert'
import { existsSync } from 'fs'
import { expect, MockInstance } from 'vitest'
import { isEmpty } from 'wollok-ts'


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

export const expectCalledWithSubstrings = (spy: MockInstance, ...expected: string[]): void => {
  if (isEmpty(spy.mock.calls)) fail(`Unexpected calls ${expected}`)
  let nAsserted = 0
  for (const call of spy.mock.calls) {
    if (call.some(arg => typeof arg === 'string' && arg.includes(expected[nAsserted]))) nAsserted++
  }
  if (nAsserted !== expected.length) fail(`Calls ${expected} not found in ${spy.mock.calls}`)
}