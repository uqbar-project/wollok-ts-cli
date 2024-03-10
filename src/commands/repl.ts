/* eslint-disable no-console */
import { bold } from 'chalk'
import { Command } from 'commander'
import cors from 'cors'
import express, { Express } from 'express'
import http from 'http'
import logger from 'loglevel'
import { CompleterResult, Interface, createInterface as Repl } from 'readline'
import { Server, Socket } from 'socket.io'
import { Entity, Environment, Evaluation, Import, link, notEmpty, Package, Reference, Sentence, WollokException, parse, TO_STRING_METHOD, RuntimeObject, LocalScope, List, Name, Node, Field, Parameter } from 'wollok-ts'
import { ParseError } from 'wollok-ts/dist/parser'
import natives from 'wollok-ts/dist/wre/wre.natives'
import { getDataDiagram } from '../services/diagram-generator'
import { buildEnvironmentForProject, failureDescription, getFQN, publicPath, successDescription, valueDescription, validateEnvironment, handleError, ENTER, serverError, stackTrace, replIcon } from '../utils'
import { logger as fileLogger } from '../logger'
import { TimeMeasurer } from '../time-measurer'
import { Interpreter } from 'wollok-ts/dist/interpreter/interpreter'

export const REPL = 'REPL'

// TODO:
// - autocomplete piola

// This is a fake linking, TS should give us a better API
export function linkSentence<S extends Sentence>(newSentence: S, environment: Environment): void {
  const { scope } = replNode(environment)
  scope.register(...scopeContribution(newSentence))
  newSentence.reduce((parentScope, node) => {
    const localScope = new LocalScope(parentScope, ...scopeContribution(node))
    Object.assign(node, { scope: localScope, environment })
    return localScope
  }, scope)
}

const scopeContribution = (contributor: Node): List<[Name, Node]> => {
  if (canBeReferenced(contributor))
    return contributor.name ? [[contributor.name, contributor]] : []
  return []
}
const canBeReferenced = (node: Node): node is Entity | Field | Parameter => node.is(Entity) || node.is(Field) || node.is(Parameter)
// ========================================================================================================================

export type Options = {
  project: string
  skipValidations: boolean,
  darkMode: boolean,
  port: string,
  skipDiagram: boolean,
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
  const autoImportName = autoImportPath && replNode(interpreter.evaluation.environment).name
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
      logger.info(successDescription('Dynamic diagram reloaded'))
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
          console.log(interprete(interpreter, line))
          dynamicDiagramClient.onReload(interpreter)
        }
      }
      repl.prompt()
    })

  repl.prompt()
  return repl
}

export async function initializeInterpreter(autoImportPath: string | undefined, { project, skipValidations }: Options): Promise<Interpreter> {
  let environment: Environment
  const timeMeasurer = new TimeMeasurer()

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
    return new Interpreter(Evaluation.build(environment, natives))
  } catch (error: any) {
    handleError(error)
    fileLogger.info({ message: `${replIcon} REPL execution - build failed for ${project}`, timeElapsed: timeMeasurer.elapsedTime(), ok: false, error: stackTrace(error) })
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

// TODO WOLLOK-TS: check if we should decouple the function
export function interprete(interpreter: Interpreter, line: string): string {
  try {
    const sentenceOrImport = parse.Import.or(parse.Variable).or(parse.Assignment).or(parse.Expression).tryParse(line)
    const error = [sentenceOrImport, ...sentenceOrImport.descendants].flatMap(_ => _.problems ?? []).find(_ => _.level === 'error')
    if (error) throw error

    if (sentenceOrImport.is(Sentence)) {
      const environment = interpreter.evaluation.environment
      linkSentence(sentenceOrImport, environment)
      const unlinkedNode = [sentenceOrImport, ...sentenceOrImport.descendants].find(_ => _.is(Reference) && !_.target)

      if (unlinkedNode) {
        if (unlinkedNode.is(Reference)) {
          if (!interpreter.evaluation.currentFrame.get(unlinkedNode.name))
            return failureDescription(`Unknown reference ${valueDescription(unlinkedNode.name)}`)
        } else return failureDescription(`Unknown reference at ${unlinkedNode.sourceInfo}`)
      }

      const result = interpreter.exec(sentenceOrImport)
      const stringResult = result
        ? showInnerValue(interpreter, result)
        : ''
      return successDescription(stringResult)
    }

    if (sentenceOrImport.is(Import)) {
      if (!interpreter.evaluation.environment.getNodeOrUndefinedByFQN(sentenceOrImport.entity.name))
        throw new Error(
          `Unknown reference ${valueDescription(sentenceOrImport.entity.name)}`
        )

      newImport(sentenceOrImport, interpreter.evaluation.environment)

      return successDescription('')
    }

    return successDescription('')
  } catch (error: any) {
    return (
      error.type === 'ParsimmonError' ? failureDescription(`Syntax error:\n${error.message.split('\n').filter(notEmpty).slice(1).join('\n')}`) :
      error instanceof WollokException ? failureDescription('Evaluation Error!', error) :
      error instanceof ParseError ? failureDescription(`Syntax Error at offset ${error.sourceMap.start.offset}: ${line.slice(error.sourceMap.start.offset, error.sourceMap.end.offset)}`) :
      failureDescription('Uh-oh... Unexpected TypeScript Error!', error)
    )
  }
}

function showInnerValue(interpreter: Interpreter, obj: RuntimeObject) {
  if (obj!.innerValue) return 'null'
  return typeof obj.innerValue === 'string'
    ? `"${obj.innerValue}"`
    : interpreter.send(TO_STRING_METHOD, obj)!.innerString!
}

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
    socket.emit('updateDiagram', getDataDiagram(interpreter))
  }
  let currentConnectionListener = connectionListener(interpreter)
  io.on('connection', currentConnectionListener)

  app.use(
    cors({ allowedHeaders: '*' }),
    express.static(publicPath('diagram'), { maxAge: '1d' }),
  )
  server.listen(parseInt(options.port), 'localhost')
  server.addListener('listening', () => {
    logger.info(successDescription('Dynamic diagram available at: ' + bold(`http://localhost:${options.port}`)))
    repl.prompt()
  })

  return {
    onReload: (interpreter: Interpreter) => {
      io.off('connection', currentConnectionListener)
      currentConnectionListener = connectionListener(interpreter)
      io.on('connection', currentConnectionListener)

      io.emit('updateDiagram', getDataDiagram(interpreter))
    },
    enabled: true,
    app,
    server,
  }
}

// TODO WOLLOK-TS: migrate it? Maybe it could be part of Environment
// Environment.newImportFor(baseNode, importNode)
function newImport(importNode: Import, environment: Environment) {
  const node = replNode(environment)
  const imported = node.scope.resolve<Package | Entity>(importNode.entity.name)!
  if (imported.is(Package)) {
    return node.scope.include(imported.scope)
  }
  return node.scope.register([imported.name!, imported])
}

export const replNode = (environment: Environment): Package => environment.getNodeByFQN<Package>(REPL)