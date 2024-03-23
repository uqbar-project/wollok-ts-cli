import { bold } from 'chalk'
import { time, timeEnd } from 'console'
import logger from 'loglevel'
import { Entity, Environment, Node, Test, is, match, when, WRENatives as natives, interpret, Describe } from 'wollok-ts'
import { buildEnvironmentForProject, failureDescription, successDescription, valueDescription, validateEnvironment, handleError, ENTER, stackTrace, buildEnvironmentIcon, testIcon } from '../utils'
import { logger as fileLogger } from '../logger'
import { TimeMeasurer } from '../time-measurer'
import { Package } from 'wollok-ts'

const { log } = console

export type Options = {
  file: string | undefined,
  describe: string | undefined,
  test: string | undefined,
  project: string
  skipValidations: boolean
}

export function validateParameters(filter: string | undefined, { file, describe, test }: Options): void {
  if (filter && (file || describe || test)) throw new Error('You should either use filter by full name or file/describe/test.')
}

export function sanitize(value?: string): string | undefined {
  return value?.replaceAll('"', '')
}

export function getTarget(environment: Environment, filter: string | undefined, options: Options): Test[] {
  if(filter){
    return getTargetByFilter(environment, filter)
  } else {
    return getTargetByOptions(environment, options)
  }
}

function getTargetByFilter(environment: Environment, filter: string | undefined): Test[] {
  const filterTest = sanitize(filter) ?? ''
  const possibleTargets = environment.descendants.filter(is(Test))
  const onlyTarget = possibleTargets.find((test: Test) => test.isOnly)
  const testMatches = (filter: string) => (test: Test) => !filter || sanitize(test.fullyQualifiedName)!.includes(filter)
  return onlyTarget ? [onlyTarget] : possibleTargets.filter(testMatches(filterTest))
}


function getTargetByOptions(environment: Environment, { file, describe, test }: Options): Test[] {
  let nodeToFilter: Environment | Package | Describe = environment

  if(file) {
    nodeToFilter = environment.descendants.find(node => node.is(Package) && node.name === file) as Package | undefined ?? environment
  }

  if(describe) {
    nodeToFilter = nodeToFilter.descendants.find(node => node.is(Describe) && node.name === `"${describe}"`) as Describe | undefined ?? nodeToFilter
  }

  const testFilter = test ?
    (node: Node): node is Test => node.is(Test) && node.name === `"${test}"` :
    is(Test)

  const matchedTests = nodeToFilter.descendants.filter(testFilter)

  if(matchedTests.some(test => test.isOnly)) {
    return [matchedTests.find(test => test.isOnly)!]
  }

  return matchedTests
}

export function tabulationForNode({ fullyQualifiedName }: { fullyQualifiedName: string }): string {
  return '  '.repeat(fullyQualifiedName.split('.').length - 1)
}

export default async function (filter: string | undefined, options: Options): Promise<void> {
  try {
    validateParameters(filter, options)

    const timeMeasurer = new TimeMeasurer()
    const { project, skipValidations } = options
    const runAllTestsDescription = `${testIcon} Running all tests ${filter ? `matching ${valueDescription(filter)} ` : ''}on ${valueDescription(project)}`

    logger.info(runAllTestsDescription)

    logger.info(`${buildEnvironmentIcon} Building environment for ${valueDescription(project)}...${ENTER}`)
    const environment = await buildEnvironmentForProject(project)
    validateEnvironment(environment, skipValidations)

    const targets = getTarget(environment, filter, options)

    logger.info(`Running ${targets.length} tests...`)

    const debug = logger.getLevel() <= logger.levels.DEBUG
    if (debug) time('Run finished')
    const interpreter = interpret(environment, natives)
    const failures: [Test, Error][] = []
    let successes = 0

    environment.forEach((node: Node) => match(node)(
      when(Test)((node: Test) => {
        if (targets.includes(node)) {
          const tabulation = tabulationForNode(node)
          try {
            interpreter.fork().exec(node)
            logger.info(tabulation, successDescription(node.name))
            successes++
          } catch (error: any) {
            logger.info(tabulation, failureDescription(node.name))
            failures.push([node, error])
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

    failures.forEach(([test, error]) => {
      log()
      logger.error(failureDescription(bold(test.fullyQualifiedName), error))
    })

    const failuresForLogging = failures.map(([test, error]) => ({
      test: test.fullyQualifiedName,
      error: stackTrace(error),
    }))
    fileLogger.info({ message: `${testIcon} Test runner executed ${filter ? `matching ${filter} ` : ''}on ${project}`, result: { ok: successes, failed: failures.length }, failures: failuresForLogging, timeElapsed: timeMeasurer.elapsedTime() })

    logger.info(
      ENTER,
      successDescription(`${successes} passing`),
      failures.length ? failureDescription(`${failures.length} failing`) : '',
      ENTER
    )

    if (failures.length) {
      process.exit(2)
    }
  } catch (error: any) {
    handleError(error)
    return process.exit(1)
  }
}