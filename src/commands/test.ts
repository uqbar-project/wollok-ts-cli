import { time, timeEnd } from 'console'
import { is, Node, Test, validate } from 'wollok-ts'
import { List } from 'wollok-ts/dist/extensions'
import interpret, { Interpreter } from 'wollok-ts/dist/interpreter/interpreter'
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


  time('Run finished')
  const results = runTests(environment.members, interpret(environment, natives), filter ?? '')
  log()
  timeEnd('Run finished')

  results.failures.forEach(([test, error]) => {
    log()
    log(failureDescription(bold(test.fullyQualifiedName()), error))
  })

  log(
    '\n',
    successDescription(`${results.successes} passing`),
    failureDescription(`${results.failures.length} failing`),
    '\n'
  )
}

type Results = {
  total: number
  successes: number
  failures: [Test, Error][]
}

function runTests(
  nodes: List<Node>,
  interpreter: Interpreter,
  filter: string,
  tabulationLevel = 0,
  results: Results = { total: 0, successes: 0, failures: [] },
): Results {
  const tabulation = '  '.repeat(tabulationLevel)

  // TODO: Use filter

  nodes.forEach(node => {
    if(node.is('Package')){
      if(node.descendants().some(is('Test'))) log(tabulation, node.name)
      runTests(node.members, interpreter, filter, tabulationLevel + 1, results)
    }

    else if (node.is('Describe')) {
      log(tabulation, node.name)
      const onlyTest = node.tests().find(test => test.isOnly)
      runTests(onlyTest ? [onlyTest] : node.tests(), interpreter, filter, tabulationLevel + 1, results)
    }

    else if (
      node.is('Test') &&
      !node.parent.children().some(sibling => node !== sibling && sibling.is('Test') && sibling.isOnly) &&
      !!node.fullyQualifiedName().includes(filter)
    ) {
      try {
        interpreter.fork().exec(node)
        log(tabulation, successDescription(node.name))
        results.successes++
      } catch (error: any) {
        log(tabulation, failureDescription(node.name))
        results.failures.push([node, error])
      }
    }
  })

  return results
}