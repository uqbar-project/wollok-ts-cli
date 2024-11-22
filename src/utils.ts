import { blue, bold, green, italic, red, yellow, yellowBright } from 'chalk'
import fs, { existsSync, mkdirSync } from 'fs'
import { readFile } from 'fs/promises'
import globby from 'globby'
import logger from 'loglevel'
import path, { join } from 'path'
import { getDataDiagram, VALID_IMAGE_EXTENSIONS, VALID_SOUND_EXTENSIONS } from 'wollok-web-tools'
import { buildEnvironment, Environment, getDynamicDiagramData, Interpreter, Package, Problem, validate, WOLLOK_EXTRA_STACK_TRACE_HEADER, WollokException } from 'wollok-ts'
import { ElementDefinition } from 'cytoscape'

const { time, timeEnd } = console

export const ENTER = '\n'

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// ICONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
export const programIcon = '🚀'
export const gameIcon = '👾'
export const testIcon = '🧪'
export const replIcon = '🖥️'
export const buildEnvironmentIcon = '🌏'
export const folderIcon = '🗂️'

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// FILE / PATH HANDLING
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
export function relativeFilePath(project: string, filePath: string): string {
  return path.relative(project, filePath).split('.')[0]
}

export function getFQN(project: string, filePath: string): string {
  return relativeFilePath(project, filePath).replaceAll(path.sep, '.')
}

export type FileContent = {
  name: string,
  content: string,
}

export const createFolderIfNotExists = (folder: string): void => {
  if (!existsSync(folder)) {
    mkdirSync(folder, { recursive: true })
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// ENVIRONMENT CREATION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
export async function buildEnvironmentForProject(project: string, files: string[] = []): Promise<Environment> {
  const debug = logger.getLevel() <= logger.levels.DEBUG

  const paths = files.length ? files : await globby('**/*.@(wlk|wtest|wpgm)', { cwd: project })

  if (debug) time('Reading project files')
  const environmentFiles = await Promise.all(paths.map(async name =>
    ({ name, content: await readFile(join(project, name), 'utf8') })
  ))
  if (debug) timeEnd('Reading project files')

  if (debug) time('Building environment')
  try { return buildEnvironment(environmentFiles) }
  finally { if (debug) timeEnd('Building environment') }
}

export const validateEnvironment = (environment: Environment, skipValidations: boolean = false): void => {
  if (!skipValidations) {
    try {
      const problems = validate(environment)
      problems.forEach(problem => logger.info(problemDescription(problem)))
      if (!problems.length) {
        logger.info(successDescription('No problems found building the environment!'))
      }
      else if (problems.some(_ => _.level === 'error')) {
        throw new Error('Aborting run due to validation errors!')
      }
    } catch (error: any) {
      logger.debug(error)
      throw new Error(`Fatal error while running validations. ${error.message}`)
    }
  }
}

export const handleError = (error: any): void => {
  logger.error(red(bold('💥 Uh-oh... Unexpected Error!')))
  logger.error(red(error.message.replaceAll(WOLLOK_EXTRA_STACK_TRACE_HEADER, '')))
  logger.debug(failureDescription('ℹ️ Stack trace:', error))
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PRINTING
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const valueDescription = (val: any): string => italic(blue(val))

export const successDescription = (description: string): string =>
  green(`${bold('✓')} ${description}`)

export const sanitizeStackTrace = (e?: Error): string[] => {
  const indexOfTsStack = e?.stack?.indexOf(WOLLOK_EXTRA_STACK_TRACE_HEADER)
  const fullStack = e?.stack?.slice(0, indexOfTsStack ?? -1) ?? ''

  return fullStack
    .replaceAll('\t', '  ')
    .replaceAll('     ', '  ')
    .replaceAll('    ', '  ')
    .split('\n')
    .filter(stackTraceElement => stackTraceElement.trim())
}

export const warningDescription = (description: string): string =>
  yellow(`${bold('⚠️')} ${description}`)

export const assertionError = (error: Error) =>
  error instanceof WollokException && error.instance?.module?.name === 'AssertionException'

export const failureDescription = (description: string, error?: Error): string => {
  const color = error && assertionError(error) ? yellowBright : red
  const stack = sanitizeStackTrace(error).join('\n  ')
  const sanitizedStackTrace = stack ? '\n  ' + stack : ''
  return color(`${bold('✗')} ${description}${sanitizedStackTrace}`)
}

export const problemDescription = (problem: Problem): string => {
  const color = problem.level === 'warning' ? yellowBright : red
  const header = bold(`[${problem.level.toUpperCase()}]`)
  return color(`${header}: ${problem.code} at ${problem.node?.sourceInfo ?? 'unknown'}`)
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RESOURCES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const publicPath = (...paths: string[]): string =>
  path.join(__dirname, '..', 'public', ...paths)

export const readPackageProperties = (pathProject: string): any | undefined => {
  const packagePath = path.join(pathProject, 'package.json')
  if (!fs.existsSync(packagePath)) return undefined
  return JSON.parse(fs.readFileSync(packagePath, { encoding: 'utf-8' }))
}

interface Named {
  name: string
}

const assetsExtensions = VALID_IMAGE_EXTENSIONS.concat(VALID_SOUND_EXTENSIONS)
export const isValidAsset = (file: Named): boolean => assetsExtensions.some(extension => file.name.endsWith(extension))
export const isValidImage = (file: Named): boolean => VALID_IMAGE_EXTENSIONS.some(extension => file.name.endsWith(extension))
export const isValidSound = (file: Named): boolean => VALID_SOUND_EXTENSIONS.some(extension => file.name.endsWith(extension))

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// WOLLOK AST
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export function isREPLConstant(environment: Environment, localName: string): boolean {
  return environment.replNode().isConstant(localName)
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// HTTP SERVER
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const serverError = ({ port, code }: { port: string, code: string }): void => {
  logger.info('')
  if (code === 'EADDRINUSE') {
    logger.info(yellow(bold(`⚡ We couldn't start dynamic diagram at port ${port}, because it is already in use. ⚡`)))
    // eslint-disable-next-line @stylistic/ts/quotes
    logger.info(yellow(`Please make sure you don't have another REPL session running in another terminal. \nIf you want to start another instance, you can use "--port xxxx" option, where xxxx should be any available port.`))
  } else {
    logger.info(yellow(bold(`⚡ REPL couldn't be started at port ${port}, error code ["${code}]. ⚡`)))
  }
  process.exit(13)
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// DYNAMIC DIAGRAM
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export function getDynamicDiagram(interpreter: Interpreter, rootFQN?: Package): ElementDefinition[] {
  const objects = getDynamicDiagramData(interpreter, rootFQN)
  return getDataDiagram(objects)
}