import { bold } from 'chalk'
import { Command } from 'commander'
import cors from 'cors'
import express from 'express'
import http from 'http'
import logger from 'loglevel'
import { CompleterResult, createInterface as Repl } from 'readline'
import { Server } from 'socket.io'
import { Entity, Environment, Evaluation, Import, Package, parse, Reference, Sentence, validate, WollokException } from 'wollok-ts'
import { notEmpty } from 'wollok-ts/dist/extensions'
import { Interpreter } from 'wollok-ts/dist/interpreter/interpreter'
import link, { LocalScope } from 'wollok-ts/dist/linker'
import { ParseError } from 'wollok-ts/dist/parser'
import natives from 'wollok-ts/dist/wre/wre.natives'
import { buildEnvironmentForProject, failureDescription, getFQN, problemDescription, publicPath, successDescription, valueDescription } from '../utils'
import { getDataDiagram } from '../services/diagram-generator'

export const REPL = 'REPL'

// TODO:
// - autocomplete piola

const { log } = console

type Options = {
  project: string
  skipValidations: boolean,
  darkMode: boolean,
  port: string
}

export default async function (autoImportPath: string | undefined, options: Options): Promise<void> {
  logger.info(`Initializing Wollok REPL ${autoImportPath ? `for file ${valueDescription(autoImportPath)} ` : ''}on ${valueDescription(options.project)}`)

  let interpreter = await initializeInterpreter(autoImportPath, options)
  const io: Server = await initializeClient(options)

  const commandHandler = defineCommands(autoImportPath, options, () => {
    io.emit('updateDiagram', getDataDiagram(interpreter))
  }, (newInterpreter: Interpreter) => {
    interpreter = newInterpreter
    repl.prompt()
  })

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
    .on('close', () => log(''))
    .on('line', line => {
      line = line.trim()

      if (line.length) {
        if (line.startsWith(':')) commandHandler.parse(line.split(' '), { from: 'user' })
        else {
          log(interprete(interpreter, line))
          io?.emit('updateDiagram', getDataDiagram(interpreter))
        }
      }
      repl.prompt()
    })

  io.on('connection', socket => {
    socket.emit('initDiagram', options)
    socket.emit('updateDiagram', getDataDiagram(interpreter))
  })

  repl.prompt()
}

export async function initializeInterpreter(autoImportPath: string | undefined, { project, skipValidations }: Options): Promise<Interpreter> {
  let environment: Environment

  try {
    environment = await buildEnvironmentForProject(project)

    if (!skipValidations) {
      const problems = validate(environment)
      problems.forEach(problem => logger.info(problemDescription(problem)))
      if (!problems.length) logger.info(successDescription('No problems found building the environment!'))
      else if (problems.some(_ => _.level === 'error')) throw problems.find(_ => _.level === 'error')
    }

    if (autoImportPath) {
      const fqn = getFQN(project, autoImportPath)
      const entity = environment.getNodeOrUndefinedByFQN<Entity>(fqn)
      if (entity && entity.is(Package)) environment.scope.register([REPL, entity]) // Register the auto-imported package as REPL package
      else log(failureDescription(`File ${valueDescription(autoImportPath)} doesn't exist or is outside of project!`))
    } else {
      // Create a new REPL package
      const replPackage = new Package({ name: REPL })
      environment = link([replPackage], environment)
    }
  } catch (error: any) {
    if (error.level === 'error') {
      logger.error(failureDescription('Exiting REPL due to validation errors!'))
    } else {
      logger.error(failureDescription('Uh-oh... Unexpected Error!'))
      logger.debug(failureDescription('Stack trace:', error))
    }
    process.exit()
  }

  return new Interpreter(Evaluation.build(environment, natives))
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// COMMANDS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
function defineCommands(autoImportPath: string | undefined, options: Options, reloadIo: () => void, setInterpreter: (interpreter: Interpreter) => void): Command {
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
    .action(() => process.exit())

  commandHandler.command(':reload')
    .alias(':r')
    .description('Reloads all currently imported packages and resets evaluation state')
    .allowUnknownOption()
    .action(async () => {
      const interpreter = await initializeInterpreter(autoImportPath, options)
      setInterpreter(interpreter)
      reloadIo()
    })

  commandHandler.command(':diagram')
    .alias(':d')
    .description('Opens Dynamic Diagram')
    .allowUnknownOption()
    .action(async () => {
      logger.info(successDescription('Dynamic diagram available at: ' + bold(`http://localhost:${options.port}`)))
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

export function interprete(interpreter: Interpreter, line: string): string {
  try {
    const sentenceOrImport = parse.Import.or(parse.Variable).or(parse.Assignment).or(parse.Expression).tryParse(line)
    const error = [sentenceOrImport, ...sentenceOrImport.descendants].flatMap(_ => _.problems ?? []).find(_ => _.level === 'error')
    if (error) throw error

    if (sentenceOrImport.is(Sentence)) {
      const linkedSentence = newSentence(sentenceOrImport, interpreter.evaluation.environment)
      const unlinkedNode = [linkedSentence, ...linkedSentence.descendants].find(_ => _.is(Reference) && !_.target)

      if (unlinkedNode) {
        if (unlinkedNode.is(Reference)) {
          if (!interpreter.evaluation.currentFrame.get(unlinkedNode.name))
            return failureDescription(`Unknown reference ${valueDescription(unlinkedNode.name)}`)
        } else return failureDescription(`Unknown reference at ${unlinkedNode.sourceInfo}`)
      }

      const result = interpreter.exec(linkedSentence)
      const stringResult = result
        ? typeof result.innerValue === 'string'
          ? `"${result.innerValue}"`
          : interpreter.send('toString', result)!.innerString!
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

async function autocomplete(input: string): Promise<CompleterResult> {
  const completions = ['fafafa', 'fefefe', 'fofofo']
  const hits = completions.filter((c) => c.startsWith(input))
  // Show all completions if none found
  return [hits.length ? hits : completions, input]
}


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// SERVER/CLIENT
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

async function initializeClient(options: Options) {
  const app = express()
  const server = http.createServer(app)
  const io = new Server(server)

  io.on('connection', socket => {
    logger.info(successDescription('Connected to Dynamic diagram'))
    socket.on('disconnect', () => { logger.info(failureDescription('Dynamic diagram closed')) })
  })
  app.use(
    cors({ allowedHeaders: '*' }),
    express.static(publicPath('diagram'), { maxAge: '1d' }),
  )
  server.listen(parseInt(options.port), 'localhost')

  logger.info(successDescription('Dynamic diagram available at: ' + bold(`http://localhost:${options.port}`)))
  return io
}


function newSentence<S extends Sentence>(sentence: S, environment: Environment): S {
  const replScope = replNode(environment).scope

  sentence.forEach(node => {
    Object.assign(node, {
      scope: new LocalScope(replScope),
      environment,
    })
  })

  return sentence
}

function newImport(importNode: Import, environment: Environment) {
  const node = replNode(environment)
  const imported = node.scope.resolve<Package | Entity>(importNode.entity.name)!
  if (imported.is(Package)) {
    return node.scope.include(imported.scope)
  }
  return node.scope.register([imported.name!, imported])
}

export const replNode = (environment: Environment): Package => environment.getNodeByFQN<Package>(REPL)