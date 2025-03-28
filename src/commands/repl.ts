/* eslint-disable no-console */
import { bold } from 'chalk'
import { Command } from 'commander'
import cors from 'cors'
import express, { Express } from 'express'
import http from 'http'
import logger from 'loglevel'
import { CompleterResult, Interface, createInterface as Repl } from 'readline'
import { Server, Socket } from 'socket.io'
import { Entity, Environment, Evaluation, Interpreter, Package, REPL, interprete, link } from 'wollok-ts'
import { logger as fileLogger } from '../logger'
import { TimeMeasurer } from '../time-measurer'
import { ENTER, buildEnvironmentForProject, failureDescription, getDynamicDiagram, getFQN, handleError, publicPath, replIcon, sanitizeStackTrace, serverError, successDescription, validateEnvironment, valueDescription, Project } from '../utils'
// TODO:
// - autocomplete piola

export type Options = {
  project: string
  skipValidations: boolean,
  darkMode: boolean,
  host: string,
  port: string,
  skipDiagram: boolean
}

type DynamicDiagramClient = {
  onReload: (interpreter: Interpreter) => void,
  enabled: boolean,
  app?: Express, // only for testing purposes
  server?: http.Server, // only for testing purposes
}

export default async function (autoImportPath: string | undefined, options: Options): Promise<void> {
  replFn(autoImportPath, options)
}

const history: string[] = []

export async function replFn(autoImportPath: string | undefined, options: Options): Promise<Interface> {
  logger.info(`${replIcon}  Initializing Wollok REPL ${autoImportPath ? `for file ${valueDescription(autoImportPath)} ` : ''}on ${valueDescription(options.project)}`)

  let interpreter = await initializeInterpreter(autoImportPath, options)
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
  let dynamicDiagramClient = await initializeClient(options, repl, interpreter)

  const onReloadClient = async (activateDiagram: boolean, newInterpreter?: Interpreter) => {
    const selectedInterpreter = newInterpreter ?? interpreter
    if (activateDiagram && !dynamicDiagramClient.enabled) {
      options.skipDiagram = !activateDiagram
      dynamicDiagramClient = await initializeClient(options, repl, selectedInterpreter)
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

  const commandHandler = defineCommands(autoImportPath, options, onReloadClient, onReloadInterpreter)

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

  repl.prompt()
  return repl
}

export function interpreteLine(interpreter: Interpreter, line: string): string {
  const { errored, result, error } = interprete(interpreter, line)
  return errored ? failureDescription(result, error) : successDescription(result)
}

export async function initializeInterpreter(autoImportPath: string | undefined, { project, skipValidations }: Options): Promise<Interpreter> {
  let environment: Environment
  const timeMeasurer = new TimeMeasurer()
  const proj = new Project(project)

  try {
    environment = await buildEnvironmentForProject(project)
    validateEnvironment(environment, skipValidations)

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
    return new Interpreter(Evaluation.build(environment, await proj.readNatives()))
  } catch (error: any) {
    handleError(error)
    fileLogger.info({ message: `${replIcon} REPL execution - build failed for ${project}`, timeElapsed: timeMeasurer.elapsedTime(), ok: false, error: sanitizeStackTrace(error) })
    return process.exit(12)
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// COMMANDS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
function defineCommands(autoImportPath: string | undefined, options: Options, reloadClient: (activateDiagram: boolean, interpreter?: Interpreter) => Promise<void>, setInterpreter: (interpreter: Interpreter, rerun: boolean) => void): Command {
  const reload = (rerun = false) => async () => {
    logger.info(successDescription('Reloading environment'))
    const interpreter = await initializeInterpreter(autoImportPath, options)
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
// EVALUATION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

async function autocomplete(input: string): Promise<CompleterResult> {
  const completions = ['fafafa', 'fefefe', 'fofofo']
  const hits = completions.filter((c) => c.startsWith(input))
  // Show all completions if none found
  return [hits.length ? hits : completions, input]
}


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// SERVER/CLIENT
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export async function initializeClient(options: Options, repl: Interface, interpreter: Interpreter): Promise<DynamicDiagramClient> {
  if (options.skipDiagram) {
    return { onReload: (_interpreter: Interpreter) => {}, enabled: false }
  }
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
    socket.emit('updateDiagram', getDynamicDiagram(interpreter))
  }
  let currentConnectionListener = connectionListener(interpreter)
  io.on('connection', currentConnectionListener)

  app.use(
    cors({ allowedHeaders: '*' }),
    express.static(publicPath('diagram'), { maxAge: '1d' }),
  )
  const host = options.host
  server.listen(parseInt(options.port), host)
  server.addListener('listening', () => {
    logger.info(successDescription('Dynamic diagram available at: ' + bold(`http://${host}:${options.port}`)))
    repl.prompt()
  })

  return {
    onReload: (interpreter: Interpreter) => {
      io.off('connection', currentConnectionListener)
      currentConnectionListener = connectionListener(interpreter)
      io.on('connection', currentConnectionListener)

      io.emit('updateDiagram', getDynamicDiagram(interpreter))
    },
    enabled: true,
    app,
    server,
  }
}