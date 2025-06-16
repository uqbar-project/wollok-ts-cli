import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiHttp from 'chai-http'
import { mkdirSync, rmdirSync } from 'fs'
import logger from 'loglevel'
import { join } from 'path'
import sinon from 'sinon'
import { Server } from 'socket.io'
import { interpret } from 'wollok-ts'
import run, { Options } from '../src/commands/run'
import { getVisuals } from '../src/game'
import { logger as fileLogger } from '../src/logger'
import * as utils from '../src/utils'
import { buildEnvironmentCommand, getAllAssets, getAssetsFolder, getSoundsFolder, readNatives } from '../src/utils'
import { spyCalledWithSubstring } from './assertions'
import { fakeIO } from './mocks'

chai.should()
chai.use(chaiHttp)
chai.use(chaiAsPromised)
const expect = chai.expect

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
      expect(getAssetsFolder(proj, 'myAssets')).to.equal('myAssets')
    })

    it('should return assets folder from project if asset option is empty', () => {
      expect(getAssetsFolder(proj, '')).to.equal('specialAssets')
    })

    it('should return assets folder from package if it exists', () => {
      expect(getAssetsFolder(new utils.Project(join('examples', 'run-examples', 'no-asset-folder-example')), '')).to.equal('assets')
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
    let consoleLoggerInfoSpy: sinon.SinonStub

    beforeEach(() => {
      processExitSpy = sinon.stub(process, 'exit')
      consoleLogSpy = sinon.stub(console, 'log')
      fileLoggerInfoSpy = sinon.stub(fileLogger, 'info')
      consoleLoggerInfoSpy = sinon.stub(logger, 'info')
    })

    afterEach(() => {
      sinon.restore()
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
      expect(spyCalledWithSubstring(consoleLoggerInfoSpy, 'finalized successfully')).to.be.true
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
    let io: Server

    beforeEach(async () => {
      handleErrorSpy = sinon.stub(utils, 'handleError')
      handleErrorSpy.callsFake((error) => {
        console.info(`👾👾👾 ${error.message} 👾👾👾`)
        errorReturned = error.message
      })
      processExitSpy = sinon.stub(process, 'exit')
      io = fakeIO()
      sinon.stub(await import('../src/game'), 'initializeGameClient').returns(io)
    })

    afterEach(() => {
      sinon.restore()
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
      expect(processExitSpy.calledWith(0)).to.be.false
      expect(errorReturned).to.be.undefined
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
      expect(processExitSpy.calledWith(21)).to.be.false
      expect(errorReturned?.split('\n')[0]).to.equal('Folder image examples/run-examples/basic-example/specialAssets does not exist')
    })
  })
})