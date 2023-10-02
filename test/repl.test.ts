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
  }
  let interpreter: Interpreter

  beforeEach(async () =>
    interpreter = await initializeInterpreter(undefined, options)
  )

  describe('should accept', () => {

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

    it('not parsing strings', () => {
      const result = interprete(interpreter, '3kd3id9')
      result.should.includes('Syntax error')
    })

    it('failure expressions', () => {
      const result = interprete(interpreter, 'fakeReference')
      result.should.be.equal(failureDescription(`Unknown reference ${valueDescription('fakeReference')}`))
    })
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
  })
})