import { mkdirSync, rmdirSync } from 'fs'
import logger from 'loglevel'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { LeveledLogMethod } from 'winston'
import { interpret } from 'wollok-ts'
import run, { type Options } from '../src/commands/run.js'
import { getVisuals } from '../src/game.js'
import { logger as fileLogger } from '../src/logger.js'
import * as utils from '../src/utils.js'
import { buildEnvironmentCommand, getAllAssets, getAssetsFolder, getSoundsFolder, readNatives } from '../src/utils.js'
import { spyCalledWithSubstring } from './assertions.js'
import { connectClient, exitMock, handleErrorMock, received } from './mocks.js'

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
      expect(getAllAssets(project, 'assets')).toEqual([{ name: join('pepita.png'), url: join('pepita.png') }])
    })

    it('should return all images relative to assets folder (recursively)', () => {
      expect(getAllAssets(imageProject, 'assets')).toEqual([
        { name: join('medium', '3.png'), url: join('medium', '3.png') },
        { name: join('smalls', '1.png'), url: join('smalls', '1.png') },
        { name: join('smalls', '2.png'), url: join('smalls', '2.png') },
      ])
    })

    it('should return all images relative to project if assets folder is not present', () => {
      expect(getAllAssets(imageProject, '')).toEqual([
        { name: join('assets', 'medium', '3.png'), url: join('assets', 'medium', '3.png') },
        { name: join('assets', 'smalls', '1.png'), url: join('assets', 'smalls', '1.png') },
        { name: join('assets', 'smalls', '2.png'), url: join('assets', 'smalls', '2.png') },
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
      processExitSpy = exitMock()
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
      fileLoggerInfoSpy = vi.spyOn(fileLogger, 'info').mockImplementation(((_message: string, ..._meta: any[]) => fileLogger as any) as LeveledLogMethod)
      consoleLoggerInfoSpy = vi.spyOn(logger, 'info').mockImplementation(() => { })
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
    let processExitSpy: MockInstance<(code?: number) => never>
    let errorReturned: string | undefined

    beforeEach(async () => {
      handleErrorMock((error: Error) => {
        errorReturned = error.message
      })
      processExitSpy = exitMock()
    })

    afterEach(() => {
      errorReturned = undefined
      vi.restoreAllMocks()
    })

    let defaultPort = 3000 // Avoid conflicts
    async function runProgram(project: string, port?: number) {
      await run('mainGame.PepitaGame', {
        project: join('examples', 'run-examples', project),
        skipValidations: false,
        startDiagram: false,
        assets: 'specialAssets',
        port: `${port ?? defaultPort++}`,
        host: 'localhost',
      })
    }

    it('should work if program has no errors', async () => {
      await runProgram('basic-game')
      expect(processExitSpy).not.toHaveBeenCalledWith(0)
      expect(errorReturned).toBeUndefined()
    })

    it('should send static information and start', async () => {
      const clientSocket = connectClient(8787)
      const [, board, images, music] = await Promise.all([
        runProgram('basic-game', 8787),
        received(clientSocket, 'board'),
        received(clientSocket, 'images'),
        received(clientSocket, 'music'),
        received(clientSocket, 'start')])

      expect(board).be.eql({ cellSize: 50, ground: 'ground.png', width: 5, height: 5 })
      expect(images).be.eql([{ name: 'pepita.png', url: 'pepita.png' }])
      expect(music).be.eql([])
    }, { timeout: 2 * 5000, retry: 2 })

    it('should not work if assets folder does not exist', async () => {
      await runProgram('basic-example')
      expect(processExitSpy).not.toHaveBeenCalledWith(21)
      expect(errorReturned?.split('\n')[0]).toBe(
        'Folder image examples/run-examples/basic-example/specialAssets does not exist'
      )
    })
  })
})