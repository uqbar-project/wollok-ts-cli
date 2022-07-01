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

// TODO:
// - reload
// - autocomplete piola

const { log } = console

type Options = {
  project: string
  skipValidations: boolean
}

//nuevas!!
let opt: Options
let importsfilespath: string|undefined
let repl: any
let environment: Environment
let interpreter: Interpreter

export default async function (autoImportPath: string|undefined, { project, skipValidations }: Options): Promise<void> {
  log(`Initializing Wollok REPL ${autoImportPath ? `for file ${valueDescription(autoImportPath)} ` : ''}on ${valueDescription(project)}`)

  //nuevas lineas
  opt = { project, skipValidations }
  importsfilespath = autoImportPath

  //let environment: Environment
  const imports: Import[] = []

  try {
    environment = await buildEnvironmentForProject(project)
  } catch (error) {
    log(failureDescription('Could not build project due to errors!', error as Error))
    return
  }

  if(!skipValidations) {
    const problems = validate(environment)
    problems.forEach(problem => log(problemDescription(problem)))
    if(!problems.length) log(successDescription('No problems found building the environment!'))
    else if(problems.some(_ => _.level === 'error')) return log(failureDescription('Exiting REPL due to validation errors!'))
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

  // const interpreter = new Interpreter(Evaluation.build(environment, natives))
  interpreter = new Interpreter(Evaluation.build(environment, natives))

  // const repl = REPL({
  repl = REPL({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    removeHistoryDuplicates: true,
    tabSize: 2,
    prompt: bold((autoImport ? `wollok:${autoImport.entity.name}` : 'wollok') + '> '),
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

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// COMMANDS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

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
  .action(() =>
    //console.log('RELOAD!\n') // TODO:
    reload()
  )

commandHandler.command(':help')
  .alias(':h')
  .description('Show Wollok REPL help')
  .allowUnknownOption()
  .action(() => commandHandler.outputHelp())

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RELOAD
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
async function reload(): Promise<void> {
  log(`Reinitializing Wollok REPL ${importsfilespath ? `for file ${valueDescription(importsfilespath)} ` : ''}on ${valueDescription(opt.project)}`)

  const imports: Import[] = []

  try {
    environment = await buildEnvironmentForProject(opt.project)
  } catch (error) {
    log(failureDescription('Could not build project due to errors!', error as Error))
    return
  }

  if(!opt.skipValidations) {
    checkValidations()
  }

  let autoImport: Import | undefined
  importFiles(autoImport, opt.project, imports)

  interpreter = new Interpreter(Evaluation.build(environment, natives))

  repl.prompt()
}


function checkValidations(){
  const problems = validate(environment)
  problems.forEach(problem => log(problemDescription(problem)))
  if(!problems.length) log(successDescription('No problems found building the environment!'))
  else if(problems.some(_ => _.level === 'error')) return log(failureDescription('Exiting REPL due to validation errors!'))
}
function importFiles(autoImport: Import | undefined, project: string, imports: Import[] ){
  if(importsfilespath) {
    const fqn = path.relative(project, importsfilespath).split('.')[0].replace('/', '.')
    const entity = environment.getNodeOrUndefinedByFQN<Entity>(fqn)
    if(entity) {
      autoImport = new Import({
        isGeneric: entity.is('Package'),
        entity: new Reference({ name: entity.fullyQualifiedName() }),
      })
      imports.push(autoImport)
    }
    else log(failureDescription(`File ${valueDescription(importsfilespath)} doesn't exist or is outside of project!`))
  }
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