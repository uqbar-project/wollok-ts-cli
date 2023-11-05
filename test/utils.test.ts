import { join } from 'path'
import { buildEnvironmentForProject, validateEnvironment } from '../src/utils'
import chaiAsPromised from 'chai-as-promised'
import chai from 'chai'

describe('build & validating environment', () => {

  const badProjectPath = join('examples', 'bad-files-examples')

  it('should throw an exception if parsing fails', async () => {
    chai.use(chaiAsPromised)
    const expect = chai.expect
    await expect(buildEnvironmentForProject(badProjectPath, ['fileWithParseErrors.wlk'])).to.eventually.be.rejectedWith(/Failed to parse fileWithParseErrors.wlk/)
  })

  it('should throw an exception if validation fails', async () => {
    const environment = await buildEnvironmentForProject(badProjectPath, ['fileWithValidationErrors.wlk'])
    chai.expect(() => { validateEnvironment(environment, false) }).to.throw(/Fatal error while building the environment/)
  })

  it('should not throw an exception if validation fails but you want to skip validation', async () => {
    const environment = await buildEnvironmentForProject(badProjectPath, ['fileWithValidationErrors.wlk'])
    chai.expect(() => { validateEnvironment(environment, true) }).to.not.throw()
  })

})