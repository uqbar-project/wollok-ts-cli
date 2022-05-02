import { time, timeEnd } from 'console'
import { is, Test, validate } from 'wollok-ts'
import interpret from 'wollok-ts/dist/interpreter/interpreter'
import natives from 'wollok-ts/dist/wre/wre.natives'
import { buildEnvironmentForProject, failureDescription, problemDescription, successDescription, valueDescription } from '../utils'
import { bold } from 'chalk'

const { log } = console

type Options = {
  project: string
  skipValidations: boolean
}

export default async function (filter: string | undefined, { project, skipValidations }: Options): Promise<void> {
  log(`Running all tests ${filter ? `matching ${valueDescription(filter)} ` : ''}on ${valueDescription(project)}`)

  const environment = await buildEnvironmentForProject(project)

  if(!skipValidations) {
    const problems = validate(environment)
    problems.forEach(problem => log(problemDescription(problem)))
    if(!problems.length) log(successDescription('No problems found building the environment!'))
    else if(problems.some(_ => _.level === 'error')) return log(failureDescription('Aborting run due to validation errors!'))
  }

  const targets = environment.descendants().filter(is('Test')).filter(test =>
    (!filter || test.fullyQualifiedName().includes(filter)) &&
    !test.siblings().some(sibling => sibling.is('Test') && sibling.isOnly)
  )

  log(`Running ${targets.length} tests...`)

  time('Run finished')
  const interpreter = interpret(environment, natives)
  const failures: [Test, Error][] = []
  let successes = 0

  environment.forEach(node => node.match({
    Test: node => {
      if (targets.includes(node)) {
        const tabulation = '  '.repeat(node.fullyQualifiedName().split('.').length - 1)
        try {
          interpreter.fork().exec(node)
          log(tabulation, successDescription(node.name))
          successes++
        } catch (error: any) {
          log(tabulation, failureDescription(node.name))
          failures.push([node, error])
        }
      }
    },
    Entity: node => {
      const tabulation = '  '.repeat(node.fullyQualifiedName().split('.').length - 1)
      if(targets.some(target => node.descendants().includes(target)))
        log(tabulation, node.name)
    },
    Node: _ => { },
  }))

  log()
  timeEnd('Run finished')

  failures.forEach(([test, error]) => {
    log()
    log(failureDescription(bold(test.fullyQualifiedName()), error))
  })

  log(
    '\n',
    successDescription(`${successes} passing`),
    failureDescription(`${failures.length} failing`),
    '\n'
  )
}