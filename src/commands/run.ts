import { Name, validate } from 'wollok-ts'
import interpret from 'wollok-ts/dist/interpreter/interpreter'
import natives from 'wollok-ts/dist/wre/wre.natives'
import { buildEnvironmentForProject, failureDescription, problemDescription, successDescription, valueDescription } from '../utils'

const { time, timeEnd, log } = console

type Options = {
  project: string
  skipValidations: boolean
}

export default async function (programFQN: Name, { project, skipValidations }: Options): Promise<void> {
  log(`Running ${valueDescription(programFQN)} on ${valueDescription(project)}`)

  const environment = await buildEnvironmentForProject(project)

  if(!skipValidations) {
    const problems = validate(environment)
    problems.forEach(problem => log(problemDescription(problem)))
    if(!problems.length) log(successDescription('No problems found building the environment!'))
    else if(problems.some(_ => _.level === 'error')) return log(failureDescription('Aborting run due to validation errors!'))
  }

  log(`Running ${valueDescription(programFQN)}...`)

  try {
    time(successDescription('Run finalized successfully'))
    interpret(environment, natives).run(programFQN)
    timeEnd(successDescription('Run finalized successfully'))
  } catch (error: any) {
    log(failureDescription('Uh-oh... An error occurred during the run!', error))
  }
}