import { should } from 'chai'
import { join } from 'path'
import { Interpreter } from 'wollok-ts/dist/interpreter/interpreter'
import { initializeInterpreter, interprete, REPL, replNode } from '../src/commands/repl'
import { failureDescription, successDescription, valueDescription } from '../src/utils'

const projectPath = join('examples', 'repl-examples')

should()

describe('REPL', () => {

  const options = {
    project: projectPath,
    skipValidations: false,
    darkMode: true,
    port: '8080',
    skipDiagram: false,
  }
  let interpreter: Interpreter

  beforeEach(async () =>
    interpreter = await initializeInterpreter(undefined, options)
  )

  it('value expressions', () => {
    const result = interprete(interpreter, '1 + 2')
    result.should.be.equal(successDescription('3'))
  })

  it('void expressions', () => {
    const result = interprete(interpreter, '[].add(1)')
    result.should.be.equal(successDescription(''))
  })

  it('import sentences', () => {
    const result = interprete(interpreter, 'import wollok.game.*')
    result.should.be.equal(successDescription(''))
  })

  it('const sentences', () => {
    const result = interprete(interpreter, 'const a = 1')
    result.should.be.equal(successDescription(''))
    const result2 = interprete(interpreter, 'a')
    result2.should.be.equal(successDescription('1'))
  })

  it('var sentences', () => {
    const result = interprete(interpreter, 'var a = 1')
    result.should.be.equal(successDescription(''))
    const result2 = interprete(interpreter, 'a = 2')
    result2.should.be.equal(successDescription(''))
    const result3 = interprete(interpreter, 'a')
    result3.should.be.equal(successDescription('2'))
  })

  it('block without parameters', () => {
    const result = interprete(interpreter, '{ 1 }.apply()')
    result.should.be.equal(successDescription('1'))
  })

  it('block with parameters', () => {
    const result = interprete(interpreter, '{ x => x + 1 }.apply(1)')
    result.should.be.equal(successDescription('2'))
  })

  it('not parsing strings', () => {
    const result = interprete(interpreter, '3kd3id9')
    result.should.includes('Syntax error')
  })

  it('failure expressions', () => {
    const result = interprete(interpreter, 'fakeReference')
    result.should.be.equal(failureDescription(`Unknown reference ${valueDescription('fakeReference')}`))
  })

  it('const assignment', () => {
    interprete(interpreter, 'const a = 1')
    const result = interprete(interpreter, 'a = 2')
    result.should.includes(failureDescription('Evaluation Error!'))
  })

  // TODO: Change the Runtime model
  xit('const const', () => {
    interprete(interpreter, 'const a = 1')
    const result = interprete(interpreter, 'const a = 2')
    result.should.includes(failureDescription('Evaluation Error!'))
  })


  describe('should print result', () => {

    it('for reference to wko', () => {
      const result = interprete(interpreter, 'assert')
      result.should.be.equal(successDescription('assert'))
    })

    it('for reference to an instance', () => {
      const result = interprete(interpreter, 'new Object()')
      result.should.be.equal(successDescription('an Object'))
    })

    it('for reference to a literal object', () => {
      const result = interprete(interpreter, 'object { } ')
      result.should.include('an Object#')
    })

    it('for number', () => {
      const result = interprete(interpreter, '3')
      result.should.be.equal(successDescription('3'))
    })

    it('for string', () => {
      const result = interprete(interpreter, '"hola"')
      result.should.be.equal(successDescription('"hola"'))
    })

    it('for boolean', () => {
      const result = interprete(interpreter, 'true')
      result.should.be.equal(successDescription('true'))
    })

    it('for list', () => {
      const result = interprete(interpreter, '[1, 2, 3]')
      result.should.be.equal(successDescription('[1, 2, 3]'))
    })

    it('for set', () => {
      const result = interprete(interpreter, '#{1, 2, 3}')
      result.should.be.equal(successDescription('#{1, 2, 3}'))
    })

    it('for closure', () => {
      const result = interprete(interpreter, '{1 + 2}')
      result.should.be.equal(successDescription('{1 + 2}'))
    })
  })

  describe('with file', () => {

    const fileName = join(projectPath, 'aves.wlk')

    beforeEach(async () =>
      interpreter = await initializeInterpreter(fileName, options)
    )

    it('should auto import the file and imported entities', () => {
      const replPackage = replNode(interpreter.evaluation.environment)
      replPackage.fullyQualifiedName.should.be.equal('aves')
      replPackage.imports[0].entity.target!.fullyQualifiedName.should.be.equal('otros.comidas')
    })

    it('file definitions should be accessible', () => {
      const result = interprete(interpreter, 'pepita')
      result.should.be.equal(successDescription('pepita'))
    })

    it('imported definitions should be accessible', () => {
      const result = interprete(interpreter, 'alpiste')
      result.should.be.equal(successDescription('alpiste'))
    })

    it('not imported definitions should not be accessible', () => {
      const result = interprete(interpreter, 'ash')
      result.should.be.equal(failureDescription(`Unknown reference ${valueDescription('ash')}`))
    })

    it('after generic import, definitions should be accessible', () => {
      const result = interprete(interpreter, 'import otros.personas.entrenadores.*')
      result.should.be.equal(successDescription(''))
      const result2 = interprete(interpreter, 'ash')
      result2.should.be.equal(successDescription('ash'))
    })

    it('after entity import, it should be accessible', () => {
      const result = interprete(interpreter, 'import otros.personas.entrenadores.ash')
      result.should.be.equal(successDescription(''))
      const result2 = interprete(interpreter, 'ash')
      result2.should.be.equal(successDescription('ash'))
    })

    it('should show only custom stack trace elements when an error occurs (with a file)', async () => {
      const result = interprete(interpreter, 'pepitaRota.vola(10)')
      const stackTrace = result.split('\n')
      stackTrace.length.should.equal(3)
      consoleCharacters(stackTrace[0]).should.be.equal('✗ Evaluation Error!')
      consoleCharacters(stackTrace[1]).should.be.equal('wollok.lang.EvaluationError wrapping TypeScript TypeError: Expected an instance of wollok.lang.Number but got a wollok.lang.String instead')
      consoleCharacters(stackTrace[2]).should.be.equal('at aves.pepitaRota.vola(distancia) [aves.wlk:22]')
    })

    describe('in a sub-folder', () => {

      const fileName = join(projectPath, 'otros', 'comidas.wlk')

      beforeEach(async () =>
        interpreter = await initializeInterpreter(fileName, options)
      )

      it('should auto import the file and relative imported entities', () => {
        const replPackage = replNode(interpreter.evaluation.environment)
        replPackage.fullyQualifiedName.should.be.equal('otros.comidas')
        replPackage.imports[0].entity.target!.fullyQualifiedName.should.be.equal('otros.personas.entrenadores')
      })

      it('file definitions should be accessible', () => {
        const result = interprete(interpreter, 'alpiste')
        result.should.be.equal(successDescription('alpiste'))
      })

      it('imported definitions should be accessible', () => {
        const result = interprete(interpreter, 'ash')
        result.should.be.equal(successDescription('ash'))
      })

    })

  })

  describe('without file', () => {

    it('should not auto import any file', () => {
      const replPackage = replNode(interpreter.evaluation.environment)
      replPackage.fullyQualifiedName.should.be.equal(REPL)
      replPackage.imports.should.be.empty
    })

    it('global definitions should be accessible', () => {
      const result = interprete(interpreter, 'assert')
      result.should.be.equal(successDescription('assert'))
    })

    it('should show only custom stack trace elements when an error occurs (without a file)', async () => {
      const result = interprete(interpreter, 'assert.equals(2, 1)')
      const stackTrace = result.split('\n')
      stackTrace.length.should.equal(2)
      consoleCharacters(stackTrace[0]).should.be.equal('✗ Evaluation Error!')
      consoleCharacters(stackTrace[1]).should.be.equal('wollok.lib.AssertionException: Expected <2> but found <1>')
    })

  })
})

const consoleCharacters = (value: string) =>
  // eslint-disable-next-line no-control-regex
  value.replace(/\u001b\[.*?m/g, '').trim()