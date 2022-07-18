import { time, timeEnd } from 'console'
import { is, Test, validate } from 'wollok-ts'
import interpret from 'wollok-ts/dist/interpreter/interpreter'
import natives from 'wollok-ts/dist/wre/wre.natives'
import { buildEnvironmentForProject, failureDescription, problemDescription, successDescription, valueDescription } from '../utils'
import { bold } from 'chalk'
import  logger  from  'loglevel'

const { log } = console

type Options = {
  project: string
  skipValidations: boolean
}

export default async function (filter: string | undefined, { project, skipValidations }: Options): Promise<void> {
  logger.info(`Running all tests ${filter ? `matching ${valueDescription(filter)} ` : ''}on ${valueDescription(project)}`)

  const environment = await buildEnvironmentForProject(project)

  if(!skipValidations) {
    const problems = validate(environment)
    problems.forEach(problem => logger.info(problemDescription(problem)))
    if(!problems.length) logger.info(successDescription('No problems found building the environment!'))
    else if(problems.some(_ => _.level === 'error')) return logger.error(failureDescription('Aborting run due to validation errors!'))
  }

  const targets = environment.descendants().filter(is('Test')).filter(test =>
    (!filter || test.fullyQualifiedName().includes(filter)) &&
    !test.siblings().some(sibling => sibling.is('Test') && sibling.isOnly)
  )

  logger.info(`Running ${targets.length} tests...`)

  const debug = logger.getLevel() <= logger.levels.DEBUG
  if (debug) time('Run finished')
  const interpreter = interpret(environment, natives)
  const failures: [Test, Error][] = []
  let successes = 0

  environment.forEach(node => node.match({
    Test: node => {
      if (targets.includes(node)) {
        const tabulation = '  '.repeat(node.fullyQualifiedName().split('.').length - 1)
        try {
          interpreter.fork().exec(node)
          logger.info(tabulation, successDescription(node.name))
          successes++
        } catch (error: any) {
          logger.info(tabulation, failureDescription(node.name))
          failures.push([node, error])
        }
      }
    },
    Entity: node => {
      const tabulation = '  '.repeat(node.fullyQualifiedName().split('.').length - 1)
      if(targets.some(target => node.descendants().includes(target))){
        logger.info(tabulation, node.name)
      }
    },
    Node: _ => { },
  }))

  log()
  if (debug) timeEnd('Run finished')

  failures.forEach(([test, error]) => {
    log()
    logger.error(failureDescription(bold(test.fullyQualifiedName()), error))
  })

  logger.info(
    '\n',
    successDescription(`${successes} passing`),
    failureDescription(`${failures.length} failing`),
    '\n'
  )
}