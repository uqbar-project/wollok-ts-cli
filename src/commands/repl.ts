/* eslint-disable no-console */
import chalk from 'chalk'
import { Command } from 'commander'
import logger from 'loglevel'
import { CompleterResult, Interface, createInterface as Repl } from 'readline'
import { Entity, Environment, Evaluation, Execution, Interpreter, NativeFunction, Package, REPL, RuntimeValue, interprete, link } from 'wollok-ts'
import { eventsFor, initializeGameClient } from '../game.js'
import { logger as fileLogger } from '../logger.js'
import { TimeMeasurer } from '../time-measurer.js'
import { ENTER, Project, buildEnvironmentCommand, buildNativesForGame, failureDescription, getAllAssets, getAssetsFolder, getFQN, handleError, initializeDynamicDiagram, nextPort, replIcon, sanitizeStackTrace, successDescription, valueDescription } from '../utils.js'

const { bold } = chalk

// TODO:
// - autocomplete piola

export type Options = {
  project: string
  assets: string
  skipValidations: boolean
  darkMode: boolean
  host: string
  port: string
  skipDiagram: boolean
}


export default async function (autoImportPath: string | undefined, options: Options): Promise<void> {
  replFn(autoImportPath, options)
}

const history: string[] = []

export async function replFn(autoImportPath: string | undefined, options: Options): Promise<Interface> {
  const { project, assets, host, port } = options
  logger.info(`${replIcon}  Initializing Wollok REPL ${autoImportPath ? `for file ${valueDescription(autoImportPath)} ` : ''}on ${valueDescription(options.project)}`)

  const serveGame: NativeFunction = function* (): Execution<RuntimeValue> {
    const path = getAssetsFolder(new Project(project), assets)
    const ioGame = initializeGameClient(project, path, host, nextPort(port))
    const assetFiles = getAllAssets(project, path)
    eventsFor(ioGame, interpreter, dynamicDiagramClient, assetFiles)
    return yield* this.reify(true)
  }

  let interpreter = await initializeInterpreter(autoImportPath, options, serveGame)

  const autoImportName = autoImportPath && interpreter.evaluation.environment.replNode().name
  const repl = Repl({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    removeHistoryDuplicates: true,
    tabSize: 2,
    prompt: bold(`wollok${autoImportName ? ':' + autoImportName : ''}> `),
    completer: autocomplete,
  })

  const rootPackage = interpreter.evaluation.environment.replNode()
  let dynamicDiagramClient = initializeDynamicDiagram(interpreter, options, rootPackage, !options.skipDiagram)

  const onReloadClient = async (diagramActivated: boolean, newInterpreter?: Interpreter) => {
    const selectedInterpreter = newInterpreter ?? interpreter
    if (diagramActivated && !dynamicDiagramClient.enabled) { // If the server was not initialized, do it now
      options.skipDiagram = !diagramActivated // Hack for one time use
      dynamicDiagramClient = initializeDynamicDiagram(selectedInterpreter, options, rootPackage, !options.skipDiagram)
    } else {
      dynamicDiagramClient.onReload(selectedInterpreter)
      logger.info(successDescription('Dynamic diagram reloaded at ' + bold(`http://${options.host}:${options.port}`)))
      repl.prompt()
    }
  }

  const onReloadInterpreter = (newInterpreter: Interpreter, rerun: boolean) => {
    interpreter = newInterpreter
    const previousCommands = [...history]
    history.length = 0
    if (rerun) {
      previousCommands.forEach(command => {
        repl.prompt()
        repl.write(command + ENTER)
      })
    }
    repl.prompt()
  }

  const commandHandler = defineCommands(autoImportPath, options, onReloadClient, onReloadInterpreter, serveGame)

  repl
    .on('close', () => console.log(''))
    .on('line', line => {
      line = line.trim()

      if (line.length) {
        if (line.startsWith(':')) commandHandler.parse(line.split(' '), { from: 'user' })
        else {
          history.push(line)
          console.log(interpreteLine(interpreter, line))
          dynamicDiagramClient.onReload(interpreter)
        }
      }
      repl.prompt()
    })

  if (dynamicDiagramClient.enabled)
    dynamicDiagramClient.server!.addListener('listening', () => repl.prompt())
  else
    repl.prompt()

  return repl
}

