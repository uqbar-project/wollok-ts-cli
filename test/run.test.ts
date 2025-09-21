import { mkdirSync, rmdirSync } from 'fs'
import logger from 'loglevel'
import { join } from 'path'
import { Server } from 'socket.io'
import { interpret } from 'wollok-ts'
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import run, { type Options } from '../src/commands/run.js'
import { getVisuals } from '../src/game.js'
import { logger as fileLogger } from '../src/logger.js'
import * as utils from '../src/utils.js'
import { buildEnvironmentCommand, getAllAssets, getAssetsFolder, getSoundsFolder, readNatives } from '../src/utils.js'
import { spyCalledWithSubstring } from './assertions.js'
import { fakeIO } from './mocks.js'
import { LeveledLogMethod } from 'winston'

const project = join('examples', 'run-examples', 'basic-example')
const proj = new utils.Project(project)
const assets = 'assets'

describe('testing run', () => {
  const buildOptions = (assets: string): Options => ({
    project,
    assets,
    skipValidations: false,
    startDiagram: false,
    host: 'localhost',
    port: '3000',
  })

  describe('getAssetsPath', () => {
    it('should return assets folder from asset options if passed', () => {
      expect(getAssetsFolder(proj, 'myAssets')).toBe('myAssets')
    })

    it('should return assets folder from project if asset option is empty', () => {
      expect(getAssetsFolder(proj, '')).toBe('specialAssets')
    })

    it('should return assets folder from package if it exists', () => {
      expect(
        getAssetsFolder(new utils.Project(join('examples', 'run-examples', 'no-asset-folder-example')), '')
      ).toBe('')
    })
  })

  describe('getSoundsFolder - project with sounds folder', () => {
    beforeEach(() => {
      mkdirSync(join(project, 'sounds'))
    })

    it('should return sounds folder from if it exists', () => {
      expect(getSoundsFolder(project, 'assets')).toBe('sounds')
    })

    afterEach(() => {
      rmdirSync(join(project, 'sounds'))
    })
  })

  describe('getSoundsFolder - project without sounds folder', () => {
    it('should return assets option folder if present', () => {
      expect(getSoundsFolder(project, 'myAssets')).toBe('myAssets')
    })
  })

  describe('getVisuals', () => {
    it('should return all visuals for a simple project', async () => {
      const imageProject = join('examples', 'run-examples', 'asset-example')

      const options = {
        ...buildOptions('assets'),
        project: imageProject,
      }

      const environment = await buildEnvironmentCommand(imageProject)
      const interpreter = interpret(environment, await readNatives(options.project))
      const game = interpreter.object('wollok.game.game')
      interpreter.send('addVisual', game, interpreter.object('mainGame.elementoVisual'))

      expect(getVisuals(game, interpreter)).toEqual([
        {
          image: 'smalls/1.png',
          position: { x: 0, y: 1 },
          message: undefined,
          messageTime: undefined,
          text: undefined,
          textColor: undefined,
        },
      ])
    })
  })

  describe('getImages - project with several folders', () => {
    const imageProject = join('examples', 'run-examples', 'asset-example')

    it('should return all images for a single assets folder', () => {
      expect(getAllAssets(project, 'assets')).toEqual([{ name: join('pepita.png'), url: join('assets', 'pepita.png') }])
    })

    it('should return all images in assets folder recursively', () => {
      expect(getAllAssets(imageProject, 'assets')).toEqual([
        { name: join('3.png'), url: join('assets', 'medium', '3.png') },
        { name: join('1.png'), url: join('assets', 'smalls', '1.png') },
        { name: join('2.png'), url: join('assets', 'smalls', '2.png') },
      ])
    })

    it('should return all images even if assets folder is not present', () => {
      expect(getAllAssets(imageProject, '')).toEqual([
        { name: join('3.png'), url: join('assets', 'medium', '3.png') },
        { name: join('1.png'), url: join('assets', 'smalls', '1.png') },
        { name: join('2.png'), url: join('assets', 'smalls', '2.png') },
      ])
    })

    it('should throw error for unexistent folder', () => {
      expect(() => {
        getAllAssets(imageProject, 'unexistentFolder')
      }).toThrow(/does not exist/)
    })
  })

  describe('run a simple program', () => {
    let processExitSpy: MockInstance<(code?: number) => never>
    let consoleLogSpy: MockInstance<(message?: any, ...optional: any[]) => void>
    let fileLoggerInfoSpy: MockInstance<(message?: any, ...optional: any[]) => void>
    let consoleLoggerInfoSpy: MockInstance<(message?: any, ...optional: any[]) => void>

    beforeEach(() => {
      processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      fileLoggerInfoSpy = vi.spyOn(fileLogger, 'info').mockImplementation(((_message: string, ..._meta: any[]) => fileLogger as any) as LeveledLogMethod)
      consoleLoggerInfoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should work if program has no errors', async () => {
      await run('mainExample.PepitaProgram', {
        project: join('examples', 'run-examples', 'basic-example'),
        skipValidations: false,
        startDiagram: false,
        assets,
        host: 'localhost',
        port: '3000',
      })
      expect(spyCalledWithSubstring(consoleLogSpy, 'Pepita empieza con 70')).toBe(true)
      expect(spyCalledWithSubstring(consoleLogSpy, 'Vuela')).toBe(true)
      expect(spyCalledWithSubstring(consoleLogSpy, '40')).toBe(true)
      expect(spyCalledWithSubstring(consoleLogSpy, 'Come')).toBe(true)
      expect(spyCalledWithSubstring(consoleLogSpy, '290')).toBe(true)
      expect(processExitSpy).toHaveBeenCalledWith(0)
      expect(fileLoggerInfoSpy).toHaveBeenCalledTimes(1)
      const fileLoggerArg = fileLoggerInfoSpy.mock.calls[0][0]
      expect(fileLoggerArg.ok).toBe(true)
      expect(fileLoggerArg.message).toContain('Program executed')
      expect(spyCalledWithSubstring(consoleLoggerInfoSpy, 'finalized successfully')).toBe(true)
    })

    it('should exit if program has errors', async () => {
      await run('mainExample.PepitaProgram', {
        project: join('examples', 'run-examples', 'bad-example'),
        skipValidations: false,
        startDiagram: false,
        assets,
        host: 'localhost',
        port: '3000',
      })
      expect(processExitSpy).toHaveBeenCalledWith(21)
      expect(fileLoggerInfoSpy).toHaveBeenCalledTimes(1)
      const fileLoggerArg = fileLoggerInfoSpy.mock.calls[0][0]
      expect(fileLoggerArg.ok).toBe(false)
      expect(fileLoggerArg.error).toBeTruthy()
    })
  })

  describe('run a simple game', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let handleErrorSpy: MockInstance<(error: Error) => void>
    let processExitSpy: MockInstance<(code?: number) => never>
    let errorReturned: string | undefined
    let io: Server

    beforeEach(async () => {
      errorReturned = undefined
      handleErrorSpy = vi.spyOn(utils, 'handleError').mockImplementation((error: Error) => {
        console.info(`👾👾👾 ${error.message} 👾👾👾`)
        errorReturned = error.message
      })
      processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      io = fakeIO()
      vi.spyOn(await import('../src/game.js'), 'initializeGameClient').mockReturnValue(io)
    })

    afterEach(() => {
      vi.restoreAllMocks()
      io.close()
    })

    it('smoke test - should work if program has no errors', async () => {
      await run('mainGame.PepitaGame', {
        project: join('examples', 'run-examples', 'basic-game'),
        skipValidations: false,
        startDiagram: false,
        assets: 'specialAssets',
        port: '3000',
        host: 'localhost',
      })
      expect(processExitSpy).not.toHaveBeenCalledWith(0)
      expect(errorReturned).toBeUndefined()
    })

    it('smoke test - should not work if program has errors', async () => {
      await run('mainGame.PepitaGame', {
        project: join('examples', 'run-examples', 'basic-example'),
        skipValidations: false,
        startDiagram: false,
        assets: 'specialAssets',
        port: '3000',
        host: 'localhost',
      })
      expect(processExitSpy).not.toHaveBeenCalledWith(21)
      expect(errorReturned?.split('\n')[0]).toBe(
        'Folder image examples/run-examples/basic-example/specialAssets does not exist'
      )
    })
  })
})