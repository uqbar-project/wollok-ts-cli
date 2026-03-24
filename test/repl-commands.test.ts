import logger from 'loglevel'
import { join } from 'path'
import { Interface } from 'readline'
import { Server } from 'socket.io'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import * as wollok from 'wollok-ts'
import { Options, replFn } from '../src/commands/repl.js'
import * as gameModule from '../src/game.js'
import { ENTER } from '../src/utils.js'
import { expectCalledWithSubstrings, spyCalledWithSubstring } from './assertions.js'
import { fakeIO } from './mocks.js'

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

const projectPath = join('examples', 'repl-examples')

const options = {
  project: projectPath,
  skipValidations: false,
  ...baseOptions,
}

describe('REPL command', () => {
  let processExitSpy: MockInstance<(code?: string | number | null | undefined) => never>
  let consoleLogSpy: MockInstance<(message?: any, ...optionalParams: any[]) => void>
  let loggerLogSpy: MockInstance<(message?: any) => void>
  let promptSpy: MockInstance<(message?: any) => void>
  let initializeGameClientSpy: MockInstance<(project: string, assets: string, host: string, port: string) => Server>
  let repl: Interface
  let io: Server

  beforeEach(async () => {
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { }) as any)
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { }) // TODO: Should we use always the logger?
    loggerLogSpy = vi.spyOn(logger, 'info').mockImplementation(() => { })
    promptSpy = vi.spyOn(Interface.prototype, 'prompt').mockImplementation(() => { })
    initializeGameClientSpy = vi.spyOn(gameModule, 'initializeGameClient')
    io = fakeIO()
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
    expect(promptSpy).toBeCalledTimes(4)
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

  describe('Prompt should be printed', () => {

    it('on start up', async () => {
      expect(promptSpy).toBeCalledTimes(1)
    })

    it('on start up (with dynamic diagram)', async () => {
      promptSpy.mockReset()
      const repl = await replFn(undefined, { ...options, skipDiagram: false })
      expect(promptSpy).toBeCalledTimes(1)
      repl.close()
    })

    it('after a query', () => {
      expect(promptSpy).toBeCalledTimes(1)
      repl.write('1 + 2' + ENTER)
      expect(promptSpy).toBeCalledTimes(2)
    })

    it('after restart', async () => {
      expect(promptSpy).toBeCalledTimes(1)
      repl.emit('line', ':r')
      await vi.waitFor(() => expect(promptSpy).toBeCalledTimes(2))
    })

    it('after restart (with dynamic diagram)', async () => {
      promptSpy.mockReset()
      const repl = await replFn(undefined, { ...options, skipDiagram: false })
      expect(promptSpy).toBeCalledTimes(1)
      repl.emit('line', ':r')
      await vi.waitFor(() => expectCalledWithSubstrings(loggerLogSpy,
        'Dynamic diagram available at: http://localhost:8080',
      ))
      expect(promptSpy).toBeCalledTimes(1)
      await vi.waitFor(() => expect(promptSpy).toBeCalledTimes(2))
      repl.close()
    })

    it('after restart and reload', async () => {
      repl.write('1 + 2' + ENTER)
      promptSpy.mockReset()
      repl.emit('line', ':rr')
      await vi.waitFor(() => expect(promptSpy).toBeCalledTimes(2))
    })

  })

  describe('Logs', () => {

    it('on start up', () => {
      expectCalledWithSubstrings(loggerLogSpy,
        'Initializing Wollok REPL on examples/repl-examples',
        'No problems found building the environment',
        'No errors or warnings found')
    })

    it('on start up (with file)', async () => {
      loggerLogSpy.mockReset()
      const repl = await startReplCommand('aves.wlk', options)
      expectCalledWithSubstrings(loggerLogSpy,
        'Initializing Wollok REPL for file examples/repl-examples/aves.wlk on examples/repl-examples',
        'No problems found building the environment',
        'No errors or warnings found')
      repl.close()
    })

    it('on start up (with dynamic diagram)', async () => {
      loggerLogSpy.mockReset()
      const repl = await replFn(undefined, { ...options, skipDiagram: false })
      expectCalledWithSubstrings(loggerLogSpy,
        'Initializing Wollok REPL on examples/repl-examples',
        'No problems found building the environment',
        'No errors or warnings found',
        'Dynamic diagram available at: http://localhost:8080')
      repl.close()
    })

    it('on reload', async () => {
      repl.emit('line', ':r')
      await vi.waitFor(() => expect(loggerLogSpy).toHaveBeenCalledWith('✓ Environment reloaded'))
      expectCalledWithSubstrings(loggerLogSpy,
        'No problems found building the environment',
        'No errors or warnings found',
        'Environment reloaded',
      )
      expect(spyCalledWithSubstring(loggerLogSpy, 'Dynamic diagram')).toBe(false)
    })

    it('on reload (with dynamic diagram)', async () => {
      loggerLogSpy.mockReset()
      const repl = await replFn(undefined, { ...options, skipDiagram: false })
      repl.emit('line', ':r')
      await vi.waitFor(() => expect(loggerLogSpy).toHaveBeenCalledWith('✓ Environment reloaded'))
      expectCalledWithSubstrings(loggerLogSpy,
        'No problems found building the environment',
        'No errors or warnings found',
        'Dynamic diagram available at: http://localhost:8080',
        'Environment reloaded',
      )
      repl.close()
    })

  })
})

describe('REPL command - invalid project', () => {
  beforeEach(async () => {
    vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null | undefined) => {
      throw new Error(code && Number(code) > 0 ? `exit with ${code} error code` : 'ok')
    }) as (code?: string | number | null | undefined) => never)
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