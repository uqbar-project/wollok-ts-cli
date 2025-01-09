import { bold } from 'chalk'
import cors from 'cors'
import express from 'express'
import fs, { Dirent, existsSync } from 'fs'
import http from 'http'
import logger from 'loglevel'
import { join, relative } from 'path'
import { Server, Socket } from 'socket.io'
import { Asset, boardState, buildKeyPressEvent, queueEvent, SoundState, soundState, VisualState, visualState } from 'wollok-web-tools'
import { Environment, GAME_MODULE, interpret, Interpreter, Name, Package, RuntimeObject, WollokException, WRENatives as natives } from 'wollok-ts'
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
  game: boolean,
  startDiagram: boolean,
}

const DEFAULT_PORT = '4200'
const DEFAULT_HOST = 'localhost'

type DynamicDiagramClient = {
  onReload: () => void,
}

export default async function (programFQN: Name, options: Options): Promise<Server | undefined> {
  const { game, project, assets } = options
  const timeMeasurer = new TimeMeasurer()
  try {
    logger.info(`${game ? gameIcon : programIcon} Running program ${valueDescription(programFQN)} ${runner(game)} on ${valueDescription(project)}`)
    options.assets = game ? getAssetsFolder(options) : ''
    if (game) {
      const logGameFinished = (exitCode: any) => {
        fileLogger.info({ message: `${gameIcon} Game executed ${programFQN} on ${project}`, timeElapsed: timeMeasurer.elapsedTime(), exitCode })
        process.exit(exitCode)
      }
      logger.info(`${folderIcon}  Assets folder ${join(project, options.assets)}`)
      Array.from(['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM', 'SIGHUP', 'uncaughtException']).forEach((eventType: string) => {
        process.on(eventType, logGameFinished)
      })
    }

    logger.info(`${buildEnvironmentIcon} Building environment for ${valueDescription(programFQN)}...${ENTER}`)
    const environment = await buildEnvironmentForProgram(options)
    const debug = logger.getLevel() <= logger.levels.DEBUG
    if (debug) time(successDescription('Run initiated successfully'))
    const assetFiles = getAllAssets(project, assets)

    const interpreter = game ? getGameInterpreter(environment) : interpret(environment, { ...natives })
    const programPackage = environment.getNodeByFQN<Package>(programFQN).parent as Package
    const dynamicDiagramClient = await initializeDynamicDiagram(programPackage, options, interpreter)
    const ioGame: Server | undefined = initializeGameClient(options)

    interpreter.run(programFQN)

    if (game) {
      eventsFor(ioGame!, interpreter, dynamicDiagramClient, assetFiles)
    }

    if (debug) timeEnd(successDescription('Run finalized successfully'))

    if (!game) {
      fileLogger.info({ message: `${programIcon} Program executed ${programFQN} on ${project}`, timeElapsed: timeMeasurer.elapsedTime(), ok: true })
      process.exit(0)
    }

    return ioGame
  } catch (error: any) {
    handleError(error)
    fileLogger.info({ message: `${game ? gameIcon : programIcon} ${game ? 'Game' : 'Program'} executed ${programFQN} on ${project}`, timeElapsed: timeMeasurer.elapsedTime(), ok: false, error: sanitizeStackTrace(error) })
    if (!game) { process.exit(21) }
  }
}

export const getGameInterpreter = (environment: Environment): Interpreter => {
  return interpret(environment, natives)
}

export const initializeGameClient = ({ project, assets, host, port, game }: Options): Server | undefined => {
  if (!game) return undefined

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

  const currentHost = gameHost(host!)
  const currentPort = gamePort(port!)
  server.listen(parseInt(currentPort), currentHost)

  logger.info(successDescription('Game available at: ' + bold(`http://${currentHost}:${currentPort}`)))
  server.listen(currentPort)
  return io
}

export async function initializeDynamicDiagram(programPackage: Package, options: Options, interpreter: Interpreter): Promise<DynamicDiagramClient> {
  if (!options.startDiagram || !options.game) return { onReload: () => { } }

  const app = express()
  const server = http.createServer(app)

  server.addListener('error', serverError)

  const io = new Server(server)

  io.on('connection', (socket: Socket) => {
    logger.debug(successDescription('Connected to Dynamic diagram'))
    socket.on('disconnect', () => { logger.debug(failureDescription('Dynamic diagram closed')) })
  })
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


export const getAssetsFolder = ({ game, project, assets }: Options): string => {
  if (!game) return ''
  const packageProperties = readPackageProperties(project)
  return packageProperties?.resourceFolder ?? assets
}

export const buildEnvironmentForProgram = async ({ project, skipValidations }: Options): Promise<Environment> => {
  const environment = await buildEnvironmentForProject(project)
  validateEnvironment(environment, skipValidations)
  return environment
}

export const runner = (game: boolean): string => game ? 'as a game' : 'as a program'

export const gamePort = (port: string): string => port ?? DEFAULT_PORT
export const gameHost = (host: string): string => host ?? DEFAULT_HOST

export const dynamicDiagramPort = (port: string): string => `${+gamePort(port) + 1}`

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