import chalk from 'chalk'
import cors from 'cors'
import express from 'express'
import http from 'http'
import logger from 'loglevel'
import { join } from 'path'
import { Server } from 'socket.io'
import { GAME_MODULE, Interpreter, RuntimeObject, WollokException } from 'wollok-ts'
import { Asset, boardState, buildKeyPressEvent, queueEvent, SoundState, soundState, VisualState, visualState } from 'wollok-web-tools'
import { DummyProfiler, EventProfiler, TimeMeasurer } from './time-measurer.js'
import { imageIcon, DynamicDiagramClient, ENTER, failureDescription, folderIcon, gameIcon, getSoundsFolder, isValidImage, isValidSound, publicPath, successDescription, valueDescription, boardIcon, soundIcon, keyboardIcon } from './utils.js'

const { bold } = chalk

export const initializeGameClient = (project: string, assets: string, host: string, port: string): Server => {
  const app = express()
  const server = http.createServer(app)
  const io = new Server(server)
  const assetsPath = assets ? join(project, assets) : project

  app.use(
    cors({ allowedHeaders: '*' }),
    express.static(publicPath('game'), { maxAge: '1d' }),
    express.static(assetsPath, { maxAge: '1d' }))

  logger.info(`${folderIcon} Serving assets from ${valueDescription(assetsPath)}`)

  // Is this valid?
  const soundsFolder = getSoundsFolder(project, assets)
  if (soundsFolder !== assets) {
    app.use(cors({ allowedHeaders: '*' }), express.static(soundsFolder, { maxAge: '1d' }))
    logger.info(`${folderIcon} Serving sounds from: ${valueDescription(assetsPath)}`)
  }

  server.listen(parseInt(port), host)
  logger.info(`${ENTER}${gameIcon} Game available at ${bold(`http://${host}:${port}`)}`)

  return io
}

export const eventsFor = (io: Server, interpreter: Interpreter, dynamicDiagramClient: DynamicDiagramClient, assetFiles: Asset[]): void => {
  io.on('connection', socket => {
    logger.info(successDescription('New connection!'))

    socket.on('keyPressed', (events: string[]) => {
      logger.debug(`${keyboardIcon} Key pressed: ${JSON.stringify(events, null, 2)}`)
      queueEvent(interpreter as any, ...events.map(code => buildKeyPressEvent(interpreter as any, code)))
    })

    const gameSingleton = interpreter.object(GAME_MODULE)
    // wait for client to be ready
    socket.on('ready', () => {
      logger.debug(successDescription('Client ready!'))

      // send static data
      const board = boardState(gameSingleton as any)
      logger.debug(`${boardIcon} Sending board: ${JSON.stringify(board, null, 2)}`)
      socket.emit('board', board)

      const images = assetFiles.filter(isValidImage)
      socket.emit('images', images)
      logger.debug(`${imageIcon} Sending images: ${JSON.stringify(images, null, 2)}`)

      const sounds = assetFiles.filter(isValidSound)
      socket.emit('music', sounds)
      logger.debug(`${soundIcon} Sending sounds: ${JSON.stringify(sounds, null, 2)}`)

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

        dynamicDiagramClient.onReload(interpreter)
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
      logger.info(successDescription('Game closed'))
    })

  })
}

export const getVisuals = (game: RuntimeObject, interpreter: Interpreter): VisualState[] =>
  (game.get('visuals')?.innerCollection ?? []).map(visual => visualState(interpreter as any, visual as any))

export const getSounds = (game: RuntimeObject): SoundState[] =>
  (game.get('sounds')?.innerCollection ?? [] as any).map(soundState)

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