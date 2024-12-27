#!/usr/bin/env node
import { Command } from 'commander'
import repl from './commands/repl'
import run from './commands/run'
import test from './commands/test'
import init from './commands/init'
//import dependencies from './commands/dependencies'
import logger from 'loglevel'
import pkg from '../package.json'
import { cyan } from 'chalk'
import updateNotifier from './update-notifier'

updateNotifier().finally(() => {
  const program = new Command()
    .name('wollok')
    .description('Wollok Language command line interpreter tool')
    .version(cyan(pkg.version))
    .hook('preAction', (thisCommand, actionCommand) => {
      actionCommand.opts().verbose ? logger.setLevel('DEBUG') : logger.setLevel('INFO')
    })

  program.command('run')
    .description('Run a Wollok program')
    .argument('<program>', 'program\'s fully qualified name')
    .option('-p, --project <path>', 'path to project', process.cwd())
    .option('-a, --assets [path]', 'path relative to project for game assets. By default, it takes the assets definition from package.json.', 'assets')
    .option('--skipValidations', 'skip code validation', false)
    .option('--host [host]', 'host to run (bind) the server', 'localhost')
    .option('--port [port]', 'port to run the server', '3000')
    .option('-g, --game', 'sets the program as a game', false)
    .option('-v, --verbose', 'print debugging information', false)
    .option('-d, --startDiagram', 'activate the dynamic diagram (only for games)', false)
    .action((programFQN, options) => { run(programFQN, options) })

  program.command('test')
    .description('Run Wollok tests')
    .argument('[filter]', 'filter pattern for a test, describe or package')
    .option('-p, --project [project]', 'path to project', process.cwd())
    .option('-f, --file [file]', 'path to file relative to the project', '')
    .option('-d, --describe [describe]', 'describe to run', '')
    .option('-t, --test [test]', 'test to run', '')
    .option('--skipValidations', 'skip code validation', false)
    .option('-v, --verbose', 'print debugging information', false)
    .action(test)

  program.command('repl')
    .description('Start Wollok interactive console')
    .argument('[file]', 'main Wollok file to auto import')
    .option('-p, --project [filter]', 'path to project', process.cwd())
    .option('--skipValidations', 'skip code validation', false)
    .option('--darkMode', 'dark mode', false)
    .option('--skipDiagram', 'avoid starting the server for the dynamic diagram', false)
    .option('--host [host]', 'host to run (bind) the server', 'localhost')
    .option('--port [port]', 'port to run the server', '3000')
    .option('-v, --verbose', 'print debugging information', false)
    .action(repl)

  program.command('init')
    .description('Create a new Wollok project')
    .argument('[folder]', 'folder name, if not provided, the current folder will be used')
    .option('-p, --project [filter]', 'path to project', process.cwd())
    .option('-n, --name [name]', 'name of the example', undefined)
    .option('-g, --game', 'adds a game program to the project', false)
    .option('-t, --noTest', 'avoids creating a test file', false)
    .option('-c, --noCI', 'avoids creating a file for CI', false)
    .option('-ng, --noGit', 'avoids initializing a git repository', false)
    .option('-N, --natives [natives]', 'folder name for natives files', undefined)
    .allowUnknownOption()
    .action(init)

  // const dependencyCommand = new Command('dependency')
  //   .description('Manage dependencies for a Wollok project')

  // dependencyCommand
  //   .command('add')
  //   .description('Add one or more dependencies to the project')
  //   .argument('<packages...>', 'Names of the packages to add (e.g., lodash@latest)')
  //   .option('-p, --project [path]', 'Path to project', process.cwd())
  //   .option('-v, --verbose', 'Print debugging information', false)
  //   .option('-u, --update', 'Update dependencies after they are added', false)
  //   .action((packages, options) => {
  //     dependencies.add(options, packages )
  //   })

  // dependencyCommand
  //   .command('remove')
  //   .description('Remove one or more dependencies from the project')
  //   .argument('<packages...>', 'Names of the packages to remove (e.g., lodash)')
  //   .option('-p, --project [path]', 'Path to project', process.cwd())
  //   .option('-v, --verbose', 'Print debugging information', false)
  //   .option('-u, --update', 'Update dependencies after they are removed', false)
  //   .action((packages, options) => {
  //     dependencies.remove(DependenciesOptions.load({ ...options, packages }))
  //   })

  // dependencyCommand
  //   .command('download')
  //   .description('Download and synchronize all dependencies')
  //   .option('-p, --project [path]', 'Path to project', process.cwd())
  //   .option('-v, --verbose', 'Print debugging information', false)
  //   .action((packages, options) => {
  //     dependencies.add(DependenciesOptions.load({ ...options, packages }))
  //   })

  // program.addCommand(dependencyCommand)
  program.parseAsync()
})