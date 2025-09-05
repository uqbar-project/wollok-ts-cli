import logger from 'loglevel'
import { Execution, interpret, Name, NativeFunction, Program, RuntimeValue } from 'wollok-ts'
import { eventsFor, initializeGameClient } from '../game.ts'
import { logger as fileLogger } from '../logger.ts'
import { buildEnvironmentCommand, buildEnvironmentIcon, buildNativesForGame, ENTER, gameIcon, getAllAssets, getAssetsFolder, handleError, initializeDynamicDiagram, nextPort, programIcon, Project, sanitizeStackTrace, successDescription, valueDescription } from '../utils.ts'
import { TimeMeasurer } from './../time-measurer.ts'

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
  const { project, assets, host, port, skipValidations, startDiagram } = options
  let game = false
  const timeMeasurer = new TimeMeasurer()
  const proj = new Project(project)

  try {
    logger.info(`${programIcon} Running program ${valueDescription(programFQN)} on ${valueDescription(project)}`)

    logger.info(`${buildEnvironmentIcon} Building environment for ${valueDescription(programFQN)}...${ENTER}`)
    const environment = await buildEnvironmentCommand(project, skipValidations)
    const debug = logger.getLevel() <= logger.levels.DEBUG
    if (debug) time(successDescription('Run initiated successfully'))

    const serveGame: NativeFunction = function* (): Execution<RuntimeValue> {
      game = true
      const path = getAssetsFolder(proj, assets)
      const ioGame = initializeGameClient(project, assets, host, port)
      const assetFiles = getAllAssets(project, path)
      configProcessForGame(programFQN, timeMeasurer, project)
      eventsFor(ioGame, interpreter, dynamicDiagramClient, assetFiles)
      return yield* this.reify(true)
    }
    const interpreter = interpret(environment, await buildNativesForGame(proj, serveGame))
    const rootPackage = interpreter.evaluation.environment.getNodeByFQN<Program>(programFQN).parent
    const dynamicDiagramClient = initializeDynamicDiagram(interpreter, { ...options, port: nextPort(port) }, rootPackage, startDiagram)

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

const configProcessForGame = (programFQN: Name, timeMeasurer: TimeMeasurer, project: string) => {
  const logGameFinished = (exitCode: any) => {
    fileLogger.info({ message: `${gameIcon} Game executed ${programFQN} on ${project}`, timeElapsed: timeMeasurer.elapsedTime(), exitCode })
    process.exit(exitCode)
  }
  Array.from(['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM', 'SIGHUP', 'uncaughtException']).forEach((eventType: string) => {
    process.on(eventType, logGameFinished)
  })
}