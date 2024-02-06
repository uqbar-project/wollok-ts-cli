import { expect } from 'chai'
import { join } from 'path'
import { buildEnvironmentForProject } from '../src/utils'
import test, { getTarget, sanitize, tabulationForNode, validateParameters } from '../src/commands/test'
import { Environment } from 'wollok-ts'
import logger from 'loglevel'
import { logger as fileLogger } from '../src/logger'
import sinon from 'sinon'
import { spyCalledWithSubstring } from './assertions'

describe('Test', () => {

  describe('getTarget', () => {

    let environment: Environment

    describe('normal case', () => {

      const projectPath = join('examples', 'test-examples', 'normal-case')

      const emptyOptions = {
        project: projectPath,
        skipValidations: false,
        file: undefined,
        describe: undefined,
        test: undefined,
      }

      beforeEach(async () => {
        environment = await buildEnvironmentForProject(projectPath)
      })

      it('should filter by test using filter option', () => {
        const tests = getTarget(environment, 'another test', emptyOptions)
        expect(tests.length).to.equal(1)
        expect(tests[0].name).to.equal('"another test"')
      })

      it('should filter by test using filter option - case insensitive', () => {
        const tests = getTarget(environment, 'aNothEr Test', emptyOptions)
        expect(tests.length).to.equal(0)
      })

      it('should filter by test using test option', () => {
        const tests = getTarget(environment, undefined, {
          ...emptyOptions,
          test: 'another test',
        })
        expect(tests.length).to.equal(1)
        expect(tests[0].name).to.equal('"another test"')
      })

      it('should filter by test using test option - case insensitive', () => {
        const tests = getTarget(environment, undefined, {
          ...emptyOptions,
          test: 'aNother Test',
        })
        expect(tests.length).to.equal(0)
      })

      it('should filter by describe using filter option', () => {
        const tests = getTarget(environment, 'second describe', emptyOptions)
        expect(tests.length).to.equal(2)
        expect(tests[0].name).to.equal('"second test"')
        expect(tests[1].name).to.equal('"another second test"')
      })

      it('should filter by describe using filter option - case insensitive', () => {
        const tests = getTarget(environment, 'SeCOND describe', emptyOptions)
        expect(tests.length).to.equal(0)
      })

      it('should filter by describe using describe option', () => {
        const tests = getTarget(environment, undefined, {
          ...emptyOptions,
          describe: 'second describe',
        })
        expect(tests.length).to.equal(2)
        expect(tests[0].name).to.equal('"second test"')
        expect(tests[1].name).to.equal('"another second test"')
      })

      it('should filter by describe & test using describe & test option', () => {
        const tests = getTarget(environment, undefined, {
          ...emptyOptions,
          describe: 'second describe',
          test: 'another second test',
        })
        expect(tests.length).to.equal(1)
        expect(tests[0].name).to.equal('"another second test"')
      })

      it('should filter by file using filter option', () => {
        const tests = getTarget(environment, 'test-one', emptyOptions)
        expect(tests.length).to.equal(2)
        expect(tests[0].name).to.equal('"a test"')
        expect(tests[1].name).to.equal('"another test"')
      })

      it('should filter by file using file option', () => {
        const tests = getTarget(environment, undefined, {
          ...emptyOptions,
          file: 'test-one',
        })
        expect(tests.length).to.equal(2)
        expect(tests[0].name).to.equal('"a test"')
        expect(tests[1].name).to.equal('"another test"')
      })

      it('should filter by file & describe using file & describe option', () => {
        const tests = getTarget(environment, undefined, {
          ...emptyOptions,
          file: 'test-one',
          describe: 'this describe',
        })
        expect(tests.length).to.equal(2)
        expect(tests[0].name).to.equal('"a test"')
        expect(tests[1].name).to.equal('"another test"')
      })

      it('should filter by file & describe using filter option', () => {
        const tests = getTarget(environment, 'test-one.this describe', emptyOptions)
        expect(tests.length).to.equal(2)
        expect(tests[0].name).to.equal('"a test"')
        expect(tests[1].name).to.equal('"another test"')
      })

      it('should filter by file & describe & test using file & describe & test option', () => {
        const tests = getTarget(environment, undefined, {
          ...emptyOptions,
          file: 'test-one',
          describe: 'this describe',
          test: 'another test',
        })
        expect(tests.length).to.equal(1)
        expect(tests[0].name).to.equal('"another test"')
      })

      it('should filter by file using filter option', () => {
        const tests = getTarget(environment, 'test-one.this describe.another test', emptyOptions)
        expect(tests.length).to.equal(1)
        expect(tests[0].name).to.equal('"another test"')
      })

    })

    describe('only case', () => {

      const projectPath = join('examples', 'test-examples', 'only-case')

      const emptyOptions = {
        project: projectPath,
        skipValidations: false,
        file: undefined,
        describe: undefined,
        test: undefined,
      }

      beforeEach(async () => {
        environment = await buildEnvironmentForProject(projectPath)
      })

      it('should execute single test when running a describe using filter option', () => {
        const tests = getTarget(environment, 'only describe', emptyOptions)
        expect(tests.length).to.equal(1)
        expect(tests[0].name).to.equal('"this is the one"')
      })

      it('should execute single test when running a describe using file option', () => {
        const tests = getTarget(environment, undefined, {
          ...emptyOptions,
          describe: 'only describe',
        })
        expect(tests.length).to.equal(1)
        expect(tests[0].name).to.equal('"this is the one"')
      })

      it('should execute single test when running a file using filter option', () => {
        const tests = getTarget(environment, 'only-file', emptyOptions)
        expect(tests.length).to.equal(1)
        expect(tests[0].name).to.equal('"this is the one"')
      })

      it('should execute single test when running a file using file option', () => {
        const tests = getTarget(environment, undefined, {
          ...emptyOptions,
          file: 'only-file',
        })
        expect(tests.length).to.equal(1)
        expect(tests[0].name).to.equal('"this is the one"')
      })

    })
  })

  describe('sanitize', () => {

    it('should remove double quotes from value', () => {
      expect(sanitize('"some test"')).to.equal('some test')
    })

    it('should leave undefined values as is', () => {
      expect(sanitize(undefined)).to.be.undefined
    })

  })

  describe('validateParameters', () => {

    const emptyOptions = {
      skipValidations: false,
      project: '',
      file: undefined,
      describe: undefined,
      test: undefined,
    }

    it('should pass if no filter and no options passed', () => {
      expect(() => { validateParameters(undefined, emptyOptions) }).not.to.throw()
    })

    it('should pass if filter is passed and no options is passed', () => {
      expect(() => { validateParameters('some test', emptyOptions) }).not.to.throw()
    })

    it('should pass if options is passed and no filter is passed', () => {
      expect(() => { validateParameters(undefined, {
        ...emptyOptions,
        test: 'some test',
      }) }).not.to.throw()
    })

    it('should fail if filter and options are passed', () => {
      expect(() => { validateParameters('some describe', {
        ...emptyOptions,
        test: 'some test',
      }) }).to.throw(/You should either use filter by full name or file/)
    })

  })

  describe('tabulations for node', () => {

    it('should work for root package', () => {
      expect(tabulationForNode({ fullyQualifiedName: 'root' })).to.equal('')
    })

    it('should work for fqn level', () => {
      expect(tabulationForNode({ fullyQualifiedName: 'aves.otros.pepita' })).to.equal('    ')
    })
  })

  describe('smoke test for test default function', () => {

    let fileLoggerInfoSpy: sinon.SinonStub
    let loggerInfoSpy: sinon.SinonStub
    let processExitSpy: sinon.SinonStub

    const projectPath = join('examples', 'test-examples', 'normal-case')

    const emptyOptions = {
      project: projectPath,
      skipValidations: false,
      file: undefined,
      describe: undefined,
      test: undefined,
    }

    beforeEach(() => {
      loggerInfoSpy = sinon.stub(logger, 'info')
      fileLoggerInfoSpy = sinon.stub(fileLogger, 'info')
      processExitSpy = sinon.stub(process, 'exit')
    })

    afterEach(() => {
      sinon.restore()
    })

    it('passes all the tests successfully and exits normally', async () => {
      await test(undefined, {
        ...emptyOptions,
        file: 'test-one',
      })

      expect(processExitSpy.callCount).to.equal(0)
      expect(spyCalledWithSubstring(loggerInfoSpy, 'Running 2 tests')).to.be.true
      expect(spyCalledWithSubstring(loggerInfoSpy, '2 passing')).to.be.true
      expect(spyCalledWithSubstring(loggerInfoSpy, '0 failing')).to.be.false // old version
      expect(fileLoggerInfoSpy.calledOnce).to.be.true
      expect(fileLoggerInfoSpy.firstCall.firstArg.result).to.deep.equal({ ok: 2, failed: 0 })
    })

    it('returns exit code 2 if one or more tests fail', async () => {
      await test(undefined, emptyOptions)

      expect(processExitSpy.calledWith(2)).to.be.true
      expect(spyCalledWithSubstring(loggerInfoSpy, 'Running 5 tests')).to.be.true
      expect(spyCalledWithSubstring(loggerInfoSpy, '4 passing')).to.be.true
      expect(spyCalledWithSubstring(loggerInfoSpy, '1 failing')).to.be.true
      expect(fileLoggerInfoSpy.calledOnce).to.be.true
      const fileLoggerArg = fileLoggerInfoSpy.firstCall.firstArg
      expect(fileLoggerArg.result).to.deep.equal({ ok: 4, failed: 1 })
      expect(fileLoggerArg.failures.length).to.equal(1)
    })

    it('returns exit code 1 if tests throw an error', async () => {
      await test(undefined, {
        ...emptyOptions,
        project: join('examples', 'test-examples', 'failing-case'),
      })

      expect(processExitSpy.calledWith(1)).to.be.true
    })

  })
})