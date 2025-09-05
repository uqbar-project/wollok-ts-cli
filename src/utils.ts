import chalk from 'chalk'
import cors from 'cors'
import { ElementDefinition } from 'cytoscape'
import express from 'express'
import fs, { Dirent, existsSync, mkdirSync } from 'fs'
import { readFile } from 'fs/promises'
import { globby } from 'globby'
import http from 'http'
import logger from 'loglevel'
import path, { join, relative } from 'path'
import { Server, Socket } from 'socket.io'
import { buildEnvironment, Environment, get, getDynamicDiagramData, getMessage, Interpreter, List, NativeFunction, Natives, Node, natives, Package, Problem, validate, WOLLOK_EXTRA_STACK_TRACE_HEADER, WollokException, isEmpty } from 'wollok-ts'
import { Asset, getDataDiagram, VALID_IMAGE_EXTENSIONS, VALID_SOUND_EXTENSIONS } from 'wollok-web-tools'
import { fileURLToPath } from 'url'


const { time, timeEnd } = console
const { blue, bold, green, italic, red, yellow, yellowBright } = chalk

export const ENTER = '\n'

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// ICONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
export const programIcon = '🚀'
export const gameIcon = '👾'
export const testIcon = '🧪'
export const replIcon = '🖥️'
export const buildEnvironmentIcon = '🌏'
export const lintIcon = '🔦'
export const astIcon = '🌲'
export const folderIcon = '🗂️'
export const diagramIcon = '🔀'
export const errorIcon = '❌'
export const warningIcon = '⚠️'

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// FILE / PATH HANDLING
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export class Project {
  private _properties?: any

  constructor(public readonly project: string) { }

  get sourceFolder(): string {
    return this.project
  }

  get packageJsonPath(): string {
    return path.join(this.sourceFolder, 'package.json')
  }

  get properties(): any {
    if (this._properties === undefined) {
      this._properties = this.safeLoadJson()
    }
    return this._properties
  }

  private safeLoadJson(): any {
    try {
      const rawData = fs.readFileSync(this.packageJsonPath, 'utf-8')
      return JSON.parse(rawData)
    } catch (error) {
      logger.warn(`Failed to load package.json: ${error}`)
      return {}
    }
  }

  get nativesFolder(): string {
    return join(this.sourceFolder, this.properties.natives || '')
  }

  public async readNatives(): Promise<Natives> {
    return readNatives(this.nativesFolder)
  }

}

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

  const paths = files.length ? files : await globby(['**/*.wlk', '**/*.wtest', '**/*.wpgm'], { cwd: project })

  if (debug) time('Reading project files')
  const environmentFiles = await Promise.all(paths.map(async name =>
    ({ name, content: await readFile(join(project, name), 'utf8') })
  ))
  if (debug) timeEnd('Reading project files')

  if (debug) time('Building environment')
  try { return buildEnvironment(environmentFiles) }
  finally { if (debug) timeEnd('Building environment') }
}

export enum ValidationAction {
  SKIP_VALIDATION,
  RETURN_ERRORS,
  THROW_ON_ERRORS
}

export const validateEnvironment = (node: Node, validationAction = ValidationAction.SKIP_VALIDATION): List<Problem> => {
  if (validationAction === ValidationAction.SKIP_VALIDATION) {
    return []
  }
  try {
    const problems = validate(node)
    problems.forEach(problem => logger.info(problemDescription(problem)))
    if (!problems.length) {
      logger.info(successDescription('No problems found building the environment!'))
    }
    else if (validationAction === ValidationAction.THROW_ON_ERRORS && problems.some(_ => _.level === 'error')) {
      throw new Error('Aborting run due to validation errors!')
    }
    const errors = problems.filter(problem => problem.level === 'error')
    const warnings = problems.filter(problem => problem.level === 'warning')
    const allErrors = errors.concat(warnings)
    const isOk = isEmpty(allErrors)
    const singularOrPlural = (count: number): string => count === 1 ? '' : 's'
    logger.info(
      isOk ? successDescription('No errors or warnings found!') : `${errorIcon} ${errors.length} Error${singularOrPlural(errors.length)}, ${warningIcon} ${warnings.length} Warning${singularOrPlural(warnings.length)}`,
      ENTER,
    )
    return problems
  } catch (error: any) {
    logger.debug(error)
    throw new Error(`Fatal error while running validations. ${error.message}`)
  }
}

export const buildEnvironmentCommand = async (project: string, skipValidations = false): Promise<Environment> => {
  const environment = await buildEnvironmentForProject(project)
  validateEnvironment(environment, skipValidations ? ValidationAction.SKIP_VALIDATION : ValidationAction.THROW_ON_ERRORS)
  return environment
}

export const handleError = (error: any): void => {
  logger.error(red(bold('💥 Uh-oh... Unexpected Error!')))
  logger.error(red(error.message.replaceAll(WOLLOK_EXTRA_STACK_TRACE_HEADER, '')))
  logger.debug(failureDescription('ℹ️ Stack trace:', error))
}

