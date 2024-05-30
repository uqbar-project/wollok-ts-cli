import { TimeMeasurer } from './../time-measurer'
import { bold } from 'chalk'
import cors from 'cors'
import express from 'express'
import fs, { Dirent, existsSync } from 'fs'
import http from 'http'
import logger from 'loglevel'
import { join, relative } from 'path'
import { Server, Socket } from 'socket.io'
import { Environment, GAME_MODULE, link, Name, Package, parse, RuntimeObject, WollokException, interpret, Interpreter, WRENatives as natives } from 'wollok-ts'
import { ENTER, buildEnvironmentForProject, buildEnvironmentIcon, failureDescription, folderIcon, gameIcon, handleError, isImageFile, programIcon, publicPath, readPackageProperties, serverError, stackTrace, successDescription, validateEnvironment, valueDescription } from '../utils'
import { buildKeyPressEvent, canvasResolution, Image, queueEvent, visualState, VisualState, wKeyCode } from './extrasGame'
import { getDataDiagram } from '../services/diagram-generator'
import { logger as fileLogger } from '../logger'

const { time, timeEnd } = console

type Options = {
  project: string
  assets: string
  skipValidations: boolean
  host?: string,
  port?: string
  game: boolean,
  startDiagram: boolean
}

let timer = 0

const DEFAULT_PORT = '4200'
const DEFAULT_HOST = 'localhost'

type DynamicDiagramClient = {
  onReload: () => void,
}

export default async function (programFQN: Name, options: Options): Promise<void> {
  const { project, game } = options
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


    const ioGame: Server | undefined = initializeGameClient(options)
    const interpreter = game ? getGameInterpreter(environment, ioGame!) : interpret(environment, { ...natives })
    const programPackage = environment.getNodeByFQN<Package>(programFQN).parent as Package
    const dynamicDiagramClient = await initializeDynamicDiagram(programPackage, options, interpreter)

    interpreter.run(programFQN)

    eventsFor(ioGame!, interpreter, dynamicDiagramClient, options)

    if (debug) timeEnd(successDescription('Run finalized successfully'))

    if (!game) {
      fileLogger.info({ message: `${programIcon} Program executed ${programFQN} on ${project}`, timeElapsed: timeMeasurer.elapsedTime(), ok: true })
      process.exit(0)
    }
  } catch (error: any) {
    handleError(error)
    fileLogger.info({ message: `${game ? gameIcon : programIcon} ${game ? 'Game' : 'Program'} executed ${programFQN} on ${project}`, timeElapsed: timeMeasurer.elapsedTime(), ok: false, error: stackTrace(error) })
    if (!game) {
      process.exit(21)
    }
  }
}

export const getGameInterpreter = (environment: Environment, io: Server): Interpreter => {
  const nativesAndDraw = {
    ...natives,
    draw: {
      drawer: {
        *apply() {
          try {
            const game = interpreter?.object('wollok.game.game')
            const visuals = getVisuals(game, interpreter)
            io.emit('visuals', visuals)

            const gameSounds = game.get('sounds')?.innerCollection ?? []
            const mappedSounds = gameSounds.map(sound =>
              [
                sound.id,
                sound.get('file')!.innerString!,
                sound.get('status')!.innerString!,
                sound.get('volume')!.innerNumber!,
                sound.get('loop')!.innerBoolean!,
              ])
            io.emit('updateSound', { soundInstances: mappedSounds })
          } catch (error: any) {
            logger.error(failureDescription(error instanceof WollokException ? error.message : 'Exception while executing the program'))
            const debug = logger.getLevel() <= logger.levels.DEBUG
            if (debug) logger.error(error)
            interpreter.send('stop', gameSingleton)
          }
        },
      },
    },
  }

  const interpreter = interpret(environment, nativesAndDraw)

  const gameSingleton = interpreter?.object(GAME_MODULE)
  const drawer = interpreter.object('draw.drawer')
  interpreter.send('onTick', gameSingleton, interpreter.reify(17), interpreter.reify('renderizar'), drawer)

  return interpreter
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
  if (!options.startDiagram || !options.game) return { onReload: () => {} }

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
    socket.emit('updateDiagram', getDataDiagram(interpreter, programPackage))
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
      io.emit('updateDiagram', getDataDiagram(interpreter, programPackage))
    },
  }
}

