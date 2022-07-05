import { Command } from 'commander'
import repl from './commands/repl'
import run from './commands/run'
import test from './commands/test'

const program = new Command()
  .name('wollok')
  .description('Wollok Language command line interpreter tool')
  .version(process.env.npm_package_version ?? 'unkown')

program.command('run')
  .description('Run a Wollok program')
  .argument('<program>', 'program\'s fully qualified name')
  .option('-p, --project <path>', 'path to project', process.cwd())
  .option('--skipValidations', 'skip code validation', false)
  .action(run)

program.command('test')
  .description('Run Wollok tests')
  .argument('[filter]', 'filter pattern for a test, describe or package')
  .option('-p, --project [filter]', 'path to project', process.cwd())
  .option('--skipValidations', 'skip code validation', false)
  .action(test)

program.command('repl')
  .description('Start Wollok interactive console')
  .argument('[file]', 'main Wollok file to auto import')
  .option('-p, --project [filter]', 'path to project', process.cwd())
  .option('--skipValidations', 'skip code validation', false)
  .option('-v, --verbose', 'debugging information', false)
  .action(repl)


program.parseAsync()