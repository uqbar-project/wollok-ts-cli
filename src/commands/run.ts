import { bold } from 'chalk'
import cors from 'cors'
import express from 'express'
import fs, { Dirent } from 'fs'
import http from 'http'
import logger from 'loglevel'
import { join, relative } from 'path'
import { Server } from 'socket.io'
import { Environment, link, Name, parse, RuntimeObject, WollokException } from 'wollok-ts'
import interpret, { Interpreter } from 'wollok-ts/dist/interpreter/interpreter'
import natives from 'wollok-ts/dist/wre/wre.natives'
import { ENTER, buildEnvironmentForProject, failureDescription, handleError, isImageFile, publicPath, readPackageProperties, successDescription, validateEnvironment, valueDescription } from '../utils'
import { buildKeyPressEvent, canvasResolution, Image, queueEvent, visualState, VisualState, wKeyCode } from './extrasGame'

const { time, timeEnd } = console

type Options = {
  project: string
  assets: string | undefined
  skipValidations: boolean
  port: string
  game: boolean
}

// TODO: Decouple io from getInterpreter
let timer = 0

export default async function (programFQN: Name, { project, assets, skipValidations, port, game }: Options): Promise<void> {
  try {
    logger.info(`Running ${valueDescription(programFQN)} ${game ? 'as a game' : 'as a program'} on ${valueDescription(project)}`)
    const assetsFolder = game ? getAssetsFolder(project, assets) : ''

    if (game) {
      logger.info(`Assets folder ${join(project, assetsFolder)}`)
    }

    const environment = link([drawDefinition()], await buildEnvironmentForProject(project))
    validateEnvironment(environment, skipValidations)

    logger.info(`Running ${valueDescription(programFQN)}...${ENTER}`)

    const debug = logger.getLevel() <= logger.levels.DEBUG
    if (debug) time(successDescription('Run finalized successfully'))

    let io: Server | undefined = undefined
    if (game) {
      io = initializeGameClient({ project, assetsFolder, port })
    }
    const interpreter = game ? getGameInterpreter(environment, { project, assetsFolder }, io!) : interpret(environment, { ...natives })

    interpreter.run(programFQN)

    if (game) {
      eventsFor(io!, interpreter, { project, assetsFolder })
    }

    if (debug) timeEnd(successDescription('Run finalized successfully'))

  } catch (error: any) {
    handleError(error)
    if (!game) process.exit(21)
  }
}

export const getGameInterpreter = (environment: Environment, { project, assetsFolder }: { project: string, assetsFolder: string }, io: Server): Interpreter => {
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
            io.emit('updateSound', { path: getSoundsFolder(project, assetsFolder), soundInstances: mappedSounds })
          } catch (error: any) {
            if (error instanceof WollokException) logger.error(failureDescription(error.message))
            // TODO: si no es WollokException igual deberíamos loguear un error más general
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

export const initializeGameClient = ({ project, assetsFolder, port }: { project: string, assetsFolder: string, port: string }): Server => {
  const app = express()
  const server = http.createServer(app)
  const io = new Server(server)

  app.use(
    cors({ allowedHeaders: '*' }),
    express.static(publicPath('game'), { maxAge: '1d' }),
    express.static(assetsFolder ?? project, { maxAge: '1d' }))
  server.listen(parseInt(port), 'localhost')

  logger.info(successDescription('Game available at: ' + bold(`http://localhost:${port}`)))
  server.listen(3000)
  return io
}

export const eventsFor = (io: Server, interpreter: Interpreter, { project, assetsFolder }: { project: string, assetsFolder: string }): void => {
  const sizeCanvas = canvasResolution(interpreter)
  io.on('connection', socket => {
    logger.info(successDescription('Running game!'))
    socket.on('disconnect', () => { logger.info(successDescription('Game finished')) })
    socket.on('keyPressed', key => {
      queueEvent(interpreter, buildKeyPressEvent(interpreter, wKeyCode(key.key, key.keyCode)), buildKeyPressEvent(interpreter, 'ANY'))
    })

    if (!assetsFolder) logger.warn(failureDescription('Folder for assets not found!'))
    socket.emit('images', getImages(project, assetsFolder))
    socket.emit('sizeCanvasInic', [sizeCanvas.width, sizeCanvas.height])

    const id = setInterval(() => {
      const game = interpreter?.object('wollok.game.game')
      socket.emit('cellPixelSize', game.get('cellSize')!.innerNumber!)
      try {
        interpreter.send('flushEvents', game, interpreter.reify(timer))
        timer += 300
        if (!game.get('running')) { clearInterval(id) }
      } catch (error: any) {
        interpreter.send('stop', game)
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


export const getAssetsFolder = (projectPath: string, assetsOptions: string | undefined): string => {
  const packageProperties = readPackageProperties(projectPath)
  return assetsOptions ?? packageProperties?.resourceFolder
}

const drawDefinition = () => parse.File('draw').tryParse('object drawer{ method apply() native }')