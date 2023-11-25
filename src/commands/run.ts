import { bold } from 'chalk'
import cors from 'cors'
import express from 'express'
import fs, { Dirent } from 'fs'
import http from 'http'
import logger from 'loglevel'
import { join, relative } from 'path'
import { Server, Socket } from 'socket.io'
import { Environment, link, Name, Package, parse, RuntimeObject, WollokException } from 'wollok-ts'
import interpret, { Interpreter } from 'wollok-ts/dist/interpreter/interpreter'
import natives from 'wollok-ts/dist/wre/wre.natives'
import { ENTER, buildEnvironmentForProject, failureDescription, handleError, isImageFile, publicPath, readPackageProperties, serverError, successDescription, validateEnvironment, valueDescription } from '../utils'
import { buildKeyPressEvent, canvasResolution, Image, queueEvent, visualState, VisualState, wKeyCode } from './extrasGame'
import { getDataDiagram } from '../services/diagram-generator'

const { time, timeEnd } = console

type Options = {
  project: string
  assets?: string
  skipValidations: boolean
  port?: string
  game: boolean,
  startDiagram: boolean
}

// TODO: Decouple io from getInterpreter
let timer = 0

const DEFAULT_PORT = '4200'

type DynamicDiagramClient = {
  onReload: () => void,
}

export default async function (programFQN: Name, options: Options): Promise<void> {
  const { project, game } = options
  try {
    logger.info(`Running ${valueDescription(programFQN)} ${runner(game)} on ${valueDescription(project)}`)
    options.assets = game ? getAssetsFolder(options) : ''
    if (game) {
      logger.info(`Assets folder ${join(project, options.assets)}`)
    }

    logger.info(`Building environment for ${valueDescription(programFQN)}...${ENTER}`)
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

    if (!game) process.exit(0)
  } catch (error: any) {
    handleError(error)
    if (!game) process.exit(21)
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
            const background = game.get('boardGround') ? game.get('boardGround')?.innerString : 'default'
            const visuals = getVisuals(game, interpreter)
            io.emit('background', background)
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

  const gameSingleton = interpreter?.object('wollok.game.game')
  const drawer = interpreter.object('draw.drawer')
  interpreter.send('onTick', gameSingleton, interpreter.reify(17), interpreter.reify('renderizar'), drawer)

  return interpreter
}

export const initializeGameClient = ({ project, assets, port, game }: Options): Server | undefined => {
  if (!game) return undefined

  const app = express()
  const server = http.createServer(app)
  const io = new Server(server)

  app.use(
    cors({ allowedHeaders: '*' }),
    express.static(publicPath('game'), { maxAge: '1d' }),
    express.static(assets ?? project, { maxAge: '1d' }))

  const soundsFolder = getSoundsFolder(project, assets)
  if (soundsFolder !== assets) {
    app.use(cors({ allowedHeaders: '*' }), express.static(soundsFolder, { maxAge: '1d' }))
  }

  const currentPort = gamePort(port!)
  server.listen(parseInt(currentPort), 'localhost')

  logger.info(successDescription('Game available at: ' + bold(`http://localhost:${currentPort}`)))
  server.listen(currentPort)
  return io
}

// TODO: change to an object with a reload function
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
  const currentPort = dynamicDiagramPort(options.port!)
  server.listen(parseInt(currentPort), 'localhost')
  server.addListener('listening', () => {
    logger.info(successDescription('Dynamic diagram available at: ' + bold(`http://localhost:${currentPort}`)))
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
    socket.on('disconnect', () => { logger.info(successDescription('Game finished')) })
    socket.on('keyPressed', key => {
      queueEvent(interpreter, buildKeyPressEvent(interpreter, wKeyCode(key.key, key.keyCode)), buildKeyPressEvent(interpreter, 'ANY'))
    })

    if (!assets) logger.warn(failureDescription('Folder for assets not found!'))
    socket.emit('images', getImages(project, assets))
    socket.emit('sizeCanvasInic', [sizeCanvas.width, sizeCanvas.height])

    const id = setInterval(() => {
      const gameSingleton = interpreter?.object('wollok.game.game')
      socket.emit('cellPixelSize', gameSingleton.get('cellSize')!.innerNumber!)
      try {
        interpreter.send('flushEvents', gameSingleton, interpreter.reify(timer))
        timer += 300
        // We can pass the interpreter but a program does not change it
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
    }, 100)
  })
}

export const getImages = (projectPath: string, assetsFolder: string | undefined): Image[] => {
  const images: Image[] = []
  const baseFolder = assetsFolder ?? projectPath
  const loadImagesIn = (basePath: string) => fs.readdirSync(basePath, { withFileTypes: true })
    .forEach((file: Dirent) => {
      if (file.isDirectory()) loadImagesIn(join(basePath, file.name))
      else if (isImageFile(file)) {
        const fileName = relative(baseFolder, join(basePath, file.name))
        images.push({ name: fileName, url: fileName })
      }
    })
  loadImagesIn(baseFolder)
  return images
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
  return assets ?? packageProperties?.resourceFolder
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

export const dynamicDiagramPort = (port: string): string => `${+gamePort(port) + 1}`

const drawDefinition = () => parse.File('draw').tryParse('object drawer{ method apply() native }')