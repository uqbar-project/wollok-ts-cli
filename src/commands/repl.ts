import { createInterface as REPL, CompleterResult } from 'readline'
import { bold } from 'chalk'
import { Command } from 'commander'
import { buildEnvironmentForProject, failureDescription, problemDescription, successDescription, valueDescription } from '../utils'
import { Entity, Environment, Evaluation, Import, parse, Reference, validate, WollokException } from 'wollok-ts'
import { Interpreter } from 'wollok-ts/dist/interpreter/interpreter'
import natives from 'wollok-ts/dist/wre/wre.natives'
import { notEmpty } from 'wollok-ts/dist/extensions'
import { LinkError, linkIsolated } from 'wollok-ts/dist/linker'
import path from 'path'
import { ParseError } from 'wollok-ts/dist/parser'
import  logger  from  'loglevel'
// TODO:
// - autocomplete piola

const { log } = console

type Options = {
  project: string
  skipValidations: boolean
  verbose: boolean
}

export default async function (autoImportPath: string|undefined, options: Options): Promise<void> {
  logger.setLevel('INFO')
  logger.info(`Initializing Wollok REPL ${autoImportPath ? `for file ${valueDescription(autoImportPath)} ` : ''}on ${valueDescription(options.project)}`)

  let { imports, interpreter } = await initializeInterpreter(autoImportPath, options)

  const commandHandler = defineCommands(autoImportPath, options, o => {
    interpreter = o.interpreter
    imports = o.imports
    repl.prompt()
  } )

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
        else log(interprete(interpreter, imports, line))
      }

      repl.prompt()
    })

  repl.prompt()
}

async function initializeInterpreter(autoImportPath: string|undefined, { project, skipValidations, verbose }: Options): Promise<{ imports: Import[], interpreter: Interpreter}> {
  let environment: Environment
  const imports: Import[] = []
  if(verbose) logger.setLevel('DEBUG')

  try {
    environment = await buildEnvironmentForProject(project)
  } catch (error) {
    throw new Error(failureDescription('Could not build project due to errors!', error as Error))
  }

  if(!skipValidations) {
    const problems = validate(environment)
    problems.forEach(problem => logger.info(problemDescription(problem)))
    if(!problems.length) logger.info(successDescription('No problems found building the environment!'))
    else if(problems.some(_ => _.level === 'error')) throw new Error(failureDescription('Exiting REPL due to validation errors!'))
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

  return { imports, interpreter: new Interpreter(Evaluation.build(environment, natives)) }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// COMMANDS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
function defineCommands( autoImportPath: string | undefined, options: Options, setInterpreter: (o: {interpreter: Interpreter, imports: Import[]}) => void ): Command {
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
    .action(async () =>
      setInterpreter(await initializeInterpreter(autoImportPath, options))
    )

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