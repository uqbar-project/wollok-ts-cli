import { describe, it, expect, beforeEach } from 'vitest'
import { join } from 'path'
import { Interpreter, REPL } from 'wollok-ts'
import { initializeInterpreter, interpreteLine } from '../src/commands/repl.js'
import { failureDescription, successDescription } from '../src/utils.js'

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
      expect(result).toBe(successDescription('3'))
    })

    it('void expressions', () => {
      const result = interpreteLine(interpreter, '[].add(1)')
      expect(result).toBe(successDescription(''))
    })

    it('import sentences', () => {
      const result = interpreteLine(interpreter, 'import wollok.game.*')
      expect(result).toBe(successDescription(''))
    })

    it('const sentences', () => {
      const result = interpreteLine(interpreter, 'const a = 1')
      expect(result).toBe(successDescription(''))
      const result2 = interpreteLine(interpreter, 'a')
      expect(result2).toBe(successDescription('1'))
    })

    it('var sentences', () => {
      const result = interpreteLine(interpreter, 'var a = 1')
      expect(result).toBe(successDescription(''))
      const result2 = interpreteLine(interpreter, 'a = 2')
      expect(result2).toBe(successDescription(''))
      const result3 = interpreteLine(interpreter, 'a')
      expect(result3).toBe(successDescription('2'))
    })

    it('block without parameters', () => {
      const result = interpreteLine(interpreter, '{ 1 }.apply()')
      expect(result).toBe(successDescription('1'))
    })

    it('block with parameters', () => {
      const result = interpreteLine(interpreter, '{ x => x + 1 }.apply(1)')
      expect(result).toBe(successDescription('2'))
    })

    it('not parsing strings', () => {
      const result = interpreteLine(interpreter, '3kd3id9')
      expect(result).toContain('Unknown reference kd3id9')
    })

    it('failure expressions', () => {
      const result = interpreteLine(interpreter, 'fakeReference')
      expect(result).toBe(failureDescription('Unknown reference fakeReference'))
    })

    it('const assignment', () => {
      interpreteLine(interpreter, 'const a = 1')
      const result = interpreteLine(interpreter, 'a = 2')
      expect(result).toContain(failureDescription('Evaluation Error!'))
    })

    it('invalid message', () => {
      interpreteLine(interpreter, 'const numeric = 1')
      const result = interpreteLine(interpreter, 'numeric.coso()')
      expect(result).toContain(failureDescription('Evaluation Error!'))
      expect(result).toContain('wollok.lang.MessageNotUnderstoodException: 1 does not understand coso()')
    })

    it('invalid message inside closure', () => {
      const result = interpreteLine(interpreter, '[1, 2, 3].map({ number => number.coso() })')
      expect(result).toContain(failureDescription('Evaluation Error!'))
      expect(result).toContain('wollok.lang.MessageNotUnderstoodException: 1 does not understand coso()')
    })

    it('const const', () => {
      interpreteLine(interpreter, 'const a = 1')
      const result = interpreteLine(interpreter, 'const a = 2')
      expect(result).toContain(failureDescription('Evaluation Error!'))
    })

  })

  describe('should print result', () => {

    it('for reference to wko', () => {
      const result = interpreteLine(interpreter, 'assert')
      expect(result).toBe(successDescription('assert'))
    })

    it('for reference to an instance', () => {
      const result = interpreteLine(interpreter, 'new Object()')
      expect(result).toBe(successDescription('an Object'))
    })

    it.skip('for reference to a literal object', () => {
      const result = interpreteLine(interpreter, 'object { } ')
      console.info(result)
      expect(result).toContain('an Object#')
    })

    it('for number', () => {
      const result = interpreteLine(interpreter, '3')
      expect(result).toBe(successDescription('3'))
    })

    it('for string', () => {
      const result = interpreteLine(interpreter, '"hola"')
      expect(result).toBe(successDescription('"hola"'))
    })

    it('for boolean', () => {
      const result = interpreteLine(interpreter, 'true')
      expect(result).toBe(successDescription('true'))
    })

    it('for list', () => {
      const result = interpreteLine(interpreter, '[1, 2, 3]')
      expect(result).toBe(successDescription('[1, 2, 3]'))
    })

    it('for set', () => {
      const result = interpreteLine(interpreter, '#{1, 2, 3}')
      expect(result).toBe(successDescription('#{1, 2, 3}'))
    })

    it('for closure', () => {
      const result = interpreteLine(interpreter, '{1 + 2}')
      expect(result).toBe(successDescription('{1 + 2}'))
    })
  })


  describe('with file', () => {

    const fileName = join(projectPath, 'aves.wlk')

    beforeEach(async () =>
      interpreter = await initializeInterpreter(fileName, options)
    )

    it('should auto import the file and imported entities', () => {
      const replPackage = interpreter.evaluation.environment.replNode()
      expect(replPackage.fullyQualifiedName).toBe('aves')
      expect(replPackage.imports[0].entity.target!.fullyQualifiedName).toBe('otros.comidas')
    })

    it('file definitions should be accessible', () => {
      const result = interpreteLine(interpreter, 'pepita')
      expect(result).toBe(successDescription('pepita'))
    })

    it('imported definitions should be accessible', () => {
      const result = interpreteLine(interpreter, 'alpiste')
      expect(result).toBe(successDescription('alpiste'))
    })

    it('not imported definitions should not be accessible', () => {
      const result = interpreteLine(interpreter, 'ash')
      expect(result).toBe(failureDescription('Unknown reference ash'))
    })

    it('after generic import, definitions should be accessible', () => {
      const result = interpreteLine(interpreter, 'import otros.personas.entrenadores.*')
      expect(result).toBe(successDescription(''))
      const result2 = interpreteLine(interpreter, 'ash')
      expect(result2).toBe(successDescription('ash'))
    })

    it('after entity import, it should be accessible', () => {
      const result = interpreteLine(interpreter, 'import otros.personas.entrenadores.ash')
      expect(result).toBe(successDescription(''))
      const result2 = interpreteLine(interpreter, 'ash')
      expect(result2).toBe(successDescription('ash'))
    })

    it('should show only custom stack trace elements when an error occurs (with a file)', async () => {
      const result = interpreteLine(interpreter, 'pepitaRota.vola(10)')
      const stackTrace = result.split('\n')
      expect(stackTrace.length).toBe(3)
      expect(consoleCharacters(stackTrace[0])).toBe('✗ Evaluation Error!')
      expect(consoleCharacters(stackTrace[1])).toBe('wollok.lang.EvaluationError: TypeError: Message (+): parameter "papa" should be a number')
      expect(consoleCharacters(stackTrace[2])).toBe('at aves.pepitaRota.vola(distancia) [aves.wlk:23]')
    })

    describe('in a sub-folder', () => {

      const fileName = join(projectPath, 'otros', 'comidas.wlk')

      beforeEach(async () =>
        interpreter = await initializeInterpreter(fileName, options)
      )

      it('should auto import the file and relative imported entities', () => {
        const replPackage = interpreter.evaluation.environment.replNode()
        expect(replPackage.fullyQualifiedName).toBe('otros.comidas')
        expect(replPackage.imports[0].entity.target!.fullyQualifiedName).toBe('otros.personas.entrenadores')
      })

      it('file definitions should be accessible', () => {
        const result = interpreteLine(interpreter, 'alpiste')
        expect(result).toBe(successDescription('alpiste'))
      })

      it('imported definitions should be accessible', () => {
        const result = interpreteLine(interpreter, 'ash')
        expect(result).toBe(successDescription('ash'))
      })

    })

  })

  describe('without file', () => {

    it('should not auto import any file', () => {
      const replPackage = interpreter.evaluation.environment.replNode()
      expect(replPackage.fullyQualifiedName).toBe(REPL)
      expect(replPackage.imports).toHaveLength(0)
    })

    it('global definitions should be accessible', () => {
      const result = interpreteLine(interpreter, 'assert')
      expect(result).toBe(successDescription('assert'))
    })

    it('should show only custom stack trace elements when an error occurs (without a file)', async () => {
      const result = interpreteLine(interpreter, 'assert.equals(2, 1)')
      const stackTrace = result.split('\n')
      expect(stackTrace.length).toBe(2)
      expect(consoleCharacters(stackTrace[0])).toBe('✗ Evaluation Error!')
      expect(consoleCharacters(stackTrace[1])).toBe('wollok.lib.AssertionException: Expected <2> but found <1>')
    })

  })

  describe('user natives', () => {

    const project = join('examples', 'user-natives' )
    const nativesOptions = { ...options, project, natives: 'myNativesFolder' }

    it('should execute user natives', async () => {
      const nativeInterpreter = await initializeInterpreter(join(project, 'rootFile.wlk'), nativesOptions)
      const result = interpreteLine(nativeInterpreter, 'myModel.nativeOne()')
      expect(result).toBe(successDescription('1'))
    })

    it('should execute user natives in package', async () => {
      const nativeInterpreter = await initializeInterpreter(join(project, 'myPackage', 'myInnerFile.wlk'), nativesOptions)
      const result = interpreteLine(nativeInterpreter, 'packageModel.nativeTwo()')
      expect(result).toBe(successDescription('2'))
    })

  })

})

const consoleCharacters = (value: string) =>
  // eslint-disable-next-line no-control-regex
  value.replace(/\u001b\[.*?m/g, '').trim()