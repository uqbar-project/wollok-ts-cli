import chai, { use } from 'chai'
import { join } from 'path'
import { readFileSync, rmSync } from 'fs'
import sinon from 'sinon'
import init, { Options } from '../src/commands/init'
import test from '../src/commands/test'
import { pathAssertions } from './assertions'

chai.should()

const expect = chai.expect
use(pathAssertions)

const project = join('examples', 'init-examples', 'basic-example')
const customFolderName = 'custom-folder'
const customFolderProject = join(project, customFolderName)
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
    expect(processExitSpy.callCount).to.equal(0)
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
  })

  it('should create files successfully with an argument for the folder name working in combination with project option', async () => {
    init(customFolderName, baseOptions)

    expect(join(customFolderProject, 'example.wlk')).to.pathExists()
    expect(join(customFolderProject, 'testExample.wtest')).to.pathExists()
    expect(join(customFolderProject, 'package.json')).to.pathExists()
    expect(join(customFolderProject, GITHUB_FOLDER, 'ci.yml')).to.pathExists()
    expect(join(customFolderProject, 'README.md')).to.pathExists()
    expect(join(customFolderProject, '.gitignore')).to.pathExists()
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
  })

  it('should exit with code 1 if folder already exists', () => {
    init(undefined, {
      ...baseOptions,
      project: join('examples', 'init-examples', 'existing-folder'),
    })

    expect(processExitSpy.calledWith(1)).to.be.true
  })
})

const getResourceFolder = () => {
  const packageJson = readFileSync(join(project, 'package.json'), 'utf8')
  const { resourceFolder } = JSON.parse(packageJson)
  return resourceFolder
}