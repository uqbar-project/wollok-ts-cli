import chalk from 'chalk'
import logger from 'loglevel'
import path, { join } from 'path'
import { buildEnvironmentForProject, failureDescription, getFQN, handleError, problemDescription, validateEnvironment, Project, validateName, ValidationAction } from '../src/utils.js'
import { spyCalledWithSubstring } from './assertions.js'
import { Problem, WOLLOK_EXTRA_STACK_TRACE_HEADER, validate, List } from 'wollok-ts'
import * as wollok from 'wollok-ts'
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import type { MockInstance } from 'vitest'

const { bold, red, yellowBright } = chalk

describe('build & validating environment', () => {

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let buildEnvironmentSpy: MockInstance<(...args: any[]) => any>

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const badProjectPath = join('examples', 'bad-files-examples')

  it('should throw an exception if parsing fails', async () => {
    buildEnvironmentSpy = vi.spyOn(wollok, 'buildEnvironment').mockImplementation(() => { throw new Error('Failed to parse fileWithParseErrors.wlk') })
    await expect(buildEnvironmentForProject(join(badProjectPath, 'parse-errors'), ['fileWithParseErrors.wlk'])).rejects.toThrow(/Failed to parse fileWithParseErrors.wlk/)
  })

  it('should return all problems if validation fails', async () => {
    const environment = await buildEnvironmentForProject(join(badProjectPath, 'validation-errors'), ['fileWithValidationErrors.wlk'])
    expect(validateEnvironment(environment, ValidationAction.RETURN_ERRORS).length).toBe(1)
  })

  it('should throw an exception if validation fails', async () => {
    const environment = await buildEnvironmentForProject(join(badProjectPath, 'validation-errors'), ['fileWithValidationErrors.wlk'])
    expect(() => validateEnvironment(environment, ValidationAction.THROW_ON_ERRORS)).toThrow(/Fatal error while running validations/)
  })

  it('should not throw an exception if validation fails but you want to skip validation', async () => {
    const environment = await buildEnvironmentForProject(join(badProjectPath, 'validation-errors'), ['fileWithValidationErrors.wlk'])
    expect(() => validateEnvironment(environment, ValidationAction.SKIP_VALIDATION)).not.toThrow()
  })

})

describe('handle error', () => {

  let loggerErrorSpy: MockInstance<(...args: any[]) => any>

  beforeEach(() => {
    loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows error message', async () => {
    await handleError(new Error('Parse validation failed'))
    expect(spyCalledWithSubstring(loggerErrorSpy, 'Uh-oh... Unexpected Error')).toBe(true)
    expect(spyCalledWithSubstring(loggerErrorSpy, 'Parse validation failed')).toBe(true)
  })

})

describe('resources', () => {

  it('returns the right FQN for an element inside the project - using path join', () => {
    expect(getFQN(path.join('usr', 'alf', 'workspace', 'test-project'), path.join('usr', 'alf', 'workspace', 'test-project', 'example', 'aves.wlk'))).toBe('example.aves')
  })

  it('returns package.json content for a valid project', () => {
    const packageData = new Project(join('examples', 'package-examples', 'good-project')).properties
    expect(packageData.name).toBe('parcialBiblioteca')
    expect(packageData.wollokVersion).toBe('4.0.0')
  })

  it('returns empty for an invalid project (no package.json)', () => {
    const packageData = new Project(join('examples', 'package-examples', 'bad-project')).properties
    expect(packageData).toEqual({})
  })

})

describe('printing', () => {

  it('shows a failure description with a sanitized stack trace', () => {
    const somethingBadError = new Error('Something bad')
    somethingBadError.cause = undefined
    somethingBadError.stack = `at Context.<anonymous> (/home/dodain/workspace/wollok-dev/wollok-ts-cli/test/utils.test.ts:64:56)
    at callFn (/home/dodain/workspace/wollok-dev/wollok-ts-cli/node_modules/mocha/lib/runnable.js:366:21)
    \t${WOLLOK_EXTRA_STACK_TRACE_HEADER}\tat Evaluation.execThrow (/snapshot/wollok-ts-cli/node_modules/wollok-ts/dist/interpreter/runtimeModel.js:445:15)
    `
    const failure = failureDescription('Unexpected error', somethingBadError)
    expect(failure).toContain('Unexpected error')
    expect(failure).toContain('at Context.<anonymous> (/home/dodain/workspace/wollok-dev/wollok-ts-cli/test/utils.test.ts:64:56)')
    expect(failure).toContain('at callFn (/home/dodain/workspace/wollok-dev/wollok-ts-cli/node_modules/mocha/lib/runnable.js:366:21)')
    expect(failure).not.toContain(WOLLOK_EXTRA_STACK_TRACE_HEADER)
    expect(failure).not.toContain('Evaluation.execThrow')
  })

  describe('problem description', () => {

    let problems: List<Problem>

    beforeEach(async () => {
      const problemsProjectPath = join('examples', 'problems-examples')
      const environment = await buildEnvironmentForProject(problemsProjectPath, ['example.wlk'])
      problems = validate(environment)
    })

    it('shows a problem error using internationalization message', () => {
      const firstError = problems?.find(problem => problem.level === 'error') as Problem
      const problem = problemDescription(firstError)
      expect(problem).toContain(red(`${bold('[ERROR]')}: Cannot modify constants at example.wlk:5`))
    })

    it('shows a problem warning using internationalization message', () => {
      const firstError = problems?.find(problem => problem.level === 'warning') as Problem
      const problem = problemDescription(firstError)
      expect(problem).toContain(yellowBright(`${bold('[WARNING]')}: The name bird must start with uppercase at example.wlk:1`))
    })

  })

  describe('validate name', () => {
    it('passes ok with a valid name', () => {
      expect(() => validateName('valid')).not.toThrow()
    })

    it('passes ok with a valid name in camel case', () => {
      expect(() => validateName('validName')).not.toThrow()
    })

    it('passes ok with a valid name in kebab case', () => {
      expect(() => validateName('valid-name')).not.toThrow()
    })

    it('passes ok with a valid name in snake case', () => {
      expect(() => validateName('valid_name')).not.toThrow()
    })

    it('throws an error for invalid name', () => {
      expect(() => validateName('')).toThrow('Name cannot be empty')
    })

    it('throws an error for invalid name', () => {
      expect(() => validateName('invalidName!')).toThrow('Invalid name: [invalidName!]')
    })

    it('throws an error for invalid name', () => {
      expect(() => validateName('2024-o-tpiJuego')).toThrow('Invalid name: [2024-o-tpiJuego]')
    })

  })

})