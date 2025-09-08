import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import { join } from 'path'
import { readFileSync, rmSync } from 'fs'
import { homedir } from 'os'
import init, { type Options } from '../src/commands/init.js'
import test from '../src/commands/test.js'
import './assertions'

const project = join('examples', 'init-examples', 'basic-example')
const customFolderName = 'custom-folder'
const customFolderProject = join(project, customFolderName)
const absoluteFolder = join(homedir(), '_____folder_for_wollok_unit_test_please_remove_it______')
const GITHUB_FOLDER = join('.github', 'workflows')

const baseOptions: Options = {
  project,
  noCI: false,
  noTest: false,
  game: false,
  noGit: false,
}

describe('testing init', () => {

  let processExitSpy: MockInstance<(code?: number) => never>

  beforeEach(() => {
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
  })

  afterEach(() => {
    rmSync(project, { recursive: true, force: true })
    rmSync(customFolderProject, { recursive: true, force: true })
    rmSync(absoluteFolder, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('should create files successfully for default values: ci, no game, example name & git', async () => {
    init(undefined, baseOptions)

    expect(join(project, 'example.wlk')).pathExists()
    expect(join(project, 'testExample.wtest')).pathExists()
    expect(join(project, 'package.json')).pathExists()
    expect(join(project, GITHUB_FOLDER, 'ci.yml')).pathExists()
    expect(join(project, 'README.md')).pathExists()
    expect(join(project, '.gitignore')).pathExists()
    expect(join(project, 'mainExample.wpgm')).not.pathExists()
    expect(join(project, '.git')).pathExists()
    expect(join(project, '.git/HEAD')).pathExists()
    expect(getResourceFolder()).toBeUndefined()

    await test(undefined, {
      project,
      skipValidations: false,
      file: undefined,
      describe: undefined,
      test: undefined,
    })
    expect(processExitSpy).toHaveBeenCalledWith(0)
  })

  it('should create files successfully for game project with ci & custom example name', () => {
    init(undefined, {
      ...baseOptions,
      game: true,
      name: 'pepita',
    })

    expect(join(project, 'pepita.wlk')).pathExists()
    expect(join(project, 'testPepita.wtest')).pathExists()
    expect(join(project, 'mainPepita.wpgm')).pathExists()
    expect(join(project, 'package.json')).pathExists()
    expect(join(project, GITHUB_FOLDER, 'ci.yml')).pathExists()
    expect(join(project, 'README.md')).pathExists()
    expect(join(project, '.gitignore')).pathExists()
    expect(getResourceFolder()).toBe('assets')
    expect(processExitSpy).toHaveBeenCalledWith(0)
  })

  it('should create files successfully for game project with no ci & no test custom example name', async () => {
    init(undefined, {
      ...baseOptions,
      noCI: true,
      noTest: true,
      game: true,
      name: 'pepita',
    })

    expect(join(project, 'pepita.wlk')).pathExists()
    expect(join(project, 'testPepita.wtest')).not.pathExists()
    expect(join(project, 'package.json')).pathExists()
    expect(join(project, 'mainPepita.wpgm')).pathExists()
    expect(join(project, GITHUB_FOLDER, 'ci.yml')).not.pathExists()
    expect(join(project, '.gitignore')).pathExists()
    expect(join(project, 'README.md')).pathExists()
    expect(processExitSpy).toHaveBeenCalledWith(0)
  })

  it('should create files successfully with an argument for the folder name working in combination with project option', async () => {
    init(customFolderName, baseOptions)

    expect(join(customFolderProject, 'example.wlk')).pathExists()
    expect(join(customFolderProject, 'testExample.wtest')).pathExists()
    expect(join(customFolderProject, 'package.json')).pathExists()
    expect(join(customFolderProject, GITHUB_FOLDER, 'ci.yml')).pathExists()
    expect(join(customFolderProject, 'README.md')).pathExists()
    expect(join(customFolderProject, '.gitignore')).pathExists()
    expect(processExitSpy).toHaveBeenCalledWith(0)
  })

  it('should skip the initialization of a git repository if notGit flag es enabled', async () => {
    init(undefined, { ...baseOptions, noGit: true })

    expect(join(project, '.git')).not.pathExists()
    expect(join(project, '.git/HEAD')).not.pathExists()
    expect(join(project, 'example.wlk')).pathExists()
    expect(join(project, 'testExample.wtest')).pathExists()
    expect(join(project, 'package.json')).pathExists()
    expect(join(project, GITHUB_FOLDER, 'ci.yml')).pathExists()
    expect(join(project, 'README.md')).pathExists()
    expect(join(project, '.gitignore')).pathExists()
    expect(getResourceFolder()).toBeUndefined()
    expect(processExitSpy).toHaveBeenCalledWith(0)
  })

  it('should exit with code 1 if folder already exists', () => {
    init(undefined, {
      ...baseOptions,
      project: join('examples', 'init-examples', 'existing-folder'),
    })

    expect(processExitSpy).toHaveBeenCalledWith(1)
  })

  it('should create a natives folder when it is required', () => {
    init(undefined, {
      ...baseOptions,
      natives: 'myNatives',
    })
    expect(join(project, 'myNatives')).pathExists()
  })

  it('should create a natives nested folders when it is required', () => {
    const nativesFolder = join('myNatives', 'myReallyNatives')
    init(undefined, {
      ...baseOptions,
      natives: nativesFolder,
    })
    expect(join(project, nativesFolder)).pathExists()
  })

  it('should create a native folders event it is an absolute path', () => {
    init(undefined, {
      ...baseOptions,
      natives: absoluteFolder,
    })
    expect(absoluteFolder).pathExists()
  })

  it('should exit with code 1 if name is not valid', () => {
    init(undefined, {
      ...baseOptions,
      name: 'invalid@name',
    })
    expect(processExitSpy).toHaveBeenCalledWith(1)
  })

  it('should use kebab case in package json if name is in camel case', () => {
    const project = join('examples', 'init-examples', 'camelCaseProject')
    init(undefined, {
      ...baseOptions,
      project,
    })
    expect(processExitSpy).toHaveBeenCalledWith(0)
    const path = join(project, 'package.json')
    const packageJson = readFileSync(path, 'utf8')
    const { name } = JSON.parse(packageJson)
    expect(name).toBe('camel-case-project')
    rmSync(project, { recursive: true, force: true })
  })

  it('should keep snake case in package json if name is in snake case', () => {
    const project = join('examples', 'init-examples', 'snake_case_project')
    init(undefined, {
      ...baseOptions,
      project,
    })
    expect(processExitSpy).toHaveBeenCalledWith(0)
    const path = join(project, 'package.json')
    const packageJson = readFileSync(path, 'utf8')
    const { name } = JSON.parse(packageJson)
    expect(name).toBe('snake_case_project')
    rmSync(project, { recursive: true, force: true })
  })
})

const getResourceFolder = () => {
  const packageJson = readFileSync(join(project, 'package.json'), 'utf8')
  const { resourceFolder } = JSON.parse(packageJson)
  return resourceFolder
}