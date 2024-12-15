import { bold, red } from 'chalk'
import { time, timeEnd } from 'console'
import logger from 'loglevel'
import { Entity, Environment, Node, Test, is, match, when, interpret, Describe, count } from 'wollok-ts'
import { buildEnvironmentForProject, failureDescription, successDescription, valueDescription, validateEnvironment, handleError, ENTER, sanitizeStackTrace, buildEnvironmentIcon, testIcon, assertionError, warningDescription, readNatives, BaseOptions } from '../utils'
import { logger as fileLogger } from '../logger'
import { TimeMeasurer } from '../time-measurer'
import { Package } from 'wollok-ts'


const { log } = console

export class Options extends BaseOptions {
  file?: string
  describe?: string
  test?: string
  skipValidations?: boolean
}

class TestSearchMissError extends Error{}

export function validateParameters(filter: string | undefined, { file, describe, test }: Options): void {
  if (filter && (file || describe || test)) throw new Error('You should either use filter by full name or file/describe/test.')
}

export function matchingTestDescription(filter: string | undefined, options: Options): string {
  if(filter) return `matching ${valueDescription(filter)}`
  if(options.file || options.describe || options.test) {
    const stringifiedOrWildcard = (value?: string) => value ? `'${value}'` : '*'
    return `matching ${valueDescription([options.file, options.describe, options.test].map(stringifiedOrWildcard).join('.'))}`
  }
  return ''
}

export function sanitize(value?: string): string | undefined {
  return value?.replaceAll('"', '')
}

export function getTarget(environment: Environment, filter: string | undefined, options: Options): Test[] {
  let possibleTargets: Test[]
  try {
    possibleTargets = getBaseNode(environment, filter, options).descendants.filter(getTestFilter(filter, options))
    const onlyTarget = possibleTargets.find((test: Test) => test.isOnly)
    const testMatches = (filter: string) => (test: Test) => !filter || sanitize(test.fullyQualifiedName)!.includes(filter)
    const filterTest = sanitize(filter) ?? ''
    return onlyTarget ? [onlyTarget] : possibleTargets.filter(testMatches(filterTest))
  } catch(e: any){
    if(e instanceof TestSearchMissError){
      logger.error(red(bold(e.message)))
      return []
    }
    throw e
  }
}

function getBaseNode(environment: Environment, filter: string | undefined, options: Options): Environment | Package | Describe {
  if (filter) return environment

  const { file, describe } = options
  let nodeToFilter: Environment | Package | Describe | undefined = environment
  if (file) {
    nodeToFilter = nodeToFilter.descendants.find(node => node.is(Package) && node.fileName === file) as Package | undefined
    if(!nodeToFilter) throw new TestSearchMissError(`File '${file}' not found`)
  }
  if (describe) {
    nodeToFilter = nodeToFilter.descendants.find(node => node.is(Describe) && node.name === `"${describe}"`) as Describe | undefined
    if(!nodeToFilter) throw new TestSearchMissError(`Describe '${describe}' not found`)
  }
  return nodeToFilter
}

function getTestFilter(filter: string | undefined, options: Options): (node: Node) => node is Test {
  return filter || !options.test ?
    is(Test) :
    (node: Node): node is Test => node.is(Test) && node.name === `"${options.test}"`
}
export function tabulationForNode({ fullyQualifiedName }: { fullyQualifiedName: string }): string {
  return '  '.repeat(fullyQualifiedName.split('.').length - 1)
}

enum TestResult {
  'ok',
  'failure',
  'error'
}

type TestExecutionError = {
  test: Test,
  result: TestResult,
  error: Error,
}

export default async function (filter: string | undefined, options: Options): Promise<void> {
  try {
    validateParameters(filter, options)

    const timeMeasurer = new TimeMeasurer()
    const { project, skipValidations } = options

    const matchLog = matchingTestDescription(filter, options)
    const runAllTestsDescription = `${testIcon} Running all tests${matchLog ? ` ${matchLog} `: ' '}on ${valueDescription(project)}`

    logger.info(runAllTestsDescription)

    logger.info(`${buildEnvironmentIcon} Building environment for ${valueDescription(project)}...${ENTER}`)
    const environment = await buildEnvironmentForProject(project)
    validateEnvironment(environment, skipValidations)

    const targets = getTarget(environment, filter, options)

    logger.info(`Running ${targets.length} tests...`)

    const debug = logger.getLevel() <= logger.levels.DEBUG
    if (debug) time('Run finished')
    const interpreter = interpret(environment, await readNatives(options.nativesFolder))
    const testsFailed: TestExecutionError[] = []
    let successes = 0

    environment.forEach((node: Node) => match(node)(
      when(Test)((test: Test) => {
        if (targets.includes(test)) {
          const tabulation = tabulationForNode(test)
          try {
            interpreter.fork().exec(test)
            logger.info(tabulation, successDescription(test.name))
            successes++
          } catch (error: unknown) {
            const isAssertionError = assertionError(error as Error)
            logger.info(tabulation, isAssertionError ? warningDescription(test.name) : failureDescription(test.name))
            testsFailed.push({
              test,
              error: error as Error,
              result: isAssertionError ? TestResult.failure : TestResult.error,
            })
          }
        }
      }),

      when(Entity)((node: Entity) => {
        const tabulation = tabulationForNode(node)
        if(targets.some(target => node.descendants.includes(target))){
          logger.info(tabulation, node.name)
        }
      }),

      when(Node)((_: Node) => { }),
    ))

    log()
    if (debug) timeEnd('Run finished')

    testsFailed.forEach(({ test, error }) => {
      log()
      logger.error(failureDescription(bold(test.fullyQualifiedName), error))
    })

    const failures = count(testsFailed, ({ result }) => result === TestResult.failure)
    const errors = count(testsFailed, ({ result }) => result === TestResult.error)

    const testsFailedForLogging = testsFailed.map(({ test, error }) => ({
      test: test.fullyQualifiedName,
      error: sanitizeStackTrace(error),
    }))
    fileLogger.info({ message: `${testIcon} Test runner executed ${filter ? `matching ${filter} ` : ''}on ${project}`, result: { ok: successes, failed: failures, errored: errors }, testsFailed: testsFailedForLogging, timeElapsed: timeMeasurer.elapsedTime() })

    logger.info(
      ENTER,
      successDescription(`${successes} passed`),
      failures ? warningDescription(`${failures} failed`) : '',
      errors ? failureDescription(`${errors} errored`) : '',
      ENTER
    )

    if (failures + errors > 0) {
      process.exit(2)
    }
  } catch (error: any) {
    handleError(error)
    return process.exit(1)
  }
}