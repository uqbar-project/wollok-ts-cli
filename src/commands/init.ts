import { bold, cyan, yellow, green } from 'chalk'
import logger from 'loglevel'
import { existsSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { userInfo } from 'os'
import { ENTER, createFolderIfNotExists } from '../utils'

export type Options = {
  project: string,
  name?: string | undefined,
  noTest: boolean,
  noCI: boolean,
  game: boolean,
}

export default function ({ project, name, noTest = false, noCI = false, game = false }: Options): void {
  // Initialization
  if (existsSync(join(project, 'package.json'))) {
    logger.info(yellow(bold(`🚨 There is already a project inside ${project} folder`)))
    process.exit(1)
  }
  logger.info(cyan(`Creating project in ${bold(project)}...`))

  // Creating folders
  createFolderIfNotExists(project)
  createFolderIfNotExists(join(project, '.github'))
  createFolderIfNotExists(join(project, '.github', 'workflows'))
  if (game) {
    createFolderIfNotExists(join(project, 'assets'))
  }

  // Creating files
  const exampleName = name ?? 'example'
  logger.info(`Creating definition file ${exampleName}.wlk`)
  writeFileSync(join(project, `${exampleName}.wlk`), wlkDefinition)

  if (!noTest) {
    const testFile = `test${capitalizeFirstLetter(exampleName)}.wtest`
    logger.info(`Creating test file ${testFile}`)
    writeFileSync(join(project, testFile), testDefinition(exampleName))
  }

  if (game) {
    const gameFile = `main${capitalizeFirstLetter(exampleName)}.wpgm`
    logger.info(`Creating program file ${gameFile}`)
    writeFileSync(join(project, `${gameFile}`), gameDefinition(exampleName))
  }

  logger.info('Creating package.json')
  writeFileSync(join(project, 'package.json'), packageJsonDefinition(project, game))

  if (!noCI) {
    logger.info('Creating CI files')
    writeFileSync(join(project, '.github', 'workflows', 'ci.yml'), ymlForCI)
  }

  logger.info('Creating README')
  writeFileSync(join(project, 'README.md'), readme(exampleName))

  // Finish
  logger.info(green('✨ Project succesfully created. Happy coding!'))
}


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const capitalizeFirstLetter = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1)

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// COMMANDS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const wlkDefinition = `object pepita {
  var energy = 100

  method energy() = energy

  method fly(minutes) {
    energy = energy - minutes * 3
  }
}`

const testDefinition = (exampleName: string) => `import ${exampleName}.pepita

describe "group of tests for pepita" {

  test "pepita has initial energy" {
    assert.equals(100, pepita.energy())
  }

}`

const gameDefinition =  (exampleName: string) => `import wollok.game.*

import ${exampleName}.pepita

program PepitaGame {
	game.title("Pepita")
	game.height(10)
	game.width(10)

	// add assets in asset folder, for example, for the background
  // game.boardGround("fondo2.jpg")

	//

	game.showAttributes(pepita) //Debug

	game.start()
}
`

const packageJsonDefinition = (projectName: string, game: boolean) => `{
  "name": "${basename(projectName)}",
  "version": "1.0.0",
  ${game ? assetsConfiguration() : ''}"wollokVersion": "4.0.0",
  "author": "${userInfo().username}",
  "license": "ISC"
}
`

const assetsConfiguration = () => `"resourceFolder": "assets",${ENTER}  `

const ymlForCI = `name: build

on: [push, pull_request]
jobs:
  wollok-ts:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - run: |
          wget -O wollok-ts-cli https://github.com/uqbar-project/wollok-ts-cli/releases/latest/download/wollok-ts-cli-linux-x64
          chmod a+x ./wollok-ts-cli
          ./wollok-ts-cli test --skipValidations -p ./
        shell: bash
`

const readme = (exampleName: string) => `

## ${exampleName}

TODO

`