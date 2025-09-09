import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import { join } from 'path'
import lint from '../src/commands/lint.js'
import { spyCalledWithSubstring } from './assertions.js'
import logger from 'loglevel'

const projectPath = join('examples', 'lint-examples')

describe('lint', () => {

  let processExitSpy: MockInstance<(code?: number) => never>
  let consoleLogSpy: MockInstance<(message?: any, ...optionalParams: any[]) => void>

  beforeEach(() => {
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    consoleLogSpy = vi.spyOn(logger, 'info').mockImplementation(() => {})
  })

  it('ok project does not find errors or warnings', async () => {
    await lint({ project: projectPath + '/ok-project' })
    expect(processExitSpy).toHaveBeenCalledWith(0)
    expect(spyCalledWithSubstring(consoleLogSpy, 'No errors or warnings found!')).toBe(true)
  })

  it('failed project finds errors and warnings', async () => {
    await lint({ project: projectPath + '/error-project' })
    expect(processExitSpy).toHaveBeenCalledWith(2)
    expect(spyCalledWithSubstring(consoleLogSpy, '1 Error')).toBe(true)
    expect(spyCalledWithSubstring(consoleLogSpy, '1 Warning')).toBe(true)
  })

  it('project with several errors finds errors and warnings', async () => {
    await lint({ project: projectPath + '/several-errors-project' })
    expect(processExitSpy).toHaveBeenCalledWith(2)
    expect(spyCalledWithSubstring(consoleLogSpy, '2 Errors')).toBe(true)
    expect(spyCalledWithSubstring(consoleLogSpy, '3 Warnings')).toBe(true)
  })

  it('filtering by file finds errors and warnings', async () => {
    await lint({ project: projectPath + '/error-project', entityFQN: 'testExample' })
    expect(processExitSpy).toHaveBeenCalledWith(2)
    expect(spyCalledWithSubstring(consoleLogSpy, '1 Error')).toBe(true)
    expect(spyCalledWithSubstring(consoleLogSpy, '0 Warnings')).toBe(true)
  })

  it('filtering by file finds errors and warnings', async () => {
    await lint({ project: projectPath + '/error-project', entityFQN: 'example' })
    expect(processExitSpy).toHaveBeenCalledWith(2)
    expect(spyCalledWithSubstring(consoleLogSpy, '1 Warning')).toBe(true)
    expect(spyCalledWithSubstring(consoleLogSpy, '0 Errors')).toBe(true)
  })

  it('filtering by unexistent entity return error exit code', async () => {
    await lint({ project: projectPath + '/error-project', entityFQN: 'nonExistentEntity' })
    expect(processExitSpy).toHaveBeenCalledWith(1)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })
})