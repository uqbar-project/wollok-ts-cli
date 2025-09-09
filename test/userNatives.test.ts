import { afterEach, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest'
import logger from 'loglevel'
import { join } from 'path'
import test from '../src/commands/test.js'
import { logger as fileLogger } from '../src/logger.js'
import { spyCalledWithSubstring } from './assertions.js'
import { LeveledLogMethod } from 'winston'

describe('UserNatives', () => {
  const options = {
    project: join('examples', 'user-natives'),
    skipValidations: false,
    file: undefined,
    describe: undefined,
    test: undefined,
  }

  let processExitSpy: MockInstance<(code?: number) => never>
  let fileLoggerInfoSpy: MockInstance<LeveledLogMethod>
  let loggerInfoSpy: MockInstance<(...args: any[]) => any>

  beforeEach(() => {
    loggerInfoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {})
    fileLoggerInfoSpy = vi.spyOn(fileLogger, 'info')
      .mockImplementation(((_message: string, ..._meta: any[]) => fileLogger as any) as LeveledLogMethod)
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(((_code?: number) => {}) as (code?: number) => never)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('passes all the tests successfully and exits normally', async () => {
    await test(undefined, options)

    expect(processExitSpy).toHaveBeenCalledTimes(0)
    expect(spyCalledWithSubstring(loggerInfoSpy, 'Running 1 tests')).toBe(true)
    expect(spyCalledWithSubstring(loggerInfoSpy, '1 passed')).toBe(true)
    expect(spyCalledWithSubstring(loggerInfoSpy, '0 failed')).toBe(false)
    expect(spyCalledWithSubstring(loggerInfoSpy, '0 errored')).toBe(false)
    expect(fileLoggerInfoSpy).toHaveBeenCalledTimes(1)
    expect((fileLoggerInfoSpy.mock.calls[0][0] as any).result).toEqual({
      ok: 1,
      failed: 0,
      errored: 0,
    })
  })

})