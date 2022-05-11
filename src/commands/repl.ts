import readLine, { CompleterResult } from 'readline'
import { bold } from 'chalk'
import { Command } from 'commander'
import { buildEnvironmentForProject, failureDescription, problemDescription, successDescription, valueDescription } from '../utils'
import { Closure, Entity, Environment, Import, link, Package, parse, Reference, Sentence, Singleton, validate, WollokException } from 'wollok-ts'
import interpret from 'wollok-ts/dist/interpreter/interpreter'
import natives from 'wollok-ts/dist/wre/wre.natives'
import { notEmpty } from 'wollok-ts/dist/extensions'
import { LinkError } from 'wollok-ts/dist/linker'
import path from 'path'

// TODO:
// - reload
// - autocomplete piola

const { log } = console

const REPL_PACKAGE = 'wollok.repl'
const REPL_INSTANCE_NAME = 'instance'

type Options = {
  project: string
  skipValidations: boolean
}

export default async function (autoImportPath: string|undefined, { project, skipValidations }: Options): Promise<void> {
  log(`Initializing Wollok REPL ${autoImportPath ? `for file ${valueDescription(autoImportPath)} ` : ''}on ${valueDescription(project)}`)

  let environment: Environment

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
    }
    else log(failureDescription(`File ${valueDescription(autoImportPath)} doesn't exist or is outside of project!`))
  }

  environment = rebuildRepl(environment, autoImport)

  const repl = readLine.createInterface({
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

      if(line.startsWith(':')) commandHandler.parse(line.split(' '), { from: 'user' })
      else {
        const [nextOutput, nextEnvironment] = evaluate(environment, line)
        environment = nextEnvironment
        if(nextOutput.length) log(nextOutput)
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
    console.log('RELOAD!\n') // TODO:
  )

commandHandler.command(':help')
  .alias(':h')
  .description('Show Wollok REPL help')
  .allowUnknownOption()
  .action(() => commandHandler.outputHelp())

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// EVALUATION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function evaluate(previousEnvironment: Environment, line: string): [string, Environment] {
  try {
    const sentenceOrImport = parse.Import.or(parse.Variable).or(parse.Assignment).or(parse.Expression).tryParse(line)
    const environment = rebuildRepl(previousEnvironment, sentenceOrImport)
    const unlinkedNode = environment.descendants().find(_ => _.problems?.some(problem => problem instanceof LinkError))
    if(unlinkedNode) throw new Error(
      `Unknown reference ${'name' in unlinkedNode ? valueDescription(unlinkedNode.name) : `at ${unlinkedNode.sourceInfo()}`}`
    )

    const interpreter = interpret(environment, natives)
    const replInstance = interpreter.object(`${REPL_PACKAGE}.${REPL_INSTANCE_NAME}`)
    const result = interpreter.send('<apply>', replInstance)
    const stringifiedResult = result ? interpreter.send('toString', result)!.innerString! : ''

    return [successDescription(stringifiedResult), environment]
  } catch (error: any) {
    const errorInfo =
      error.type === 'ParsimmonError' ? failureDescription(`Syntax error:\n${error.message.split('\n').filter(notEmpty).slice(1).join('\n')}`) :
      error instanceof WollokException ? failureDescription('Evaluation Error!', error) :
      failureDescription('Uh-oh... Unexpected TypeScript Error!', error)

    return [errorInfo, previousEnvironment]
  }
}

function rebuildRepl(environment: Environment, newSentenceOrImport?: Sentence | Import): Environment {
  const previousReplPackage = environment.getNodeOrUndefinedByFQN<Package>(REPL_PACKAGE)
  const previousReplDefinition = previousReplPackage?.getNodeByQN<Singleton>(REPL_INSTANCE_NAME)
    ?? Closure({}).copy({ name: REPL_INSTANCE_NAME })

  const previousReplSentences = previousReplDefinition.methods().find(_ => _.name === '<apply>')!.sentences()
  const sentences = newSentenceOrImport?.is('Sentence')
    ? [...previousReplSentences.map(sentence => sentence.is('Return') ? sentence.value! : sentence), newSentenceOrImport]
    : previousReplSentences

  const previousReplImports = previousReplPackage?.imports ?? []
  const imports = newSentenceOrImport?.is('Import')
    ? [...previousReplImports, newSentenceOrImport]
    : previousReplImports

  const updatedRepl = Closure({ sentences }).copy({ name: REPL_INSTANCE_NAME })

  return link([new Package({ name: REPL_PACKAGE, members: [updatedRepl], imports })], environment)
}

async function autocomplete(input: string): Promise<CompleterResult> {
  const completions = ['fafafa', 'fefefe', 'fofofo']
  const hits = completions.filter((c) => c.startsWith(input))
  // Show all completions if none found
  return [hits.length ? hits : completions, input]
}