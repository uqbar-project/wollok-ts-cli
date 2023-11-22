import chai from 'chai'
import { join } from 'path'
import { getSoundsFolder, getAssetsFolder } from '../src/commands/run'
import { mkdirSync, rmdirSync } from 'fs'

chai.should()
const expect = chai.expect

const project = join('examples', 'run-examples', 'basic-example')

// const baseOptions: Options = {
//   project,
//   noCI: false,
//   noTest: false,
//   game: false,
// }

describe('testing run', () => {

  // let processExitSpy: sinon.SinonStub

  // beforeEach(() => {
  //   processExitSpy = sinon.stub(process, 'exit')
  // })

  // afterEach(() => {
  //   rmSync(project, { recursive: true, force: true })
  //   sinon.restore()
  // })

  describe('getAssetsPath', () => {
    it('should return assets folder from options if it exists', () => {
      expect(getAssetsFolder(project, 'myAssets')).to.equal('myAssets')
    })

    it('should return assets folder from package if options is not set', () => {
      expect(getAssetsFolder(project, undefined)).to.equal('specialAssets')
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

})