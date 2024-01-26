import { bold } from 'chalk'
import { time, timeEnd } from 'console'
import logger from 'loglevel'
import { Entity, Environment, Node, Test } from 'wollok-ts'
import { is, match, when } from 'wollok-ts/dist/extensions'
import interpret from 'wollok-ts/dist/interpreter/interpreter'
import natives from 'wollok-ts/dist/wre/wre.natives'
import { buildEnvironmentForProject, failureDescription, successDescription, valueDescription, validateEnvironment, handleError, ENTER, stackTrace } from '../utils'
import { logger as fileLogger } from '../logger'
import { TimeMeasurer } from '../time-measurer'

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

export function getTarget(environment: Environment, filter: string | undefined, { file, describe, test }: Options): Test[] {
  const fqnByOptionalParameters = [file, describe, test].filter(Boolean).join('.')
  const filterTest = sanitize(filter) ?? fqnByOptionalParameters ?? ''
  const possibleTargets = environment.descendants.filter(is(Test))
  const onlyTarget = possibleTargets.find(test => test.isOnly)
  const testMatches = (filter: string) => (test: Test) => !filter || sanitize(test.fullyQualifiedName)!.includes(filter)
  return onlyTarget ? [onlyTarget] : possibleTargets.filter(testMatches(filterTest))
}

export function tabulationForNode({ fullyQualifiedName }: { fullyQualifiedName: string }): string {
  return '  '.repeat(fullyQualifiedName.split('.').length - 1)
}

export default async function (filter: string | undefined, options: Options): Promise<void> {
  try {
    validateParameters(filter, options)

    const timeMeasurer = new TimeMeasurer()
    const { project, skipValidations } = options
    const runAllTestsDescription = `🧪 Running all tests ${filter ? `matching ${valueDescription(filter)} ` : ''}on ${valueDescription(project)}`

    logger.info(runAllTestsDescription)
    const environment = await buildEnvironmentForProject(project)
    validateEnvironment(environment, skipValidations)

    const targets = getTarget(environment, filter, options)

    logger.info(`Running ${targets.length} tests...`)

    const debug = logger.getLevel() <= logger.levels.DEBUG
    if (debug) time('Run finished')
    const interpreter = interpret(environment, natives)
    const failures: [Test, Error][] = []
    let successes = 0

    environment.forEach(node => match(node)(
      when(Test)(node => {
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

      when(Entity)(node => {
        const tabulation = tabulationForNode(node)
        if(targets.some(target => node.descendants.includes(target))){
          logger.info(tabulation, node.name)
        }
      }),

      when(Node)( _ => { }),
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
    fileLogger.info({ level: 'info', message: `🧪 Test runner executed ${filter ? `matching ${filter} ` : ''}on ${project}`, result: { ok: successes, failed: failures.length }, failures: failuresForLogging, timeElapsed: timeMeasurer.elapsedTime() })

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