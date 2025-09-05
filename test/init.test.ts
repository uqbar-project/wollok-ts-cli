import chai, { use } from 'chai'
import { join } from 'path'
import { readFileSync, rmSync } from 'fs'
import sinon from 'sinon'
import init, { Options } from '../src/commands/init.js'
import test from '../src/commands/test.js'
import { pathAssertions } from './assertions.js'
import { homedir } from 'os'

chai.should()

const expect = chai.expect
use(pathAssertions)

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

  let processExitSpy: sinon.SinonStub

  beforeEach(() => {
    processExitSpy = sinon.stub(process, 'exit')
  })

  afterEach(() => {
    rmSync(project, { recursive: true, force: true })
    rmSync(customFolderProject, { recursive: true, force: true })
    rmSync(absoluteFolder, { recursive: true, force: true })
    sinon.restore()
  })

  it('should create files successfully for default values: ci, no game, example name & git', async () => {
    init(undefined, baseOptions)

    expect(join(project, 'example.wlk')).to.pathExists()
    expect(join(project, 'testExample.wtest')).to.pathExists()
    expect(join(project, 'package.json')).to.pathExists()
    expect(join(project, GITHUB_FOLDER, 'ci.yml')).to.pathExists()
    expect(join(project, 'README.md')).to.pathExists()
    expect(join(project, '.gitignore')).to.pathExists()
    expect(join(project, 'mainExample.wpgm')).not.to.pathExists()
    expect(join(project, '.git')).to.pathExists()
    expect(join(project, '.git/HEAD')).to.pathExists()
    expect(getResourceFolder()).to.be.undefined

    await test(undefined, {
      project,
      skipValidations: false,
      file: undefined,
      describe: undefined,
      test: undefined,
    })
    expect(processExitSpy.calledWith(0)).to.be.true
  })

  it('should create files successfully for game project with ci & custom example name', () => {
    init(undefined, {
      ...baseOptions,
      game: true,
      name: 'pepita',
    })

    expect(join(project, 'pepita.wlk')).to.pathExists()
    expect(join(project, 'testPepita.wtest')).to.pathExists()
    expect(join(project, 'mainPepita.wpgm')).to.pathExists()
    expect(join(project, 'package.json')).to.pathExists()
    expect(join(project, GITHUB_FOLDER, 'ci.yml')).to.pathExists()
    expect(join(project, 'README.md')).to.pathExists()
    expect(join(project, '.gitignore')).to.pathExists()
    expect(getResourceFolder()).to.be.equal('assets')
    expect(processExitSpy.calledWith(0)).to.be.true
  })

  it('should create files successfully for game project with no ci & no test custom example name', async () => {
    init(undefined, {
      ...baseOptions,
      noCI: true,
      noTest: true,
      game: true,
      name: 'pepita',
    })

    expect(join(project, 'pepita.wlk')).to.pathExists()
    expect(join(project, 'testPepita.wtest')).not.to.pathExists()
    expect(join(project, 'package.json')).to.pathExists()
    expect(join(project, 'mainPepita.wpgm')).to.pathExists()
    expect(join(project, GITHUB_FOLDER, 'ci.yml')).not.pathExists()
    expect(join(project, '.gitignore')).to.pathExists()
    expect(join(project, 'README.md')).to.pathExists()
    expect(processExitSpy.calledWith(0)).to.be.true
  })

  it('should create files successfully with an argument for the folder name working in combination with project option', async () => {
    init(customFolderName, baseOptions)


    expect(join(customFolderProject, 'example.wlk')).to.pathExists()
    expect(join(customFolderProject, 'testExample.wtest')).to.pathExists()
    expect(join(customFolderProject, 'package.json')).to.pathExists()
    expect(join(customFolderProject, GITHUB_FOLDER, 'ci.yml')).to.pathExists()
    expect(join(customFolderProject, 'README.md')).to.pathExists()
    expect(join(customFolderProject, '.gitignore')).to.pathExists()
    expect(processExitSpy.calledWith(0)).to.be.true
  })

  it('should skip the initialization of a git repository if notGit flag es enabled', async () => {
    init(undefined, { ...baseOptions, noGit: true })

    expect(join(project, '.git')).not.to.pathExists()
    expect(join(project, '.git/HEAD')).not.to.pathExists()
    expect(join(project, 'example.wlk')).to.pathExists()
    expect(join(project, 'testExample.wtest')).to.pathExists()
    expect(join(project, 'package.json')).to.pathExists()
    expect(join(project, GITHUB_FOLDER, 'ci.yml')).to.pathExists()
    expect(join(project, 'README.md')).to.pathExists()
    expect(join(project, '.gitignore')).to.pathExists()
    expect(getResourceFolder()).to.be.undefined
    expect(processExitSpy.calledWith(0)).to.be.true
  })

  it('should exit with code 1 if folder already exists', () => {
    init(undefined, {
      ...baseOptions,
      project: join('examples', 'init-examples', 'existing-folder'),
    })

    expect(processExitSpy.calledWith(1)).to.be.true
  })

  it('should create a natives folder when it is required', () => {
    init(undefined, {
      ...baseOptions,
      natives: 'myNatives',
    })
    expect(join(project, 'myNatives')).to.pathExists()

  })

  it('should create a natives nested folders when it is required', () => {
    const nativesFolder =join('myNatives', 'myReallyNatives')
    init(undefined, {
      ...baseOptions,
      natives: nativesFolder,
    })
    expect(join(project, nativesFolder)).to.pathExists()
  })

  it('should create a native folders event it is an absolute path', () => {
    init(undefined, {
      ...baseOptions,
      natives: absoluteFolder,
    })
    expect(absoluteFolder).to.pathExists
  })

  it('should exit with code 1 if name is not valid', () => {
    init(undefined, {
      ...baseOptions,
      name: 'invalid@name',
    })
    expect(processExitSpy.calledWith(1)).to.be.true
  })

  it('should use kebab case in package json if name is in camel case', () => {
    const project = join('examples', 'init-examples', 'camelCaseProject')
    init(undefined, {
      ...baseOptions,
      project,
    })
    expect(processExitSpy.calledWith(0)).to.be.true
    const path = join(project, 'package.json')
    const packageJson = readFileSync(path, 'utf8')
    const { name } = JSON.parse(packageJson)
    expect(name).to.be.equal('camel-case-project')
    rmSync(project, { recursive: true, force: true })
  })

  it('should keep snake case in package json if name is in snake case', () => {
    const project = join('examples', 'init-examples', 'snake_case_project')
    init(undefined, {
      ...baseOptions,
      project,
    })
    expect(processExitSpy.calledWith(0)).to.be.true
    const path = join(project, 'package.json')
    const packageJson = readFileSync(path, 'utf8')
    const { name } = JSON.parse(packageJson)
    expect(name).to.be.equal('snake_case_project')
    rmSync(project, { recursive: true, force: true })
  })
})

const getResourceFolder = () => {
  const packageJson = readFileSync(join(project, 'package.json'), 'utf8')
  const { resourceFolder } = JSON.parse(packageJson)
  return resourceFolder
}