import { program } from 'commander'
import run from './commands/run'

program
  .name('wollok')
  .description('Wollok Language command line interpreter tool')
  .version(process.env.npm_package_version ?? 'unkown')

program.command('run')
  .description('Run a Wollok program')
  .argument('<program>', 'program\'s fully qualified name')
  .option('-p, --project <path>', 'path to project', process.cwd())
  .option('--skipValidations', 'skip code validation', false)
  .action(run)

program.parseAsync()