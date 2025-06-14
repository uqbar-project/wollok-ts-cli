import { time, timeEnd } from 'console'
import logger from 'loglevel'
import { getMessage, Problem, validate } from 'wollok-ts'
import { buildEnvironmentForProject, successDescription, valueDescription, handleError, ENTER, buildEnvironmentIcon, problemDescription, lintIcon, errorIcon, warningIcon } from '../utils'
import { logger as fileLogger } from '../logger'
import { TimeMeasurer } from '../time-measurer'

const { log } = console

export type LinterOptions = {
  project: string,
  file?: string,
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
    const { project, file } = options

    logger.info(`${buildEnvironmentIcon} Building environment for ${valueDescription(project)}...`)
    const environment = await buildEnvironmentForProject(project)
    logger.info(`${lintIcon} Linting ${file ? `file ${valueDescription(file)}` : 'all files'}...`)
    if (file && !environment.getNodeOrUndefinedByFQN(file)) throw new Error(`File '${file}' not found`)
    const problems = validate(file ? environment.getNodeOrUndefinedByFQN(file)! : environment)
    log()
    if (debug) timeEnd('Linter process')

    const errors = problems.filter(problem => problem.level === 'error')
    const warnings = problems.filter(problem => problem.level === 'warning')
    const allErrors = errors.concat(warnings)
    const isOk = allErrors.length === 0
    fileLogger.info({ message: 'Linter executed', options, result: { problems: allErrors.map(linterProblem), isOk }, timeElapsed: timeMeasurer.elapsedTime() })

    const singularOrPlural = (count: number): string => count === 1 ? '' : 's'
    logger.info(
      isOk ? successDescription('No errors or warnings found!') : `${errorIcon} ${errors.length} Error${singularOrPlural(errors.length)}, ${warningIcon} ${warnings.length} Warning${singularOrPlural(warnings.length)}`,
      ENTER,
    )

    if (!isOk) {
      allErrors.forEach(problem => {
        logger.info(problemDescription(problem))
      })
      process.exit(2)
    }
    process.exit(0)
  } catch (error: any) {
    handleError(error)
    return process.exit(1)
  }
}