export const eventsFor = (io: Server, interpreter: Interpreter, dynamicDiagramClient: DynamicDiagramClient, { game, project, assets }: Options): void => {
  if (!game) return
  const sizeCanvas = canvasResolution(interpreter)

  io.on('connection', socket => {
    logger.info(successDescription('Running game!'))
    socket.on('keyPressed', key => {
      queueEvent(interpreter, buildKeyPressEvent(interpreter, wKeyCode(key.key, key.keyCode)), buildKeyPressEvent(interpreter, 'ANY'))
    })

    const gameSingleton = interpreter?.object('wollok.game.game')
    const background = gameSingleton.get('boardGround') ? gameSingleton.get('boardGround')?.innerString : 'default'

    const baseFolder = join(project, assets)
    if (!existsSync(baseFolder))
      logger.warn(failureDescription(`Resource folder for images not found: ${assets}`))

    // send assets only when frontend is ready
    socket.on('ready', () => {
      logger.info(successDescription('Ready!'))
      socket.emit('images', getImages(project, assets))
      socket.emit('sizeCanvasInic', [sizeCanvas.width, sizeCanvas.height])
      socket.emit('cellPixelSize', gameSingleton.get('cellSize')!.innerNumber!)
      socket.emit('background', background)
    })

    const flushInterval = 100
    const id = setInterval(() => {
      try {
        interpreter.send('flushEvents', gameSingleton, interpreter.reify(timer))
        timer += flushInterval
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

export const getImages = (projectPath: string, assetsFolder: string): Image[] => {
  const baseFolder = join(projectPath, assetsFolder)
  if (!existsSync(baseFolder))
    throw `Folder image ${baseFolder} does not exist`

  const fileRelativeFor = (fileName: string) => ({ name: fileName, url: fileName })

  const loadImagesIn = (basePath: string): Image[] =>
    fs.readdirSync(basePath, { withFileTypes: true })
      .flatMap((file: Dirent) =>
        file.isDirectory() ? loadImagesIn(join(basePath, file.name)) :
        isImageFile(file) ? [fileRelativeFor(relative(baseFolder, join(basePath, file.name)))] : []
      )

  return loadImagesIn(baseFolder)
}

export const getVisuals = (game: RuntimeObject, interpreter: Interpreter): VisualState[] =>
  (game.get('visuals')?.innerCollection ?? []).map(visual => {
    const { image, position, message } = visualState(interpreter, visual)
    const messageTime = Number(visual.get('messageTime')?.innerValue)
    const messageForVisual = message != undefined && messageTime > timer ? message : undefined
    return { 'image': image, 'position': position, 'message': messageForVisual }
  })


export const getSoundsFolder = (projectPath: string, assetsOptions: string | undefined): string =>
  fs.readdirSync(projectPath).includes('sounds') ? 'sounds' : assetsOptions ?? 'assets'


export const getAssetsFolder = ({ game, project, assets }: Options): string => {
  if (!game) return ''
  const packageProperties = readPackageProperties(project)
  return packageProperties?.resourceFolder ?? assets
}

export const buildEnvironmentForProgram = async ({ project, skipValidations, game }: Options): Promise<Environment> => {
  let environment = await buildEnvironmentForProject(project)
  if (game) {
    environment = link([drawDefinition()], environment)
  }
  validateEnvironment(environment, skipValidations)
  return environment
}

export const runner = (game: boolean): string => game ? 'as a game' : 'as a program'

export const gamePort = (port: string): string => port ?? DEFAULT_PORT
export const gameHost = (host: string): string => host ?? DEFAULT_HOST

export const dynamicDiagramPort = (port: string): string => `${+gamePort(port) + 1}`

const drawDefinition = () => parse.File('draw').tryParse('object drawer{ method apply() native }')