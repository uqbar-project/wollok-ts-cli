#!/usr/bin/env node
import { Command } from 'commander'
import repl from './commands/repl.js'
import run from './commands/run.js'
import test from './commands/test.js'
import init from './commands/init.js'
import lint from './commands/lint.js'
import ast from './commands/ast.js'
import { addDependency, removeDependency, synchronizeDependencies } from './commands/dependencies.js'
import logger from 'loglevel'
import pkg from '../package.json' with { type: 'json' }
import chalk from 'chalk'
import updateNotifier from './update-notifier.js'

const { cyan } = chalk

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
    .option('-a, --assets [path]', 'path relative to project for game assets. By default, it takes the assets definition from package.json.', '')
    .option('--skipValidations', 'skip code validation', false)
    .option('--host [host]', 'host to run (bind) the server', 'localhost')
    .option('--port [port]', 'port to run the server', '3000')
    .option('-v, --verbose', 'print debugging information', false)
    .option('-d, --startDiagram', 'activate the dynamic diagram', false)
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
    .option('-a, --assets [path]', 'path relative to project for game assets. By default, it takes the assets definition from package.json.', '')
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
    .option('-N, --natives [natives]', 'folder name for native files (default: root folder).', undefined)
    .allowUnknownOption()
    .action(init)

  program.command('lint')
    .description('Validate Wollok code')
    .option('-p, --project [project]', 'path to project', process.cwd())
    .option('-e, --entityFQN [entity]', 'entity (use the fully qualified name or leave it blank in order to use the whole project)', undefined)
    .allowUnknownOption()
    .action(lint)

  program.command('ast')
    .description('Show abstract syntax tree')
    .option('-p, --project [project]', 'path to project', process.cwd())
    .option('-e, --entityFQN [entity]', 'entity (use the fully qualified name or leave it blank in order to use the whole project)', undefined)
    .allowUnknownOption()
    .action(ast)

  const dependencyCommand = new Command('dependencies')
    .description('Manage dependencies for a Wollok project')

  dependencyCommand
    .command('add')
    .description('Add a dependency to the project')
    .argument('<package>', 'Name of the package to add (e.g., lodash@latest)')
    .option('-p, --project [path]', 'Path to project', process.cwd())
    .option('-v, --verbose', 'Print debugging information', false)
    .allowUnknownOption()
    .action(addDependency)

  dependencyCommand
    .command('remove')
    .description('Remove a dependency from the project')
    .argument('<package>', 'Name of the package to remove (e.g., lodash)')
    .option('-p, --project [path]', 'Path to project', process.cwd())
    .option('-v, --verbose', 'Print debugging information', false)
    .allowUnknownOption()
    .action(removeDependency)

  dependencyCommand
    .command('sync')
    .description('Synchronize all dependencies')
    .option('-p, --project [path]', 'Path to project', process.cwd())
    .option('-v, --verbose', 'Print debugging information', false)
    .action(synchronizeDependencies)

  program.addCommand(dependencyCommand)
  program.parseAsync()
})