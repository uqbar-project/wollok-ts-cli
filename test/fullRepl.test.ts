import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import { join } from 'path'
import { Interface } from 'readline'
import { Server } from 'socket.io'
import * as wollok from 'wollok-ts'
import { Options, replFn } from '../src/commands/repl.js'
import { ENTER } from '../src/utils.js'
import { spyCalledWithSubstring } from './assertions.js'
import { fakeIO } from './mocks.js'
import * as gameModule from '../src/game.js'

const baseOptions = {
  darkMode: true,
  port: '8080',
  host: 'localhost',
  skipDiagram: true,
  assets: '',
}

const buildOptionsFor = (path: string, skipValidations = false) => ({
  ...baseOptions,
  project: join('examples', 'bad-files-examples', path),
  skipValidations,
})

const startReplCommand = (autoImportPath: string, options: Options) =>
  replFn(join(options.project, autoImportPath), options)

describe('REPL command', () => {
  const projectPath = join('examples', 'repl-examples')

  const options = {
    project: projectPath,
    skipValidations: false,
    ...baseOptions,
  }
  let processExitSpy: MockInstance<(code?: number) => never>
  let consoleLogSpy: MockInstance<(message?: any, ...optionalParams: any[]) => void>
  let initializeGameClientSpy: MockInstance<(project: string, assets: string, host: string, port: string) => Server>
  let repl: Interface
  let io: Server

  beforeEach(async () => {
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    io = fakeIO()
    initializeGameClientSpy = vi.spyOn(gameModule, 'initializeGameClient').mockReturnValue(io)
    repl = await replFn(undefined, options)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    repl.close()
    io.close()
  })

  it('should process values & quit successfully', async () => {
    repl.write('const a = 1' + ENTER)
    repl.write('const b = a + 5' + ENTER)
    repl.write('b' + ENTER)
    expect(spyCalledWithSubstring(consoleLogSpy, '6')).toBe(true)
    repl.emit('line', ':q')
    expect(processExitSpy).toHaveBeenCalledWith(0)
  })

  it('should init game server', async () => {
    expect(initializeGameClientSpy).not.toHaveBeenCalled()
    repl.write('game.start()' + ENTER)
    expect(spyCalledWithSubstring(consoleLogSpy, 'true')).toBe(true)
    expect(initializeGameClientSpy).toHaveBeenCalled()
  })

  it('should quit successfully if project has validation errors but skip validation config is passed', async () => {
    const repl = await startReplCommand('fileWithValidationErrors.wlk', buildOptionsFor('validation-errors', true))
    repl.emit('line', ':q')
    expect(processExitSpy).toHaveBeenCalledWith(0)
    repl.close()
  })
})

describe('REPL command - invalid project', () => {
  beforeEach(async () => {
    vi.spyOn(process, 'exit').mockImplementation((code?: number | undefined) => {
      throw new Error(code && code > 0 ? `exit with ${code} error code` : 'ok')
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return exit code 12 if project has parse errors', async () => {
    vi.spyOn(wollok, 'buildEnvironment').mockImplementation(() => {
      throw new Error('Failed to parse fileWithParseErrors.wlk')
    })

    await expect(startReplCommand('fileWithParseErrors.wlk', buildOptionsFor('parse-errors'))).rejects.toThrow('exit with 12 error code')
  })

  it('should return exit code 12 if project has validation errors', async () => {
    await expect(startReplCommand('fileWithValidationErrors.wlk', buildOptionsFor('validation-errors'))).rejects.toThrow('exit with 12 error code')
  })

  it('should return exit code 12 if file does not exist - no validation', async () => {
    await expect(startReplCommand('noFile.wlk', buildOptionsFor('validation-errors', true))).rejects.toThrow('exit with 12 error code')
  })

  it('should return exit code 12 if file does not exist - with validation', async () => {
    await expect(startReplCommand('noFile.wlk', buildOptionsFor('missing-files'))).rejects.toThrow('exit with 12 error code')
  })
})