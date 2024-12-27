import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiHttp from 'chai-http'
import { mkdirSync, rmdirSync } from 'fs'
import { join } from 'path'
import sinon from 'sinon'
import * as utils from '../src/utils'
import run, { buildEnvironmentForProgram, getAllAssets, getAssetsFolder, getGameInterpreter, getSoundsFolder, getVisuals, Options } from '../src/commands/run'
import { logger as fileLogger } from '../src/logger'
import { spyCalledWithSubstring } from './assertions'

chai.should()
chai.use(chaiHttp)
chai.use(chaiAsPromised)
const expect = chai.expect

const project = join('examples', 'run-examples', 'basic-example')
const assets = 'assets'

describe('testing run', () => {

  const buildOptions = (game: boolean, assets: string): Options => ({
    game,
    project,
    assets,
    skipValidations: false,
    startDiagram: false,
    host: 'localhost',
    port: '3000',
  })

  describe('getAssetsPath', () => {

    it('should return assets folder from package if it exists', () => {
      expect(getAssetsFolder(buildOptions(true, 'myAssets' /** Ignored :( */))).to.equal('specialAssets')
    })

    it('should return assets folder from package with default option', () => {
      expect(getAssetsFolder(buildOptions(true, assets))).to.equal('specialAssets')
    })

    it('should return undefined if game is not set', () => {
      expect(getAssetsFolder(buildOptions(false, 'myAssets'))).to.equal('')
    })

  })


  describe('getSoundsFolder - project with sounds folder', () => {

    beforeEach(() => {
      mkdirSync(join(project, 'sounds'))
    })

    it('should return sounds folder from if it exists', () => {
      expect(getSoundsFolder(project, 'assets')).to.equal('sounds')
    })

    afterEach(() => {
      rmdirSync(join(project, 'sounds'))
    })
  })

  describe('getSoundsFolder - project without sounds folder', () => {

    it('should return assets option folder if present', () => {
      expect(getSoundsFolder(project, 'myAssets')).to.equal('myAssets')
    })

    it('should return assets folder if assets options not sent', () => {
      expect(getSoundsFolder(project, undefined)).to.equal('assets')
    })

  })

  describe('getVisuals', () => {

    it('should return all visuals for a simple project', async () => {
      const imageProject = join('examples', 'run-examples', 'asset-example')

      const options = {
        ...buildOptions(true, 'assets'),
        project: imageProject,
      }

      const environment = await buildEnvironmentForProgram(options)
      const interpreter = getGameInterpreter(environment, await utils.readNatives(options.project))!
      const game = interpreter.object('wollok.game.game')
      interpreter.send('addVisual', game, interpreter.object('mainGame.elementoVisual'))

      // we can't use join in the image path since it's in Wollok project
      expect(getVisuals(game, interpreter)).to.deep.equal([{
        image: 'smalls/1.png',
        position: { x: 0, y: 1 },
        message: undefined,
        messageTime: undefined,
        text: undefined,
        textColor: undefined,
      }])
    })

  })

  describe('getImages - project with several folders', () => {

    const imageProject = join('examples', 'run-examples', 'asset-example')

    it('should return all images for a single assets folder', () => {
      expect(getAllAssets(project, 'assets')).to.deep.equal(
        [
          {
            'name': join('pepita.png'),
            'url': join('pepita.png'),
          },
        ]
      )
    })

    it('should return all images in assets folder recursively', () => {
      expect(getAllAssets(imageProject, 'assets')).to.deep.equal(
        [
          {
            'name': join('medium', '3.png'),
            'url': join('medium', '3.png'),
          },
          {
            'name': join('smalls', '1.png'),
            'url': join('smalls', '1.png'),
          },
          {
            'name': join('smalls', '2.png'),
            'url': join('smalls', '2.png'),
          },
        ]
      )
    })

    it('should return all images even if assets folder is not present', () => {
      expect(getAllAssets(imageProject, '')).to.deep.equal(
        [
          {
            'name': join('assets', 'medium', '3.png'),
            'url': join('assets', 'medium', '3.png'),
          },
          {
            'name': join('assets', 'smalls', '1.png'),
            'url': join('assets', 'smalls', '1.png'),
          },
          {
            'name': join('assets', 'smalls', '2.png'),
            'url': join('assets', 'smalls', '2.png'),
          },
        ]
      )
    })

    it('should throw error for unexistent folder', () => {
      expect(() => { getAllAssets(imageProject, 'unexistentFolder') }).to.throw(/does not exist/)
    })

  })

  describe('run a simple program', () => {

    let processExitSpy: sinon.SinonStub
    let consoleLogSpy: sinon.SinonStub
    let fileLoggerInfoSpy: sinon.SinonStub

    beforeEach(() => {
      processExitSpy = sinon.stub(process, 'exit')
      consoleLogSpy = sinon.stub(console, 'log')
      fileLoggerInfoSpy = sinon.stub(fileLogger, 'info')
    })

    afterEach(() => {
      sinon.restore()
    })


    it('should work if program has no errors', async () => {
      await run('mainExample.PepitaProgram', {
        project: join('examples', 'run-examples', 'basic-example'),
        skipValidations: false,
        game: false,
        startDiagram: false,
        assets,
        host: 'localhost',
        port: '3000',
      })
      expect(spyCalledWithSubstring(consoleLogSpy, 'Pepita empieza con 70')).to.be.true
      expect(spyCalledWithSubstring(consoleLogSpy, 'Vuela')).to.be.true
      expect(spyCalledWithSubstring(consoleLogSpy, '40')).to.be.true
      expect(spyCalledWithSubstring(consoleLogSpy, 'Come')).to.be.true
      expect(spyCalledWithSubstring(consoleLogSpy, '290')).to.be.true
      expect(processExitSpy.calledWith(0)).to.be.true
      expect(fileLoggerInfoSpy.calledOnce).to.be.true
      const fileLoggerArg = fileLoggerInfoSpy.firstCall.firstArg
      expect(fileLoggerArg.ok).to.be.true
      expect(fileLoggerArg.message).to.contain('Program executed')
    })

    it('should exit if program has errors', async () => {
      await run('mainExample.PepitaProgram', {
        project: join('examples', 'run-examples', 'bad-example'),
        skipValidations: false,
        game: false,
        startDiagram: false,
        assets,
        host: 'localhost',
        port: '3000',
      })
      expect(processExitSpy.calledWith(21)).to.be.true
      expect(fileLoggerInfoSpy.calledOnce).to.be.true
      const fileLoggerArg = fileLoggerInfoSpy.firstCall.firstArg
      expect(fileLoggerArg.ok).to.be.false
      expect(fileLoggerArg.error).to.be.ok
    })

  })

  describe('run a simple game', () => {
    let handleErrorSpy: sinon.SinonStub
    let processExitSpy: sinon.SinonStub
    let errorReturned: string | undefined = undefined

    beforeEach(() => {
      handleErrorSpy = sinon.stub(utils, 'handleError')
      handleErrorSpy.callsFake((error) => {
        console.info(`👾👾👾 ${error.message} 👾👾👾`)
        errorReturned = error.message
      })
      processExitSpy = sinon.stub(process, 'exit')
    })

    afterEach(() => {
      sinon.restore()
    })

    it('smoke test - should work if program has no errors', async () => {
      const ioGame = await run('mainGame.PepitaGame', {
        project: join('examples', 'run-examples', 'basic-game'),
        skipValidations: false,
        game: true,
        startDiagram: false,
        assets: 'specialAssets',
        port: '3000',
        host: 'localhost',
      })
      ioGame?.close()
      expect(processExitSpy.calledWith(0)).to.be.false
      expect(errorReturned).to.be.undefined
    })

    it('smoke test - should not work if program has errors', async () => {
      const ioGame = await run('mainGame.PepitaGame', {
        project: join('examples', 'run-examples', 'basic-example'),
        skipValidations: false,
        game: true,
        startDiagram: false,
        assets: 'specialAssets',
        port: '3000',
        host: 'localhost',
      })
      ioGame?.close()
      expect(processExitSpy.calledWith(21)).to.be.false
      expect(errorReturned).to.equal('Folder image examples/run-examples/basic-example/specialAssets does not exist')
    })

  })

})