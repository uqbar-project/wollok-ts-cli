import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import { join } from 'path'
import ast from '../src/commands/ast.js'
import { spyCalledWithSubstring } from './assertions.js'
import logger from 'loglevel'

const projectPath = join('examples', 'ast-examples')

describe('ast', () => {

  let processExitSpy: MockInstance<(code?: number) => never>
  let consoleLogSpy: MockInstance<(message?: any, ...optionalParams: any[]) => void>

  beforeEach(() => {
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: number) => undefined as never)
    consoleLogSpy = vi.spyOn(logger, 'info').mockImplementation((_info: string) => {
    })
  })

  it('returns ast as json for project', async () => {
    await ast({ project: projectPath + '/ok-project', entityFQN: 'example' })
    expect(processExitSpy).toHaveBeenCalledWith(0)
    expect(spyCalledWithSubstring(consoleLogSpy, '"name": "example"')).toBe(true)
    expect(spyCalledWithSubstring(consoleLogSpy, '"name": "Animal"')).toBe(true)
    expect(spyCalledWithSubstring(consoleLogSpy, '"name": "pepita"')).toBe(true)
  })

  it('if entity is provided, it filters ast correctly', async () => {
    await ast({ project: projectPath + '/ok-project', entityFQN: 'example.Animal' })
    expect(processExitSpy).toHaveBeenCalledWith(0)
    expect(spyCalledWithSubstring(consoleLogSpy, '"name": "Animal"')).toBe(true)
    expect(spyCalledWithSubstring(consoleLogSpy, '"name": "pepita"')).toBe(false)
  })

  it('if no file and not entity is provided, it returns all the nodes from the project', async () => {
    await ast({ project: projectPath + '/ok-project' })
    expect(processExitSpy).toHaveBeenCalledWith(0)
    expect(spyCalledWithSubstring(consoleLogSpy, '"name": "example"')).toBe(true)
    expect(spyCalledWithSubstring(consoleLogSpy, '"name": "Animal"')).toBe(true)
    expect(spyCalledWithSubstring(consoleLogSpy, '"name": "pepita"')).toBe(true)
    expect(spyCalledWithSubstring(consoleLogSpy, '"name": "Extra"')).toBe(true)
  })

  it('if no project is provided, it returns an error', async () => {
    await ast({ project: '' })
    expect(processExitSpy).toHaveBeenCalledWith(1)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })
})