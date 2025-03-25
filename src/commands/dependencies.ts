import { execSync } from 'child_process'
import path from 'path'
import logger from 'loglevel'

export type Options = {
  project: string
  verbose: boolean
}

const executeNpmCommand = (command: string, project: string, verbose: boolean): void => {
  const fullCommand = `npm ${command}`
  if (verbose) {
    logger.info(`Executing in ${project}: ${fullCommand}`)
  }
  execSync(fullCommand, { cwd: path.resolve(project), stdio: 'inherit' })
}

export const addDependency = (pkg: string, { project, verbose }: Options): void => {
  executeNpmCommand(`install ${pkg}`, project, verbose)
}

export const removeDependency = (pkg: string, { project, verbose }: Options): void => {
  executeNpmCommand(`uninstall ${pkg}`, project, verbose)
}

export const synchronizeDependencies = ({ project, verbose }: Options): void => {
  executeNpmCommand('install', project, verbose)
}