export function interpreteLine(interpreter: Interpreter, line: string): string {
  const { errored, result, error } = interprete(interpreter, line)
  return errored ? failureDescription(result, error) : successDescription(result)
}

export async function initializeInterpreter(autoImportPath: string | undefined, { project, skipValidations }: Options, serveGame?: NativeFunction): Promise<Interpreter> {
  let environment: Environment
  const timeMeasurer = new TimeMeasurer()
  const proj = new Project(project)

  try {
    environment = await buildEnvironmentCommand(project, skipValidations)

    if (autoImportPath) {
      const fqn = getFQN(project, autoImportPath)
      const entity = environment.getNodeOrUndefinedByFQN<Entity>(fqn)

      if (entity && entity.is(Package)) {
        environment.scope.register([REPL, entity]) // Register the auto-imported package as REPL package
      } else {
        console.log(failureDescription(`File ${valueDescription(autoImportPath)} doesn't exist or is outside of project ${project}!`))
        process.exit(11)
      }
    } else {
      // Create a new REPL package
      const replPackage = new Package({ name: REPL })
      environment = link([replPackage], environment)
    }
    const mergedNatives = serveGame ? await buildNativesForGame(proj, serveGame) : await proj.readNatives()
    return new Interpreter(Evaluation.build(environment, mergedNatives))
  } catch (error: any) {
    handleError(error)
    fileLogger.info({ message: `${replIcon} REPL execution - build failed for ${project}`, timeElapsed: timeMeasurer.elapsedTime(), ok: false, error: sanitizeStackTrace(error) })
    return process.exit(12)
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// SUB-COMMANDS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
function defineCommands(autoImportPath: string | undefined, options: Options, reloadClient: (activateDiagram: boolean, interpreter?: Interpreter) => Promise<void>, setInterpreter: (interpreter: Interpreter, rerun: boolean) => void, serveGame: NativeFunction): Command {
  const reload = (rerun = false) => async () => {
    logger.info(successDescription('Reloading environment'))
    const interpreter = await initializeInterpreter(autoImportPath, options, serveGame)
    setInterpreter(interpreter, rerun)
    reloadClient(options.skipDiagram, interpreter)
  }

  const commandHandler = new Command('Write a Wollok sentence or command to evaluate')
    .usage(' ')
    .allowUnknownOption()
    .helpOption(false)
    .addHelpText('afterAll', ' ')
    .action(() => commandHandler.outputHelp())

  commandHandler.command(':quit')
    .alias(':q')
    .alias(':exit')
    .description('Quit Wollok REPL')
    .allowUnknownOption()
    .action(() => process.exit(0))

  commandHandler.command(':reload')
    .alias(':r')
    .description('Reloads all currently imported packages and resets evaluation state')
    .allowUnknownOption()
    .action(reload())

  commandHandler.command(':rerun')
    .alias(':rr')
    .description('Same as "reload" but additionaly reruns all commands written since last reload')
    .allowUnknownOption()
    .action(reload(true))

  commandHandler.command(':diagram')
    .alias(':d')
    .description('Opens Dynamic Diagram')
    .allowUnknownOption()
    .action(async () => {
      reloadClient(true)
    })

  commandHandler.command(':help')
    .alias(':h')
    .description('Show Wollok REPL help')
    .allowUnknownOption()
    .action(() => commandHandler.outputHelp())

  return commandHandler
}
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// AUTOCOMPLETE
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function autocomplete(input: string): CompleterResult {
  const completions = ['fafafa', 'fefefe', 'fofofo']
  const hits = completions.filter((c) => c.startsWith(input))
  const results = hits.length ? hits : completions // Show all completions if none found
  return [results, results[0]]
}