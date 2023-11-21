import chai from 'chai'
import { join } from 'path'
import { getAssetsPath } from '../src/commands/run'

chai.should()
const expect = chai.expect

const project = join('examples', 'run-examples', 'basic-example')
// const GITHUB_FOLDER = join('.github', 'workflows')

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
      expect(getAssetsPath(project, 'myAssets')).to.equal(join(project, 'myAssets'))
    })

    it('should return assets folder from package if options is not set', () => {
      expect(getAssetsPath(project, undefined)).to.equal(join(project, 'specialAssets'))
    })

  })

})