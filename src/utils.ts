import { blue, bold, green, italic, red, yellowBright } from 'chalk'
import fs, { Dirent } from 'fs'
import { readFile } from 'fs/promises'
import globby from 'globby'
import logger from 'loglevel'
import path, { join } from 'path'
import { buildEnvironment, Environment, Problem, RuntimeObject } from 'wollok-ts'

const { time, timeEnd } = console


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// FILE / PATH HANDLING
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
export function relativeFilePath(project: string, filePath: string): string {
  return path.relative(project, filePath).split('.')[0]
}

export function getFQN(project: string, filePath: string): string {
  return relativeFilePath(project, filePath).replaceAll(path.sep, '.')
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// ENVIRONMENT CREATION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
export async function buildEnvironmentForProject(cwd: string): Promise<Environment> {
  const paths = await globby('**/*.@(wlk|wtest|wpgm)', { cwd })

  const debug = logger.getLevel() <= logger.levels.DEBUG

  if (debug) time('Reading project files')
  const files = await Promise.all(paths.map(async name =>
    ({ name, content: await readFile(join(cwd, name), 'utf8') })
  ))
  if (debug) timeEnd('Reading project files')

  if (debug) time('Building environment')
  try { return buildEnvironment(files) }
  finally { if (debug) timeEnd('Building environment') }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PRINTING
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const valueDescription = (val: any): string => italic(blue(val))

export const successDescription = (description: string): string =>
  green(`${bold('✓')} ${description}`)

export const failureDescription = (description: string, e?: Error): string => {
  const stack = e?.stack
    ?.replaceAll('\t', '  ')
    ?.replaceAll('     ', '  ')
    ?.replaceAll('    ', '  ')
    ?.split('\n')?.join('\n  ')

  return red(`${bold('✗')} ${description}${stack ? '\n  ' + stack : ''}`)
}

export const problemDescription = (problem: Problem): string => {
  const color = problem.level === 'warning' ? yellowBright : red
  const header = bold(`[${problem.level.toUpperCase()}]`)
  return color(`${header}: ${problem.code} at ${problem.node?.sourceInfo ?? 'unknown'}`)
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RESOURCES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const publicPath = (...paths: string[]): string => {
  return path.join(__dirname, '..', 'public', ...paths)
}

export const readPackageProperties = (pathProject: string): any | undefined => {
  const packagePath = path.join(pathProject, 'package.json')
  if (!fs.existsSync(packagePath)) return undefined
  return JSON.parse(fs.readFileSync(packagePath, { encoding: 'utf-8' }))
}

const imageExtensions = ['png', 'jpg']
export const isImageFile = (file: Dirent) => imageExtensions.some(ext => file.name.endsWith(ext))

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// WOLLOK AST
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════


export function isConstant(obj: RuntimeObject, localName: string): boolean {
  return !!obj.module.allFields.find((field: { name: string }) => field.name === localName)?.isConstant
}