import { bold } from 'chalk'
import cors from 'cors'
import express from 'express'
import fs, { Dirent, existsSync } from 'fs'
import http from 'http'
import logger from 'loglevel'
import { join, relative } from 'path'
import { Server, Socket } from 'socket.io'
import { Environment, Execution, GAME_MODULE, get, interpret, Interpreter, Name, NativeFunction, Natives, Program, RuntimeObject, RuntimeValue, WollokException, WRENatives } from 'wollok-ts'
import { Asset, boardState, buildKeyPressEvent, queueEvent, SoundState, soundState, VisualState, visualState } from 'wollok-web-tools'
import { logger as fileLogger } from '../logger'
import { buildEnvironmentForProject, buildEnvironmentIcon, ENTER, failureDescription, folderIcon, gameIcon, getDynamicDiagram, handleError, isValidAsset, isValidImage, isValidSound, programIcon, publicPath, readPackageProperties, sanitizeStackTrace, serverError, successDescription, validateEnvironment, valueDescription } from '../utils'
import { DummyProfiler, EventProfiler, TimeMeasurer } from './../time-measurer'

const { time, timeEnd } = console

export type Options = {
  project: string
  assets: string
  skipValidations: boolean
  host: string,
  port: string
  startDiagram: boolean,
}

const DEFAULT_PORT = '4200'
const DEFAULT_HOST = 'localhost'

type DynamicDiagramClient = {
  onReload: () => void,
}

export default async function (programFQN: Name, options: Options): Promise<undefined> {
  const { project } = options
  let game = false
  const timeMeasurer = new TimeMeasurer()
  try {
    logger.info(`${programIcon} Running program ${valueDescription(programFQN)} on ${valueDescription(project)}`)

    logger.info(`${buildEnvironmentIcon} Building environment for ${valueDescription(programFQN)}...${ENTER}`)
    const environment = await buildEnvironmentForProgram(options)
    const debug = logger.getLevel() <= logger.levels.DEBUG
    if (debug) time(successDescription('Run initiated successfully'))

    const serveGame: NativeFunction = function* (): Execution<RuntimeValue> {
      game = true
      const assets = getAssetsFolder(options)
      const ioGame = initializeGameClient(options)
      const assetFiles = getAllAssets(project, assets)
      configProcessForGame(programFQN, timeMeasurer, options)
      eventsFor(ioGame, interpreter, dynamicDiagramClient, assetFiles)
      return yield* this.reify(true)
    }
    const interpreter = interpret(environment, buildNativesForGame(serveGame))
    const dynamicDiagramClient = await initializeDynamicDiagram(programFQN, options, interpreter)

    interpreter.run(programFQN)

    if (debug) timeEnd(successDescription('Run finalized successfully'))

    fileLogger.info({ message: `${programIcon} Program executed ${valueDescription(programFQN)} on ${valueDescription(project)}`, timeElapsed: timeMeasurer.elapsedTime(), ok: true })
    if (!game) {
      logger.info(successDescription(`Program ${valueDescription(programFQN)} finalized successfully`))
      process.exit(0)
    }
  } catch (error: any) {
    handleError(error)
    fileLogger.info({ message: `${programIcon} Program executed ${valueDescription(programFQN)} on ${valueDescription(project)}`, timeElapsed: timeMeasurer.elapsedTime(), ok: false, error: sanitizeStackTrace(error) })
    if (!game) process.exit(21)
  }
}

