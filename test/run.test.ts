import chai from 'chai'
import { mkdirSync, rmdirSync } from 'fs'
import { join } from 'path'
import sinon from 'sinon'
import run, { getAssetsFolder, getSoundsFolder } from '../src/commands/run'
import { spyCalledWithSubstring } from './assertions'

chai.should()
const expect = chai.expect

const project = join('examples', 'run-examples', 'basic-example')

describe('testing run', () => {

  const buildOptions = (game: boolean, assets: string | undefined) => ({
    game,
    project,
    assets,
    skipValidations: false,
    startDiagram: false,
  })

  describe('getAssetsPath', () => {
    it('should return assets folder from options if it exists', () => {
      expect(getAssetsFolder(buildOptions(true, 'myAssets'))).to.equal('myAssets')
    })

    it('should return assets folder from package if options is not set', () => {
      expect(getAssetsFolder(buildOptions(true, undefined))).to.equal('specialAssets')
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

  describe('run a simple program', () => {

    let processExitSpy: sinon.SinonStub
    let consoleLogSpy: sinon.SinonStub

    beforeEach(() => {
      processExitSpy = sinon.stub(process, 'exit')
      consoleLogSpy = sinon.stub(console, 'log')
    })

    afterEach(() => {
      sinon.restore()
    })


    it ('should work if program has no errors', async () => {
      await run('mainExample.PepitaProgram', {
        project: join('examples', 'run-examples', 'basic-example'),
        skipValidations: false,
        game: false,
        startDiagram: false,
      })
      expect(spyCalledWithSubstring(consoleLogSpy, 'Pepita empieza con 70')).to.be.true
      expect(spyCalledWithSubstring(consoleLogSpy, 'Vuela')).to.be.true
      expect(spyCalledWithSubstring(consoleLogSpy, '40')).to.be.true
      expect(spyCalledWithSubstring(consoleLogSpy, 'Come')).to.be.true
      expect(spyCalledWithSubstring(consoleLogSpy, '290')).to.be.true
      expect(processExitSpy.calledWith(0)).to.be.true
    })
  })

  describe('run a simple game', () => {

    let clock: sinon.SinonFakeTimers

    beforeEach(() => {
      clock = sinon.useFakeTimers()
    })

    afterEach(() => {
      sinon.restore()
    })


    it ('smoke teset - should work if program has no errors', async () => {
      run('mainGame.PepitaGame', {
        project: join('examples', 'run-examples', 'basic-example'),
        skipValidations: false,
        game: true,
        startDiagram: true,
      })
      await clock.runAllAsync()
    })
  })

})