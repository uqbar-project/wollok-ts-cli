import { should } from 'chai'
import { join } from 'path'
import { Interpreter, REPL } from 'wollok-ts'
import { initializeInterpreter, interpreteLine } from '../src/commands/repl'
import { failureDescription, successDescription } from '../src/utils'

should()

const projectPath = join('examples', 'repl-examples')

describe('REPL', () => {

  const options = {
    project: projectPath,
    assets: '',
    skipValidations: false,
    darkMode: true,
    port: '8080',
    host: 'localhost',
    skipDiagram: true,
  }

  let interpreter: Interpreter

  beforeEach(async () =>
    interpreter = await initializeInterpreter(undefined, options)
  )

  describe('expressions', () => {

    it('value expressions', () => {
      const result = interpreteLine(interpreter, '1 + 2')
      result.should.be.equal(successDescription('3'))
    })

    it('void expressions', () => {
      const result = interpreteLine(interpreter, '[].add(1)')
      result.should.be.equal(successDescription(''))
    })

    it('import sentences', () => {
      const result = interpreteLine(interpreter, 'import wollok.game.*')
      result.should.be.equal(successDescription(''))
    })

    it('const sentences', () => {
      const result = interpreteLine(interpreter, 'const a = 1')
      result.should.be.equal(successDescription(''))
      const result2 = interpreteLine(interpreter, 'a')
      result2.should.be.equal(successDescription('1'))
    })

    it('var sentences', () => {
      const result = interpreteLine(interpreter, 'var a = 1')
      result.should.be.equal(successDescription(''))
      const result2 = interpreteLine(interpreter, 'a = 2')
      result2.should.be.equal(successDescription(''))
      const result3 = interpreteLine(interpreter, 'a')
      result3.should.be.equal(successDescription('2'))
    })

    it('block without parameters', () => {
      const result = interpreteLine(interpreter, '{ 1 }.apply()')
      result.should.be.equal(successDescription('1'))
    })

    it('block with parameters', () => {
      const result = interpreteLine(interpreter, '{ x => x + 1 }.apply(1)')
      result.should.be.equal(successDescription('2'))
    })

    it('not parsing strings', () => {
      const result = interpreteLine(interpreter, '3kd3id9')
      result.should.includes('Syntax error')
    })

    it('failure expressions', () => {
      const result = interpreteLine(interpreter, 'fakeReference')
      result.should.be.equal(failureDescription('Unknown reference fakeReference'))
    })

    it('const assignment', () => {
      interpreteLine(interpreter, 'const a = 1')
      const result = interpreteLine(interpreter, 'a = 2')
      result.should.includes(failureDescription('Evaluation Error!'))
    })

    it('invalid message', () => {
      interpreteLine(interpreter, 'const numeric = 1')
      const result = interpreteLine(interpreter, 'numeric.coso()')
      result.should.includes(failureDescription('Evaluation Error!'))
      result.should.includes('wollok.lang.MessageNotUnderstoodException: 1 does not understand coso()')
    })

    it('invalid message inside closure', () => {
      const result = interpreteLine(interpreter, '[1, 2, 3].map({ number => number.coso() })')
      result.should.includes(failureDescription('Evaluation Error!'))
      result.should.includes('wollok.lang.MessageNotUnderstoodException: 1 does not understand coso()')
    })

    it('const const', () => {
      interpreteLine(interpreter, 'const a = 1')
      const result = interpreteLine(interpreter, 'const a = 2')
      result.should.includes(failureDescription('Evaluation Error!'))
    })

  })

  describe('should print result', () => {

    it('for reference to wko', () => {
      const result = interpreteLine(interpreter, 'assert')
      result.should.be.equal(successDescription('assert'))
    })

    it('for reference to an instance', () => {
      const result = interpreteLine(interpreter, 'new Object()')
      result.should.be.equal(successDescription('an Object'))
    })

    it('for reference to a literal object', () => {
      const result = interpreteLine(interpreter, 'object { } ')
      result.should.include('an Object#')
    })

    it('for number', () => {
      const result = interpreteLine(interpreter, '3')
      result.should.be.equal(successDescription('3'))
    })

    it('for string', () => {
      const result = interpreteLine(interpreter, '"hola"')
      result.should.be.equal(successDescription('"hola"'))
    })

    it('for boolean', () => {
      const result = interpreteLine(interpreter, 'true')
      result.should.be.equal(successDescription('true'))
    })

    it('for list', () => {
      const result = interpreteLine(interpreter, '[1, 2, 3]')
      result.should.be.equal(successDescription('[1, 2, 3]'))
    })

    it('for set', () => {
      const result = interpreteLine(interpreter, '#{1, 2, 3}')
      result.should.be.equal(successDescription('#{1, 2, 3}'))
    })

    it('for closure', () => {
      const result = interpreteLine(interpreter, '{1 + 2}')
      result.should.be.equal(successDescription('{1 + 2}'))
    })
  })


  describe('with file', () => {

    const fileName = join(projectPath, 'aves.wlk')

    beforeEach(async () =>
      interpreter = await initializeInterpreter(fileName, options)
    )

    it('should auto import the file and imported entities', () => {
      const replPackage = interpreter.evaluation.environment.replNode()
      replPackage.fullyQualifiedName.should.be.equal('aves')
      replPackage.imports[0].entity.target!.fullyQualifiedName.should.be.equal('otros.comidas')
    })

    it('file definitions should be accessible', () => {
      const result = interpreteLine(interpreter, 'pepita')
      result.should.be.equal(successDescription('pepita'))
    })

    it('imported definitions should be accessible', () => {
      const result = interpreteLine(interpreter, 'alpiste')
      result.should.be.equal(successDescription('alpiste'))
    })

    it('not imported definitions should not be accessible', () => {
      const result = interpreteLine(interpreter, 'ash')
      result.should.be.equal(failureDescription('Unknown reference ash'))
    })

    it('after generic import, definitions should be accessible', () => {
      const result = interpreteLine(interpreter, 'import otros.personas.entrenadores.*')
      result.should.be.equal(successDescription(''))
      const result2 = interpreteLine(interpreter, 'ash')
      result2.should.be.equal(successDescription('ash'))
    })

    it('after entity import, it should be accessible', () => {
      const result = interpreteLine(interpreter, 'import otros.personas.entrenadores.ash')
      result.should.be.equal(successDescription(''))
      const result2 = interpreteLine(interpreter, 'ash')
      result2.should.be.equal(successDescription('ash'))
    })

    it('should show only custom stack trace elements when an error occurs (with a file)', async () => {
      const result = interpreteLine(interpreter, 'pepitaRota.vola(10)')
      const stackTrace = result.split('\n')
      stackTrace.length.should.equal(3)
      consoleCharacters(stackTrace[0]).should.be.equal('✗ Evaluation Error!')
      consoleCharacters(stackTrace[1]).should.be.equal('wollok.lang.EvaluationError: TypeError: Message (+): parameter "papa" should be a number')
      consoleCharacters(stackTrace[2]).should.be.equal('at aves.pepitaRota.vola(distancia) [aves.wlk:23]')
    })

    describe('in a sub-folder', () => {

      const fileName = join(projectPath, 'otros', 'comidas.wlk')

      beforeEach(async () =>
        interpreter = await initializeInterpreter(fileName, options)
      )

      it('should auto import the file and relative imported entities', () => {
        const replPackage = interpreter.evaluation.environment.replNode()
        replPackage.fullyQualifiedName.should.be.equal('otros.comidas')
        replPackage.imports[0].entity.target!.fullyQualifiedName.should.be.equal('otros.personas.entrenadores')
      })

      it('file definitions should be accessible', () => {
        const result = interpreteLine(interpreter, 'alpiste')
        result.should.be.equal(successDescription('alpiste'))
      })

      it('imported definitions should be accessible', () => {
        const result = interpreteLine(interpreter, 'ash')
        result.should.be.equal(successDescription('ash'))
      })

    })

  })

  describe('without file', () => {

    it('should not auto import any file', () => {
      const replPackage = interpreter.evaluation.environment.replNode()
      replPackage.fullyQualifiedName.should.be.equal(REPL)
      replPackage.imports.should.be.empty
    })

    it('global definitions should be accessible', () => {
      const result = interpreteLine(interpreter, 'assert')
      result.should.be.equal(successDescription('assert'))
    })

    it('should show only custom stack trace elements when an error occurs (without a file)', async () => {
      const result = interpreteLine(interpreter, 'assert.equals(2, 1)')
      const stackTrace = result.split('\n')
      stackTrace.length.should.equal(2)
      consoleCharacters(stackTrace[0]).should.be.equal('✗ Evaluation Error!')
      consoleCharacters(stackTrace[1]).should.be.equal('wollok.lib.AssertionException: Expected <2> but found <1>')
    })

  })

  describe('User Natives', () => {

    const project = join('examples', 'user-natives' )
    const opt = { ...options, project: project }

    it('should execute user natives', async () => {
      interpreter = await initializeInterpreter(join(project, 'rootFile.wlk'), opt)

      const result = interpreteLine(interpreter, 'myModel.nativeOne()')
      result.should.be.equal(successDescription('1'))
    })

    it('should execute user natives in package', async () => {
      interpreter = await initializeInterpreter(join(project, 'myPackage', 'myInnerFile.wlk'), opt)

      const result = interpreteLine(interpreter, 'packageModel.nativeTwo()')
      result.should.be.equal(successDescription('2'))
    })

  })

})


const consoleCharacters = (value: string) =>
  // eslint-disable-next-line no-control-regex
  value.replace(/\u001b\[.*?m/g, '').trim()