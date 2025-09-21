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
import { DynamicDiagramClient, failureDescription, gameIcon, getSoundsFolder, isValidImage, isValidSound, publicPath, successDescription } from './utils.js'

const { bold } = chalk

export const initializeGameClient = (project: string, assets: string, host: string, port: string): Server => {
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

  server.listen(parseInt(port), host)
  logger.info(`${gameIcon} Game available at: ${bold(`http://${host}:${port}`)}`)

  return io
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
      logger.info(successDescription('Game finished'))
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