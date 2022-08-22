import { bold } from 'chalk'
import { Command } from 'commander'
import { app as client, BrowserWindow } from 'electron'
import express from 'express'
import http from 'http'
import logger from 'loglevel'
import path from 'path'
import { CompleterResult, createInterface as REPL } from 'readline'
import { Entity, Environment, Evaluation, Import, parse, Reference, RuntimeObject, validate, WollokException } from 'wollok-ts'
import { notEmpty } from 'wollok-ts/dist/extensions'
import { Interpreter } from 'wollok-ts/dist/interpreter/interpreter'
import { LinkError, linkIsolated } from 'wollok-ts/dist/linker'
import { ParseError } from 'wollok-ts/dist/parser'
import natives from 'wollok-ts/dist/wre/wre.natives'
import { buildEnvironmentForProject, failureDescription, problemDescription, successDescription, valueDescription } from '../utils'
import { Server } from 'socket.io'
import { ElementDefinition } from 'cytoscape'

// TODO:
// - autocomplete piola

const { log } = console

type Options = {
  project: string
  skipValidations: boolean
}

export default async function (autoImportPath: string|undefined, options: Options): Promise<void> {
  logger.info(`Initializing Wollok REPL ${autoImportPath ? `for file ${valueDescription(autoImportPath)} ` : ''}on ${valueDescription(options.project)}`)

  let [interpreter, imports] = await initializeInterpreter(autoImportPath, options)
  let io: Server
  const commandHandler = defineCommands(autoImportPath, options, (newIo) => {
    io = newIo
    io.on('connection', socket => {
      socket.emit('evaluation', getDataDiagram(interpreter.evaluation))
    })
  }, (newInterpreter: Interpreter, newImport: Import[]) => {
    interpreter = newInterpreter
    imports = newImport
    repl.prompt()
  })

  const autoImportName = imports?.length && imports[0].entity.name
  const repl = REPL({
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

      if(line.length) {
        if(line.startsWith(':')) commandHandler.parse(line.split(' '), { from: 'user' })
        else {
          log(interprete(interpreter, imports, line))
          io?.emit('evaluation', getDataDiagram(interpreter.evaluation))
        }
      }
      repl.prompt()
    })

  repl.prompt()
}

async function initializeInterpreter(autoImportPath: string|undefined, { project, skipValidations }: Options): Promise<[Interpreter, Import[]]> {
  let environment: Environment
  const imports: Import[] = []

  try {
    environment = await buildEnvironmentForProject(project)

    if(!skipValidations) {
      const problems = validate(environment)
      problems.forEach(problem => logger.info(problemDescription(problem)))
      if(!problems.length) logger.info(successDescription('No problems found building the environment!'))
      else if(problems.some(_ => _.level === 'error')) throw problems.find(_ => _.level === 'error')
    }

    let autoImport: Import | undefined
    if(autoImportPath) {
      const fqn = path.relative(project, autoImportPath).split('.')[0].replace('/', '.')
      const entity = environment.getNodeOrUndefinedByFQN<Entity>(fqn)
      if(entity) {
        autoImport = new Import({
          isGeneric: entity.is('Package'),
          entity: new Reference({ name: entity.fullyQualifiedName() }),
        })
        imports.push(autoImport)
      }
      else log(failureDescription(`File ${valueDescription(autoImportPath)} doesn't exist or is outside of project!`))
    }

  } catch (error: any) {
    if (error.level === 'error') {
      logger.error(failureDescription('Exiting REPL due to validation errors!'))
    }else{
      logger.error(failureDescription('Uh-oh... Unexpected Error!'))
      logger.debug(failureDescription('Stack trace:', error))
    }
    process.exit()
  }

  return [new Interpreter(Evaluation.build(environment, natives)), imports]
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// COMMANDS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
function defineCommands( autoImportPath: string | undefined, options: Options, setIo: (io: Server) => void, setInterpreter: (interpreter: Interpreter, imports: Import[]) => void ): Command {
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
      const [interpreter, imports] = await initializeInterpreter(autoImportPath, options)
      setInterpreter(interpreter, imports)
    })

  // Esto es código falopa de referencia deberíamos reemplazarlo por el posta

  commandHandler.command(':diagram')
    .alias(':d')
    .description('Opens the Object Diagram')
    .allowUnknownOption()
    .action(async () => {
      const io = await initializeClient()
      setIo(io)
    })

  // Fin del código falopa

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