export async function readNatives(nativeFolder: string): Promise<Natives> {
  const paths = await globby(['**/*.js', '**/*.cjs', '**/*.js'], { cwd: nativeFolder })

  const debug = logger.getLevel() <= logger.levels.DEBUG

  if (debug) time('Loading natives files')

  const nativesObjects: List<Natives> = await Promise.all(
    paths.map(async (filePath) => {
      const fullPath = path.resolve(nativeFolder, filePath)
      const importedModule = await import(fullPath)
      const segments = filePath.replace(/\.(ts|js)$/, '').split(path.sep)

      return segments.reduceRight((acc, segment) => { return { [segment]: acc } }, importedModule.default || importedModule)
    })
  )
  if (debug) timeEnd('Loading natives files')

  return natives(nativesObjects)
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
  yellow(`${bold(warningIcon)} ${description}`)

export const assertionError = (error: Error): boolean =>
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
  return color(`${header}: ${getMessage({ message: problem.code, values: problem.values.concat() })} at ${problem.node?.sourceInfo ?? 'unknown'}`)
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RESOURCES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const publicPath = (...paths: string[]): string => {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  return path.join(__dirname, '..', 'public', ...paths)
}

interface Named {
  name: string
}

const assetsExtensions = VALID_IMAGE_EXTENSIONS.concat(VALID_SOUND_EXTENSIONS)
export const isValidAsset = (file: Named): boolean => assetsExtensions.some(extension => file.name.endsWith(extension))
export const isValidImage = (file: Named): boolean => VALID_IMAGE_EXTENSIONS.some(extension => file.name.endsWith(extension))
export const isValidSound = (file: Named): boolean => VALID_SOUND_EXTENSIONS.some(extension => file.name.endsWith(extension))

export const validateName = (name: string): void => {
  if (!name.length) {
    throw new Error('Name cannot be empty')
  }
  if (!name.match(/^[A-Za-z][A-Za-z0-9_-]*$/g)) {
    throw new Error(`Invalid name: [${name}]`)
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// WOLLOK AST
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export function isREPLConstant(environment: Environment, localName: string): boolean {
  return environment.replNode().isConstant(localName)
}

// TODO: Use the merge function
export const buildNativesForGame = async (project: Project, serve: NativeFunction): Promise<Natives> => {
  const natives = await project.readNatives()
  const io = get<Natives>(natives, 'wollok.lang.io')!
  io['serve'] = serve
  return natives
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

export const nextPort = (port: string): string => `${+port + 1}`

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// DYNAMIC DIAGRAM
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export type DynamicDiagramClient = {
  onReload: (interpreter: Interpreter) => void,
  enabled: boolean,
  server?: http.Server, // only for testing purposes
}

export function getDynamicDiagram(interpreter: Interpreter, rootFQN?: Package): ElementDefinition[] {
  const objects = getDynamicDiagramData(interpreter, rootFQN)
  return getDataDiagram(objects)
}

export type DynamicDiagramOptions = {
  host: string
  port: string
}

export function initializeDynamicDiagram(_interpreter: Interpreter, options: DynamicDiagramOptions, rootPackage: Package, startDiagram = true): DynamicDiagramClient {
  if (!startDiagram) return { onReload: () => { }, enabled: false }

  const { host, port } = options
  let interpreter = _interpreter

  const app = express()
  const server = http.createServer(app)
  const io = new Server(server)

  io.on('connection', (socket: Socket) => {
    logger.debug(successDescription('Connected to Dynamic diagram'))
    socket.on('disconnect', () => { logger.debug(failureDescription('Dynamic diagram closed')) })
    // INITITALIZATION
    socket.emit('initDiagram', options)
    socket.emit('updateDiagram', getDynamicDiagram(interpreter, rootPackage))
  })

  app.use(
    cors({ allowedHeaders: '*' }),
    express.static(publicPath('diagram'), { maxAge: '1d' }),
  )

  server.addListener('error', serverError)
  server.addListener('listening', () => {
    logger.info(`${diagramIcon} Dynamic diagram available at: ${bold(`http://${host}:${port}`)}`)
  })

  server.listen(parseInt(port), host)

  return {
    onReload: (maybeNewinterpreter: Interpreter) => {
      if (interpreter !== maybeNewinterpreter) interpreter = maybeNewinterpreter
      io.emit('updateDiagram', getDynamicDiagram(interpreter, rootPackage))
    },
    enabled: true,
    server,
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// WOLLOK GAME
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const getAssetsFolder = (project: Project, assets: string): string => assets || project.properties.resourceFolder || ''

export const getSoundsFolder = (projectPath: string, assetsOptions: string): string =>
  fs.readdirSync(projectPath).includes('sounds') ? 'sounds' : assetsOptions

export const getAllAssets = (projectPath: string, assetsFolder: string): Asset[] => {
  const baseFolder = join(projectPath, assetsFolder)
  if (!existsSync(baseFolder))
    throw new Error(`Folder image ${baseFolder} does not exist`)

  logger.info(`${folderIcon}  Assets folder ${valueDescription(baseFolder)}`)

  const fileRelativeFor = (fileName: string) => ({ name: fileName, url: fileName })

  const loadAssetsIn = (basePath: string): Asset[] =>
    fs.readdirSync(basePath, { withFileTypes: true })
      .flatMap((file: Dirent) =>
        file.isDirectory() ? loadAssetsIn(join(basePath, file.name)) :
        isValidAsset(file) ? [fileRelativeFor(relative(baseFolder, join(basePath, file.name)))] : []
      )

  return loadAssetsIn(baseFolder)
}