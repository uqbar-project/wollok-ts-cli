import { time, timeEnd } from 'console'
import logger from 'loglevel'
import { buildEnvironmentForProject, valueDescription, handleError, ENTER, buildEnvironmentIcon, astIcon } from '../utils'
import { Literal, Node, notEmpty, Send } from 'wollok-ts'
import { logger as fileLogger } from '../logger'
import { TimeMeasurer } from '../time-measurer'

const { log } = console

export type AstOptions = {
  project: string,
  file?: string,
  entity?: string,
}

export default async function (options: AstOptions): Promise<void> {
  try {
    const debug = logger.getLevel() <= logger.levels.DEBUG
    if (debug) time('AST process')

    const timeMeasurer = new TimeMeasurer()
    validateOptions(options)
    const { project, file, entity } = options

    logger.info(`${buildEnvironmentIcon} Building environment for ${valueDescription(project)}...`)
    const environment = await buildEnvironmentForProject(project)
    logger.info(`${astIcon} AST - [${file}] ${entity ? ` ${valueDescription(entity)}` : ''}...`)
    const baseNode = (entity || file)!
    const node = environment.getNodeOrUndefinedByFQN(baseNode)
    if (!node) throw new Error(`'${baseNode}' not found`)
    log()
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
  if (!options.file && !options.entity) throw new Error('File or entity is required')
}