function interprete(interpreter: Interpreter, imports: Import[], line: string): string {
  try {
    const sentenceOrImport = parse.Import.or(parse.Variable).or(parse.Assignment).or(parse.Expression).tryParse(line)
    const error = [sentenceOrImport, ...sentenceOrImport.descendants()].flatMap(_ => _.problems ?? []).find(_ => _.level === 'error')
    if (error) throw error

    if(sentenceOrImport.is('Sentence')) {
      const linkedSentence = linkIsolated(sentenceOrImport, interpreter.evaluation.environment, imports)
      const unlinkedNode = [linkedSentence, ...linkedSentence.descendants()].find(_ => _.problems?.some(problem => problem instanceof LinkError))

      if(unlinkedNode) {
        if(unlinkedNode.is('Reference')) {
          if(!interpreter.evaluation.currentFrame.get(unlinkedNode.name))
            return failureDescription(`Unknown reference ${valueDescription(unlinkedNode.name)}`)
        } else return failureDescription(`Unknown reference at ${unlinkedNode.sourceInfo()}`)
      }

      const result = interpreter.exec(linkedSentence)
      return successDescription(result ? interpreter.send('toString', result)!.innerString! : '')
    }

    if(sentenceOrImport.is('Import')) {
      if(!interpreter.evaluation.environment.getNodeOrUndefinedByFQN(sentenceOrImport.entity.name))
        throw new Error(
          `Unknown reference ${valueDescription(sentenceOrImport.entity.name)}`
        )

      imports.push(sentenceOrImport)
      return successDescription('')
    }

    return successDescription('')
  } catch (error: any) {
    return (
      error.type === 'ParsimmonError' ? failureDescription(`Syntax error:\n${error.message.split('\n').filter(notEmpty).slice(1).join('\n')}`) :
      error instanceof WollokException ? failureDescription('Evaluation Error!', error) :
      error instanceof ParseError ? failureDescription(`Syntax Error at offset ${error.sourceMap.start.offset}: ${line.slice(error.sourceMap.start.offset, error.sourceMap.end.offset)}`)  :
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

async function initializeClient() {
  const server = http.createServer(express())
  const io = new Server(server)

  io.on('connection', socket => {
    log('Client connected!')
    socket.on('disconnect', () => { log('Client disconnected!') })
  })

  server.listen(3000)

  await client.whenReady()
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    icon: __dirname + 'wollok.ico',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })
  win.removeMenu()
  win.loadFile('./public/index.html')
  return io
}

// De acá se obtiene la lista de objetos a dibujar
function decoration(obj: RuntimeObject) {
  const { id, innerValue, module } = obj
  const moduleName: string = module.fullyQualifiedName()

  if (obj.innerValue === null || moduleName === 'wollok.lang.Number') return {
    type: 'literal',
    label: `${innerValue}`,
  }

  if (moduleName === 'wollok.lang.String') return {
    type: 'literal',
    label: `"${innerValue}"`,
  }

  if (module.is('Singleton') && module.name) return {
    type: 'object',
    label: module.name,
  }

  return { label: `${module.name}#${id.slice(31)}` }
}

function elementFromObject(obj: RuntimeObject, alreadyVisited: string[] = []): ElementDefinition[] {
  const { id } = obj
  if (alreadyVisited.includes(id)) return []
  return [
    { data: { id, ...decoration(obj) } },
    ...[...obj.locals.keys()].filter(key => key !== 'self').flatMap(name => [
      { data: { id: `${id}_${obj.get(name)?.id}`, label: name, source: id, target: obj.get(name)?.id } },
      ...elementFromObject(obj.get(name)!, [...alreadyVisited, id]),
    ]),
  ]
}

function getDataDiagram(evaluation: Evaluation): ElementDefinition[] {
  return [...evaluation.allInstances()]
    .filter((obj) => {
      const name = obj.module.fullyQualifiedName()
      return name && name !== 'worksheet.main.repl' && !name.startsWith('wollok')
    })
    .flatMap(obj => elementFromObject(obj))
}