import { bold } from 'chalk'
import cors from 'cors'
import express from 'express'
import http from 'http'
import logger from 'loglevel'
import { Server, Socket } from 'socket.io'
import { Execution, interpret, Interpreter, Name, NativeFunction, Program, RuntimeValue } from 'wollok-ts'
import { eventsFor, initializeGameClient } from '../game'
import { logger as fileLogger } from '../logger'
import { buildEnvironmentCommand, buildEnvironmentIcon, buildNativesForGame, diagramIcon, DynamicDiagramClient, ENTER, failureDescription, gameIcon, getAllAssets, getAssetsFolder, getDynamicDiagram, handleError, nextPort, programIcon, publicPath, sanitizeStackTrace, serverError, successDescription, valueDescription } from '../utils'
import { TimeMeasurer } from './../time-measurer'

const { time, timeEnd } = console

export type Options = {
  project: string
  assets: string
  skipValidations: boolean
  host: string,
  port: string
  startDiagram: boolean,
}

export default async function (programFQN: Name, options: Options): Promise<undefined> {
  const { project, assets, host, port, skipValidations } = options
  let game = false
  const timeMeasurer = new TimeMeasurer()
  try {
    logger.info(`${programIcon} Running program ${valueDescription(programFQN)} on ${valueDescription(project)}`)

    logger.info(`${buildEnvironmentIcon} Building environment for ${valueDescription(programFQN)}...${ENTER}`)
    const environment = await buildEnvironmentCommand(project, skipValidations)
    const debug = logger.getLevel() <= logger.levels.DEBUG
    if (debug) time(successDescription('Run initiated successfully'))

    const serveGame: NativeFunction = function* (): Execution<RuntimeValue> {
      game = true
      const path = getAssetsFolder(project, assets)
      const ioGame = initializeGameClient(project, assets, host, port)
      const assetFiles = getAllAssets(project, path)
      configProcessForGame(programFQN, timeMeasurer, project)
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

export async function initializeDynamicDiagram(programFQN: Name, options: Options, interpreter: Interpreter): Promise<DynamicDiagramClient> {
  if (!options.startDiagram) return { onReload: () => { }, enabled: false }

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
  const currentHost = options.host
  const currentPort = nextPort(options.port)
  server.listen(parseInt(currentPort), currentHost)
  server.addListener('listening', () => {
    logger.info(`${diagramIcon} Dynamic diagram available at: ${bold(`http://${currentHost}:${currentPort}`)}`)
  })

  return {
    onReload: (_interpreter: Interpreter) =>
      io.emit('updateDiagram', getDynamicDiagram(_interpreter, programPackage)),
    enabled: true,
  }
}

const configProcessForGame = (programFQN: Name, timeMeasurer: TimeMeasurer, project: string) => {
  const logGameFinished = (exitCode: any) => {
    fileLogger.info({ message: `${gameIcon} Game executed ${programFQN} on ${project}`, timeElapsed: timeMeasurer.elapsedTime(), exitCode })
    process.exit(exitCode)
  }
  Array.from(['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM', 'SIGHUP', 'uncaughtException']).forEach((eventType: string) => {
    process.on(eventType, logGameFinished)
  })
}