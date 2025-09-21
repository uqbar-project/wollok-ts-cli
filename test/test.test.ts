import { join } from 'path'
import { vi, describe, it, beforeEach, afterEach, expect, MockInstance } from 'vitest'
import logger from 'loglevel'
import { logger as fileLogger } from '../src/logger.js'
import { buildEnvironmentForProject } from '../src/utils.js'
import test, { getTarget, matchingTestDescription, sanitize, tabulationForNode, validateParameters } from '../src/commands/test.js'
import { spyCalledWithSubstring } from './assertions.js'
import type { LeveledLogMethod } from 'winston'

describe('Test', () => {

  describe('getTarget', () => {

    let environment: any

    describe('normal case', () => {
      const projectPath = join('examples', 'test-examples', 'normal-case')
      const emptyOptions = { project: projectPath, skipValidations: false, file: undefined, describe: undefined, test: undefined }

      beforeEach(async () => {
        environment = await buildEnvironmentForProject(projectPath)
      })

      describe('using filter option', () => {
        it('should filter by test using filter option', () => {
          const tests = getTarget(environment, 'another test', emptyOptions)
          expect(tests.length).toBe(3)
          expect(tests[0].name).toBe('"another test"')
          expect(tests[1].name).toBe('"another test with longer name"')
          expect(tests[2].name).toBe('"just another test"')
        })

        it('should filter by test using filter option - case insensitive', () => {
          const tests = getTarget(environment, 'aNothEr Test', emptyOptions)
          expect(tests.length).toBe(0)
        })

        it('should filter by describe using filter option', () => {
          const tests = getTarget(environment, 'second describe', emptyOptions)
          expect(tests.length).toBe(2)
          expect(tests[0].name).toBe('"second test"')
          expect(tests[1].name).toBe('"another second test"')
        })

        it('should filter by describe using filter option - case insensitive', () => {
          const tests = getTarget(environment, 'SeCOND describe', emptyOptions)
          expect(tests.length).toBe(0)
        })

        it('should filter by file using filter option', () => {
          const tests = getTarget(environment, 'test-one', emptyOptions)
          expect(tests.length).toBe(3)
          expect(tests[0].name).toBe('"a test"')
          expect(tests[1].name).toBe('"another test"')
          expect(tests[2].name).toBe('"another test with longer name"')
        })

        it('should filter by file & describe using filter option', () => {
          const tests = getTarget(environment, 'test-one.this describe', emptyOptions)
          expect(tests.length).toBe(3)
          expect(tests[0].name).toBe('"a test"')
          expect(tests[1].name).toBe('"another test"')
          expect(tests[2].name).toBe('"another test with longer name"')
        })

        it('should filter by file using filter option', () => {
          const tests = getTarget(environment, 'test-one.this describe.another test', emptyOptions)
          expect(tests.length).toBe(2)
          expect(tests[0].name).toBe('"another test"')
          expect(tests[1].name).toBe('"another test with longer name"')
        })
      })

      describe('with file/describe/test options', () => {
        it('should filter by test using test option', () => {
          const tests = getTarget(environment, undefined, { ...emptyOptions, test: 'another test' })
          expect(tests.length).toBe(1)
          expect(tests[0].name).toBe('"another test"')
        })

        it('should filter by test using test option - case sensitive', () => {
          const tests = getTarget(environment, undefined, { ...emptyOptions, test: 'aNother Test' })
          expect(tests.length).toBe(0)
        })

        it('should filter by describe using describe option', () => {
          const tests = getTarget(environment, undefined, { ...emptyOptions, describe: 'second describe' })
          expect(tests.length).toBe(2)
          expect(tests[0].name).toBe('"second test"')
          expect(tests[1].name).toBe('"another second test"')
        })

        it('should filter by describe & test using describe & test option', () => {
          const tests = getTarget(environment, undefined, { ...emptyOptions, describe: 'second describe', test: 'another second test' })
          expect(tests.length).toBe(1)
          expect(tests[0].name).toBe('"another second test"')
        })

        it('should filter by file using file option', () => {
          const tests = getTarget(environment, undefined, { ...emptyOptions, file: 'test-one.wtest' })
          expect(tests.length).toBe(3)
          expect(tests[0].name).toBe('"a test"')
          expect(tests[1].name).toBe('"another test"')
          expect(tests[2].name).toBe('"another test with longer name"')
        })

        it('should filter by file & describe using file & describe option', () => {
          const tests = getTarget(environment, undefined, { ...emptyOptions, file: 'test-one.wtest', describe: 'this describe' })
          expect(tests.length).toBe(3)
          expect(tests[0].name).toBe('"a test"')
          expect(tests[1].name).toBe('"another test"')
          expect(tests[2].name).toBe('"another test with longer name"')
        })

        it('should filter by file & describe & test using file & describe & test option', () => {
          const tests = getTarget(environment, undefined, { ...emptyOptions, file: 'test-one.wtest', describe: 'this describe', test: 'another test' })
          expect(tests.length).toBe(1)
          expect(tests[0].name).toBe('"another test"')
        })
      })
    })

    describe('only case', () => {
      const projectPath = join('examples', 'test-examples', 'only-case')
      const emptyOptions = { project: projectPath, skipValidations: false, file: undefined, describe: undefined, test: undefined }

      beforeEach(async () => {
        environment = await buildEnvironmentForProject(projectPath)
      })

      it('should execute single test when running a describe using filter option', () => {
        const tests = getTarget(environment, 'only describe', emptyOptions)
        expect(tests.length).toBe(1)
        expect(tests[0].name).toBe('"this is the one"')
      })

      it('should execute single test when running a describe using file option', () => {
        const tests = getTarget(environment, undefined, { ...emptyOptions, describe: 'only describe' })
        expect(tests.length).toBe(1)
        expect(tests[0].name).toBe('"this is the one"')
      })

      it('should execute single test when running a file using filter option', () => {
        const tests = getTarget(environment, 'only-file', emptyOptions)
        expect(tests.length).toBe(1)
        expect(tests[0].name).toBe('"this is the one"')
      })

      it('should execute single test when running a file using file option', () => {
        const tests = getTarget(environment, undefined, { ...emptyOptions, file: 'only-file.wtest' })
        expect(tests.length).toBe(1)
        expect(tests[0].name).toBe('"this is the one"')
      })
    })
  })

  describe('sanitize', () => {
    it('should remove double quotes from value', () => {
      expect(sanitize('"some test"')).toBe('some test')
    })

    it('should leave undefined values as is', () => {
      expect(sanitize(undefined)).toBeUndefined()
    })
  })

  describe('validateParameters', () => {
    const emptyOptions = { skipValidations: false, project: '', file: undefined, describe: undefined, test: undefined }

    it('should pass if no filter and no options passed', () => {
      expect(() => validateParameters(undefined, emptyOptions)).not.toThrow()
    })

    it('should pass if filter is passed and no options is passed', () => {
      expect(() => validateParameters('some test', emptyOptions)).not.toThrow()
    })

    it('should pass if options is passed and no filter is passed', () => {
      expect(() => validateParameters(undefined, { ...emptyOptions, test: 'some test' })).not.toThrow()
    })

    it('should fail if filter and options are passed', () => {
      expect(() => validateParameters('some describe', { ...emptyOptions, test: 'some test' })).toThrow(/You should either use filter by full name or file/)
    })
  })

  describe('matching test description', () => {
    const emptyOptions = { project: '', skipValidations: false, file: undefined, describe: undefined, test: undefined }

    it('should return empty string if no filter or options are passed', () => {
      expect(matchingTestDescription(undefined, emptyOptions)).toBe('')
    })

    it('should return filter description if filter is passed', () => {
      expect(matchingTestDescription('some test', emptyOptions)).toContain('some test')
    })

    it('should return options descriptions if options are passed', () => {
      expect(matchingTestDescription(undefined, { ...emptyOptions, file: 'test-one.wtest', describe: 'this describe', test: 'another test' }))
        .toContain('\'test-one.wtest\'.\'this describe\'.\'another test\'')
    })

    it('should return options descriptions with wildcards if options are missing', () => {
      expect(matchingTestDescription(undefined, { ...emptyOptions, file: undefined, describe: 'this discribe', test: undefined }))
        .toContain('*.\'this discribe\'.*')
    })
  })

  describe('tabulations for node', () => {
    it('should work for root package', () => {
      expect(tabulationForNode({ fullyQualifiedName: 'root' })).toBe('')
    })

    it('should work for fqn level', () => {
      expect(tabulationForNode({ fullyQualifiedName: 'aves.otros.pepita' })).toBe('    ')
    })
  })

  describe('smoke test for test default function', () => {

    let processExitSpy: MockInstance<(code?: number) => never>
    let fileLoggerInfoSpy: MockInstance<LeveledLogMethod>
    let loggerInfoSpy: MockInstance<(...args: any[]) => any>
    let loggerErrorSpy: MockInstance<(...args: any[]) => any>

    const projectPath = join('examples', 'test-examples', 'normal-case')
    const emptyOptions = { project: projectPath, skipValidations: true, file: undefined, describe: undefined, test: undefined }

    beforeEach(() => {
      loggerInfoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {})
      loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
      fileLoggerInfoSpy = vi.spyOn(fileLogger, 'info')
        .mockImplementation(((_message: string, ..._meta: any[]) => fileLogger as any) as LeveledLogMethod)
      processExitSpy = vi.spyOn(process, 'exit').mockImplementation(((_code?: string | number | null | undefined) => {}) as (code?: string | number | null | undefined) => never)
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('passes all the tests successfully and exits normally', async () => {
      await test(undefined, { ...emptyOptions, file: 'test-one.wtest' })
      expect(processExitSpy).toHaveBeenCalledTimes(0)
      expect(spyCalledWithSubstring(loggerInfoSpy, 'Running 3 tests')).toBe(true)
      expect(spyCalledWithSubstring(loggerInfoSpy, '3 passed')).toBe(true)
      expect(spyCalledWithSubstring(loggerInfoSpy, '0 failed')).toBe(false)
      expect(spyCalledWithSubstring(loggerInfoSpy, '0 errored')).toBe(false)
      expect(fileLoggerInfoSpy).toHaveBeenCalledOnce()
      const fileLoggerArg = fileLoggerInfoSpy.mock.calls[0][0] as any
      expect(fileLoggerArg.result).toEqual({ ok: 3, failed: 0, errored: 0 })
    })

    it('passing a wrong filename runs no tests and logs a warning', async () => {
      await test(undefined, { ...emptyOptions, file: 'non-existing-file.wtest' })
      expect(processExitSpy).toHaveBeenCalledTimes(0)
      expect(spyCalledWithSubstring(loggerInfoSpy, 'Running 0 tests')).toBe(true)
      expect(spyCalledWithSubstring(loggerErrorSpy, 'File \'non-existing-file.wtest\' not found')).toBe(true)
    })

    it('passing a wrong describe runs no tests and logs a warning', async () => {
      await test(undefined, { ...emptyOptions, file: 'test-one.wtest', describe: 'non-existing-describe' })
      expect(processExitSpy).toHaveBeenCalledTimes(0)
      expect(spyCalledWithSubstring(loggerInfoSpy, 'Running 0 tests')).toBe(true)
      expect(spyCalledWithSubstring(loggerErrorSpy, 'Describe \'non-existing-describe\' not found')).toBe(true)
    })

    it('returns exit code 2 if one or more tests fail or have errors', async () => {
      await test(undefined, emptyOptions)
      expect(processExitSpy).toHaveBeenCalledWith(2)
      expect(spyCalledWithSubstring(loggerInfoSpy, 'Running 7 tests')).toBe(true)
      expect(spyCalledWithSubstring(loggerInfoSpy, '4 passed')).toBe(true)
      expect(spyCalledWithSubstring(loggerInfoSpy, '2 failed')).toBe(true)
      expect(spyCalledWithSubstring(loggerInfoSpy, '1 errored')).toBe(true)
      expect(fileLoggerInfoSpy).toHaveBeenCalledOnce()
      const fileLoggerArg = fileLoggerInfoSpy.mock.calls[0][0] as any
      expect(fileLoggerArg.result).toEqual({ ok: 4, failed: 2, errored: 1 })
      expect(fileLoggerArg.testsFailed.length).toBe(3)
    })

    it('returns exit code 2 if one or more tests fail', async () => {
      await test(undefined, { ...emptyOptions, file: 'test-two.wtest', describe: 'third describe', test: 'just a test' })
      expect(processExitSpy).toHaveBeenCalledWith(2)
      expect(spyCalledWithSubstring(loggerInfoSpy, 'Running 1 test')).toBe(true)
      expect(spyCalledWithSubstring(loggerInfoSpy, '0 passed')).toBe(true)
      expect(spyCalledWithSubstring(loggerInfoSpy, '1 failed')).toBe(true)
      expect(spyCalledWithSubstring(loggerInfoSpy, '0 errored')).toBe(false)
      expect(fileLoggerInfoSpy).toHaveBeenCalledOnce()
      const fileLoggerArg = fileLoggerInfoSpy.mock.calls[0][0] as any
      expect(fileLoggerArg.result).toEqual({ ok: 0, failed: 1, errored: 0 })
      expect(fileLoggerArg.testsFailed.length).toBe(1)
    })

    it('returns exit code 2 if one or more tests have errors', async () => {
      await test(undefined, { ...emptyOptions, file: 'test-two.wtest', describe: 'second describe', test: 'second test' })
      expect(processExitSpy).toHaveBeenCalledWith(2)
      expect(spyCalledWithSubstring(loggerInfoSpy, 'Running 1 test')).toBe(true)
      expect(spyCalledWithSubstring(loggerInfoSpy, '0 passed')).toBe(true)
      expect(spyCalledWithSubstring(loggerInfoSpy, '0 failed')).toBe(false)
      expect(spyCalledWithSubstring(loggerInfoSpy, '1 errored')).toBe(true)
      expect(fileLoggerInfoSpy).toHaveBeenCalledOnce()
      const fileLoggerArg = fileLoggerInfoSpy.mock.calls[0][0] as any
      expect(fileLoggerArg.result).toEqual({ ok: 0, failed: 0, errored: 1 })
      expect(fileLoggerArg.testsFailed.length).toBe(1)
    })

    it('returns exit code 1 if tests has parse errors', async () => {
      await test(undefined, { ...emptyOptions, skipValidations: false, project: join('examples', 'test-examples', 'failing-case') })
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })
})