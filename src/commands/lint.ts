import { time, timeEnd } from 'console'
import logger from 'loglevel'
import { getMessage, isEmpty, Problem } from 'wollok-ts'
import { buildEnvironmentForProject, valueDescription, handleError, buildEnvironmentIcon, lintIcon, validateEnvironment, ValidationAction } from '../utils'
import { logger as fileLogger } from '../logger'
import { TimeMeasurer } from '../time-measurer'

export type LinterOptions = {
  project: string,
  entityFQN?: string,
}

export type LinterProblem = {
  file: string,
  message: string,
  level: 'error' | 'warning',
  line: number | undefined,
}

const linterProblem = (problem: Problem): LinterProblem => ({
  level: problem.level,
  message: getMessage({ message: problem.code, values: problem.values.concat() }),
  file: problem.node.sourceFileName ?? 'unknown',
  line: problem.node.sourceMap?.start.line,
})

export default async function (options: LinterOptions): Promise<void> {
  try {
    const debug = logger.getLevel() <= logger.levels.DEBUG
    if (debug) time('Linter process')

    const timeMeasurer = new TimeMeasurer()
    const { project, entityFQN } = options

    logger.info(`${buildEnvironmentIcon} Building environment for ${valueDescription(project)}...`)
    const environment = await buildEnvironmentForProject(project)
    const node = entityFQN ? environment.getNodeByFQN(entityFQN) : environment
    logger.info(`${lintIcon} Linting ${entityFQN ? `entity ${valueDescription(entityFQN)}` : 'all files'}...`)
    const problems = validateEnvironment(node, ValidationAction.RETURN_ERRORS)
    const isOk = isEmpty(problems)
    fileLogger.info({ message: 'Linter executed', options, result: { problems: problems.map(linterProblem), isOk }, timeElapsed: timeMeasurer.elapsedTime() })
    if (debug) timeEnd('Linter process')
    process.exit(isOk ? 0 : 2)
  } catch (error: any) {
    handleError(error)
    return process.exit(1)
  }
}