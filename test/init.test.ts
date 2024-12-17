import chai, { use } from 'chai'
import { join } from 'path'
import { readFileSync, rmSync } from 'fs'
import sinon from 'sinon'
import init, { Options } from '../src/commands/init'
import test, { Options as TestOptions } from '../src/commands/test'
import { pathAssertions, jsonAssertions } from './assertions'

chai.should()

const expect = chai.expect
use(pathAssertions)
use(jsonAssertions)

const project = join('examples', 'init-examples', 'basic-example')
const customFolderName = 'custom-folder'
const customFolderProject = join(project, customFolderName)
const GITHUB_FOLDER = join('.github', 'workflows')

const baseOptions = Options.new({
  project: project,
  noCI: false,
  noTest: false,
  game: false,
  noGit: false,
})

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
    init(baseOptions)

    expect(join(project, 'example.wlk')).to.pathExists
    expect(join(project, 'testExample.wtest')).to.pathExists
    expect(join(project, 'package.json')).to.pathExists
    expect(join(project, GITHUB_FOLDER, 'ci.yml')).to.pathExists
    expect(join(project, 'README.md')).to.pathExists
    expect(join(project, '.gitignore')).to.pathExists
    expect(join(project, 'mainExample.wpgm')).to.not.pathExists
    expect(join(project, '.git')).to.pathExists
    expect(join(project, '.git/HEAD')).to.pathExists
    expect(getResourceFolder()).to.be.undefined

    await test(undefined, TestOptions.new({
      project: project,
      skipValidations: false,
    }))
    expect(processExitSpy.callCount).to.equal(0)
  })

  it('should create files successfully for game project with ci & custom example name', () => {
    init(baseOptions.new({
      game: true,
      name: 'pepita',
    }))

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
    init(baseOptions.new({
      noCI: true,
      noTest: true,
      game: true,
      name: 'pepita',
    }))

    expect(join(project, 'pepita.wlk')).to.pathExists
    expect(join(project, 'testPepita.wtest')).to.not.pathExists
    expect(join(project, 'package.json')).to.pathExists
    expect(join(project, 'mainPepita.wpgm')).to.not.pathExists
    expect(join(project, GITHUB_FOLDER, 'ci.yml')).to.not.pathExists
    expect(join(project, '.gitignore')).to.pathExists
    expect(join(project, 'README.md')).to.pathExists
  })

  it('should create files successfully with an argument for the folder name working in combination with project option', async () => {
    init(baseOptions.new({ name: 'pepita', folder: customFolderName }))


    expect(join(customFolderProject, 'pepita.wlk')).to.pathExists
    expect(join(customFolderProject, 'testPepita.wtest')).to.pathExists
    expect(join(customFolderProject, 'mainPepita.wpgm')).to.not.pathExists
    expect(join(customFolderProject, 'package.json')).to.pathExists
    expect(join(customFolderProject, GITHUB_FOLDER, 'ci.yml')).to.pathExists
    expect(join(customFolderProject, 'README.md')).to.pathExists
    expect(join(customFolderProject, '.gitignore')).to.pathExists
  })

  it('should skip the initialization of a git repository if notGit flag es enabled', async () => {
    init(baseOptions.new({ noGit: true }))

    expect(join(project, '.git')).not.to.pathExists
    expect(join(project, '.git/HEAD')).not.to.pathExists
    expect(join(project, 'example.wlk')).to.pathExists
    expect(join(project, 'testExample.wtest')).to.pathExists
    expect(join(project, 'package.json')).to.pathExists
    expect(join(project, GITHUB_FOLDER, 'ci.yml')).to.pathExists
    expect(join(project, 'README.md')).to.pathExists
    expect(join(project, '.gitignore')).to.pathExists
    expect(join(project, 'mainExample.wpgm')).to.not.pathExists
    expect(getResourceFolder()).to.be.undefined
  })

  it('should exit with code 1 if folder already exists', () => {
    init(baseOptions.new({ project: join('examples', 'init-examples', 'existing-folder') }))

    expect(processExitSpy.calledWith(1)).to.be.true
  })

  it('should create a natives folder when it is required', () => {
    init(baseOptions.new({ natives: 'myNatives' }))
    expect(join(project, 'myNatives')).to.pathExists
    expect('package.json')
    expect(join(project, 'package.json')).jsonMatch({ natives: 'myNatives' })

  })

  it('should create a natives nested folders when it is required', () => {
    const nativesFolder =join('myNatives', 'myReallyNatives')
    init(baseOptions.new({ natives: nativesFolder }))
    expect(join(project, 'package.json')).jsonMatch({ natives: nativesFolder })

  })

  it('should not create a natives folders when it is not specified', () => {
    init(baseOptions)
    expect(join(project, 'package.json')).not.jsonKeys(['natives'])
  })


})

const getResourceFolder = () => {
  const packageJson = readFileSync(join(project, 'package.json'), 'utf8')
  const { resourceFolder } = JSON.parse(packageJson)
  return resourceFolder
}