export const initializeGameClient = ({ project, assets, host, port }: Options): Server => {
  const app = express()
  const server = http.createServer(app)
  const io = new Server(server)

  app.use(
    cors({ allowedHeaders: '*' }),
    express.static(publicPath('game'), { maxAge: '1d' }),
    express.static(assets ? join(project, assets) : project, { maxAge: '1d' }))

  const soundsFolder = getSoundsFolder(project, assets)
  if (soundsFolder !== assets) {
    app.use(cors({ allowedHeaders: '*' }), express.static(soundsFolder, { maxAge: '1d' }))
  }

  const currentHost = gameHost(host)
  const currentPort = gamePort(port)
  server.listen(parseInt(currentPort), currentHost)

  logger.info(`${gameIcon} Game available at: ${bold(`http://${currentHost}:${currentPort}`)}`)
  server.listen(currentPort)
  return io
}

export async function initializeDynamicDiagram(programFQN: Name, options: Options, interpreter: Interpreter): Promise<DynamicDiagramClient> {
  if (!options.startDiagram) return { onReload: () => { } }

  console.log('initializeDynamicDiagram')

  const app = express()
  const server = http.createServer(app)

  server.addListener('error', serverError)

  const io = new Server(server)

  io.on('connection', (socket: Socket) => {
    logger.debug(successDescription('Connected to Dynamic diagram'))
    socket.on('disconnect', () => { logger.debug(failureDescription('Dynamic diagram closed')) })
  })

  const programPackage = interpreter.evaluation.environment.getNodeByFQN<Program>(programFQN).parent
  const connectionListener = (interpreter: Interpreter) => (socket: Socket) => {
    socket.emit('initDiagram', options)
    socket.emit('updateDiagram', getDynamicDiagram(interpreter, programPackage))
  }
  const currentConnectionListener = connectionListener(interpreter)
  io.on('connection', currentConnectionListener)

  app.use(
    cors({ allowedHeaders: '*' }),
    express.static(publicPath('diagram'), { maxAge: '1d' }),
  )
  const currentHost = gameHost(options.host!)
  const currentPort = dynamicDiagramPort(options.port!)
  server.listen(parseInt(currentPort), currentHost)
  server.addListener('listening', () => {
    logger.info(successDescription('Dynamic diagram available at: ' + bold(`http://${currentHost}:${currentPort}`)))
  })

  return {
    onReload: () => {
      io.emit('updateDiagram', getDynamicDiagram(interpreter, programPackage))
    },
  }
}

export const eventsFor = (io: Server, interpreter: Interpreter, dynamicDiagramClient: DynamicDiagramClient, assetFiles: Asset[]): void => {
  io.on('connection', socket => {
    logger.info(successDescription('Running game!'))
    socket.on('keyPressed', (events: string[]) => {
      queueEvent(interpreter as any, ...events.map(code => buildKeyPressEvent(interpreter as any, code)))
    })

    const gameSingleton = interpreter.object(GAME_MODULE)
    // wait for client to be ready
    socket.on('ready', () => {
      logger.info(successDescription('Ready!'))

      // send static data
      socket.emit('board', boardState(gameSingleton as any))
      socket.emit('images', assetFiles.filter(isValidImage))
      socket.emit('music', assetFiles.filter(isValidSound))

      // then start the game
      socket.emit('start')
    })

    const flushInterval = 17
    const profiler = logger.getLevel() >= logger.levels.DEBUG
      ? new EventProfiler(logger, 'GAME-LOOP')
      : new DummyProfiler()

    const start = new TimeMeasurer()
    const id = setInterval(() => {
      try {
        profiler.start()
        interpreter.send('flushEvents', gameSingleton, interpreter.reify(start.elapsedTime()))
        draw(interpreter, io)
        profiler.stop()

        // We could pass the interpreter but a program does not change it
        dynamicDiagramClient.onReload()
        if (!gameSingleton.get('running')?.innerBoolean) {
          clearInterval(id)
          process.exit(0)
        }
      } catch (error: any) {
        interpreter.send('stop', gameSingleton)
        socket.emit('errorDetected', error.message)
        clearInterval(id)
      }
    }, flushInterval)

    socket.on('disconnect', () => {
      clearInterval(id)
      logger.info(successDescription('Game finished'))
    })

  })
}

export const getAllAssets = (projectPath: string, assetsFolder: string): Asset[] => {
  const baseFolder = join(projectPath, assetsFolder)
  if (!existsSync(baseFolder))
    throw new Error(`Folder image ${baseFolder} does not exist`)

  const fileRelativeFor = (fileName: string) => ({ name: fileName, url: fileName })

  const loadAssetsIn = (basePath: string): Asset[] =>
    fs.readdirSync(basePath, { withFileTypes: true })
      .flatMap((file: Dirent) =>
        file.isDirectory() ? loadAssetsIn(join(basePath, file.name)) :
          isValidAsset(file) ? [fileRelativeFor(relative(baseFolder, join(basePath, file.name)))] : []
      )

  return loadAssetsIn(baseFolder)
}

export const getVisuals = (game: RuntimeObject, interpreter: Interpreter): VisualState[] =>
  (game.get('visuals')?.innerCollection ?? []).map(visual => visualState(interpreter as any, visual as any))

export const getSounds = (game: RuntimeObject): SoundState[] =>
  (game.get('sounds')?.innerCollection ?? [] as any).map(soundState)

export const getSoundsFolder = (projectPath: string, assetsOptions: string | undefined): string =>
  fs.readdirSync(projectPath).includes('sounds') ? 'sounds' : assetsOptions ?? 'assets'


export const getAssetsFolder = ({ project, assets }: Options): string => {
  const packageProperties = readPackageProperties(project)
  return packageProperties?.resourceFolder ?? assets
}

export const buildEnvironmentForProgram = async ({ project, skipValidations }: Options): Promise<Environment> => {
  const environment = await buildEnvironmentForProject(project)
  validateEnvironment(environment, skipValidations)
  return environment
}

export const gamePort = (port?: string): string => port ?? DEFAULT_PORT
export const gameHost = (host?: string): string => host ?? DEFAULT_HOST

export const dynamicDiagramPort = (port: string): string => `${+gamePort(port) + 1}`

const configProcessForGame = (programFQN: Name, timeMeasurer: TimeMeasurer, { project, assets }: Options) => {
  const logGameFinished = (exitCode: any) => {
    fileLogger.info({ message: `${gameIcon} Game executed ${programFQN} on ${project}`, timeElapsed: timeMeasurer.elapsedTime(), exitCode })
    process.exit(exitCode)
  }
  logger.info(`${folderIcon}  Assets folder ${valueDescription(join(project, assets))}`)
  Array.from(['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM', 'SIGHUP', 'uncaughtException']).forEach((eventType: string) => {
    process.on(eventType, logGameFinished)
  })
}

const draw = (interpreter: Interpreter, io: Server) => {
  const game = interpreter?.object(GAME_MODULE)
  try {
    const visuals = getVisuals(game, interpreter)
    io.emit('visuals', visuals)
    const sounds = getSounds(game)
    io.emit('sounds', sounds)
  } catch (error: any) {
    logger.error(failureDescription(error instanceof WollokException ? error.message : 'Exception while executing the program'))
    const debug = logger.getLevel() <= logger.levels.DEBUG
    if (debug) logger.error(error)
    interpreter.send('stop', game)
  }
}

const buildNativesForGame = (serve: NativeFunction): Natives => {
  const natives = { ...WRENatives }
  const io = get<Natives>(natives, 'wollok.lang.io')!
  io['serve'] = serve
  return natives
}