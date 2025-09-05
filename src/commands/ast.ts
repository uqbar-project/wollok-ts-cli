import { time, timeEnd } from 'console'
import logger from 'loglevel'
import { buildEnvironmentForProject, valueDescription, handleError, ENTER, buildEnvironmentIcon, astIcon } from '../utils.js'
import { Literal, Node, notEmpty, Send } from 'wollok-ts'
import { logger as fileLogger } from '../logger.js'
import { TimeMeasurer } from '../time-measurer.js'

export type AstOptions = {
  project: string,
  entityFQN?: string,
}

export default async function (options: AstOptions): Promise<void> {
  try {
    const debug = logger.getLevel() <= logger.levels.DEBUG
    if (debug) time('AST process')

    const timeMeasurer = new TimeMeasurer()
    validateOptions(options)
    const { project, entityFQN } = options

    logger.info(`${buildEnvironmentIcon} Building environment for ${valueDescription(project)}...`)
    const environment = await buildEnvironmentForProject(project)
    const node = entityFQN ? environment.getNodeByFQN(entityFQN) : environment
    logger.info(`${astIcon} AST - [${valueDescription(node)}]...`)
    if (debug) timeEnd('AST process')

    const astResult = ast(node)
    fileLogger.info({ message: 'AST executed', options, result: { ast: astResult }, timeElapsed: timeMeasurer.elapsedTime() })

    logger.info(
      JSON.stringify(astResult, null, 2),
      ENTER,
    )
    process.exit(0)
  } catch (error: any) {
    handleError(error)
    return process.exit(1)
  }
}

type astResult = {
  nodeType: string,
  name?: string,
  value?: string,
  children?: astResult[],
}

const ast = (node: Node): astResult => {
  return {
    nodeType: node.constructor.name,
    ...'name' in node && { name: node.name as string },
    ...node instanceof Literal && { value: node.value as string },
    ...node instanceof Send && { message: node.message as string },
    ...notEmpty(node.children) && { children: node.children.map(ast) },
  }
}

const validateOptions = (options: AstOptions): void => {
  if (!options.project) throw new Error('Project path is required')
}