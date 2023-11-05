import { bold } from 'chalk'
import { time, timeEnd } from 'console'
import logger from 'loglevel'
import { Entity, Node, Test } from 'wollok-ts'
import { is, match, when } from 'wollok-ts/dist/extensions'
import interpret from 'wollok-ts/dist/interpreter/interpreter'
import natives from 'wollok-ts/dist/wre/wre.natives'
import { buildEnvironmentForProject, failureDescription, successDescription, valueDescription, validateEnvironment } from '../utils'

const { log } = console

type Options = {
  project: string
  skipValidations: boolean
}

export default async function (filter: string | undefined, { project, skipValidations }: Options): Promise<void> {
  logger.info(`Running all tests ${filter ? `matching ${valueDescription(filter)} ` : ''}on ${valueDescription(project)}`)

  const environment = await buildEnvironmentForProject(project)

  validateEnvironment(environment, skipValidations)

  const filterTest = filter?.replaceAll('"', '') ?? ''
  const possibleTargets = environment.descendants.filter(is(Test))
  const onlyTarget = possibleTargets.find(test => test.isOnly)
  const testMatches = (filter: string) => (test: Test) => !filter || test.fullyQualifiedName.replaceAll('"', '').includes(filterTest)
  const targets = onlyTarget ? [onlyTarget] : possibleTargets.filter(testMatches(filterTest))

  logger.info(`Running ${targets.length} tests...`)

  const debug = logger.getLevel() <= logger.levels.DEBUG
  if (debug) time('Run finished')
  const interpreter = interpret(environment, natives)
  const failures: [Test, Error][] = []
  let successes = 0

  environment.forEach(node => match(node)(
    when(Test)(node => {
      if (targets.includes(node)) {
        const tabulation = '  '.repeat(node.fullyQualifiedName.split('.').length - 1)
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
      const tabulation = '  '.repeat(node.fullyQualifiedName.split('.').length - 1)
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

  logger.info(
    '\n',
    successDescription(`${successes} passing`),
    failures.length ? failureDescription(`${failures.length} failing`) : '',
    '\n'
  )

  if (failures.length) {
    process.exit(2)
  }
}