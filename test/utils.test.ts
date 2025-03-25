import { bold, red, yellowBright } from 'chalk'
import logger from 'loglevel'
import sinon from 'sinon'
import path, { join } from 'path'
import { buildEnvironmentForProject, failureDescription, getFQN, handleError, problemDescription, validateEnvironment, Project } from '../src/utils'
import chaiAsPromised from 'chai-as-promised'
import chai from 'chai'
import { spyCalledWithSubstring } from './assertions'
import { Problem, WOLLOK_EXTRA_STACK_TRACE_HEADER, validate, List } from 'wollok-ts'
import * as wollok from 'wollok-ts'

describe('build & validating environment', () => {

  afterEach(() => {
    sinon.restore()
  })
  const badProjectPath = join('examples', 'bad-files-examples')

  it('should throw an exception if parsing fails', async () => {
    chai.use(chaiAsPromised)
    const expect = chai.expect
    sinon.stub(wollok, 'buildEnvironment').throws(new Error('Failed to parse fileWithParseErrors.wlk'))
    await expect(buildEnvironmentForProject(join(badProjectPath, 'parse-errors'), ['fileWithParseErrors.wlk'])).to.eventually.be.rejectedWith(/Failed to parse fileWithParseErrors.wlk/)
  })

  it('should throw an exception if validation fails', async () => {
    const environment = await buildEnvironmentForProject(join(badProjectPath, 'validation-errors'), ['fileWithValidationErrors.wlk'])
    chai.expect(() => { validateEnvironment(environment, false) }).to.throw(/Fatal error while running validations/)
  })

  it('should not throw an exception if validation fails but you want to skip validation', async () => {
    const environment = await buildEnvironmentForProject(join(badProjectPath, 'validation-errors'), ['fileWithValidationErrors.wlk'])
    chai.expect(() => { validateEnvironment(environment, true) }).to.not.throw()
  })

})

describe('handle error', () => {

  let loggerInfoSpy: sinon.SinonStub

  beforeEach(() => {
    loggerInfoSpy = sinon.stub(logger, 'error')
  })

  afterEach(() => {
    sinon.restore()
  })

  it('shows error message', async () => {
    await handleError(new Error('Parse validation failed'))

    chai.expect(spyCalledWithSubstring(loggerInfoSpy, 'Uh-oh... Unexpected Error')).to.be.true
    chai.expect(spyCalledWithSubstring(loggerInfoSpy, 'Parse validation failed')).to.be.true
  })

})

describe('resources', () => {

  it('returns the right FQN for an element inside the project - using path join', () => {
    chai.expect(getFQN(path.join('usr', 'alf', 'workspace', 'test-project'), path.join('usr', 'alf', 'workspace', 'test-project', 'example', 'aves.wlk'))).to.equal('example.aves')
  })

  it('returns package.json content for a valid project', () => {
    const packageData = new Project(join('examples', 'package-examples', 'good-project')).properties
    chai.expect(packageData.name).to.equal('parcialBiblioteca')
    chai.expect(packageData.wollokVersion).to.equal('4.0.0')
  })

  it('returns empty for an invalid project (no package.json)', () => {
    const packageData = new Project(join('examples', 'package-examples', 'bad-project')).properties
    chai.expect(packageData).to.be.empty
  })

})

describe('printing', () => {

  it('shows a failure description with a sanitized stack trace', () => {
    const somethingBadError = new Error('Something bad')
    somethingBadError.cause = undefined
    somethingBadError.stack = `at Context.<anonymous> (/home/dodain/workspace/wollok-dev/wollok-ts-cli/test/utils.test.ts:64:56)
    at callFn (/home/dodain/workspace/wollok-dev/wollok-ts-cli/node_modules/mocha/lib/runnable.js:366:21)
    \t${WOLLOK_EXTRA_STACK_TRACE_HEADER}\tat Evaluation.execThrow (/snapshot/wollok-ts-cli/node_modules/wollok-ts/dist/interpreter/runtimeModel.js:445:15)
    `
    const failure = failureDescription('Unexpected error', somethingBadError)
    chai.expect(failure).to.contain('Unexpected error')
    chai.expect(failure).to.contain('at Context.<anonymous> (/home/dodain/workspace/wollok-dev/wollok-ts-cli/test/utils.test.ts:64:56)')
    chai.expect(failure).to.contain('at callFn (/home/dodain/workspace/wollok-dev/wollok-ts-cli/node_modules/mocha/lib/runnable.js:366:21)')
    chai.expect(failure).not.to.contain(WOLLOK_EXTRA_STACK_TRACE_HEADER)
    chai.expect(failure).not.to.contain('Evaluation.execThrow')
  })

  describe('problem description', () => {

    let problems: List<Problem>

    beforeEach(async () => {
      const problemsProjectPath = join('examples', 'problems-examples')
      const environment = await buildEnvironmentForProject(problemsProjectPath, ['example.wlk'])
      problems = validate(environment)
    })

    it('shows a problem error', () => {
      const firstError = problems?.find(problem => problem.level === 'error') as Problem
      const problem = problemDescription(firstError)
      chai.expect(problem).to.contain(red(`${bold('[ERROR]')}: shouldNotReassignConst at example.wlk:5`))
    })

    it('shows a problem warning', () => {
      const firstError = problems?.find(problem => problem.level === 'warning') as Problem
      const problem = problemDescription(firstError)
      chai.expect(problem).to.contain(yellowBright(`${bold('[WARNING]')}: nameShouldBeginWithUppercase at example.wlk:1`))
    })

  })

})