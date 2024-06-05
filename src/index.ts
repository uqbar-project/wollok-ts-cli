#!/usr/bin/env node
import { Command } from 'commander'
import repl from './commands/repl'
import run from './commands/run'
import test from './commands/test'
import init from './commands/init'
import logger from 'loglevel'
import { version } from  '../package.json'
import { cyan } from 'chalk'

const program = new Command()
  .name('wollok')
  .description('Wollok Language command line interpreter tool')
  .version(cyan(version))
  .hook('preAction', (thisCommand, actionCommand) =>  {
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
  .action(run)

program.command('test')
  .description('Run Wollok tests')
  .argument('[filter]', 'filter pattern for a test, describe or package')
  .option('-p, --project [project]', 'path to project', process.cwd())
  .option('-f, --file [file]', 'path to file', '')
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
  .option('-p, --project [filter]', 'path to project', process.cwd())
  .option('-n, --name [name]', 'name of the example', undefined)
  .option('-g, --game', 'adds a game program to the project', false)
  .option('-t, --noTest', 'avoids creating a test file', false)
  .option('-c, --noCI', 'avoids creating a file for CI', false)
  .allowUnknownOption()
  .action(init)

program.parseAsync()