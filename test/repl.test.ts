import { should } from 'chai'
import { join } from 'path'
import { Import } from 'wollok-ts'
import { Interpreter } from 'wollok-ts/dist/interpreter/interpreter'
import { initializeInterpreter, interprete } from '../src/commands/repl'
import { failureDescription, successDescription, valueDescription } from '../src/utils'

const projectPath = join('examples')

should()

describe('REPL', () => {

    const options = {
        project: projectPath,
        skipValidations: false
    }
    let interpreter: Interpreter
    let imports: Import[]

    beforeEach(async () => {
        [interpreter, imports] = await initializeInterpreter(undefined, options)
    })

    describe('should accept', () => {

        it('value expressions', () => {
            const result = interprete(interpreter, imports, '1 + 2')
            result.should.be.equal(successDescription('3'))
        })

        it('void expressions', () => {
            const result = interprete(interpreter, imports, '[].add(1)')
            result.should.be.equal(successDescription(''))
        })

        it('not parsing strings', () => {
            const result = interprete(interpreter, imports, '3kd3id9')
            result.should.includes('Syntax error')
        })

        it('failure expressions', () => {
            const result = interprete(interpreter, imports, 'fakeReference')
            result.should.be.equal(failureDescription(`Unknown reference ${valueDescription('fakeReference')}`))
        })
    })

    describe('with file', () => {

        const fileName = join(projectPath, 'aves.wlk')

        beforeEach(async () => {
            [interpreter, imports] = await initializeInterpreter(fileName, options)
        })

        it('should auto import the file', () => {
            imports.should.be.have.lengthOf(1)
            imports[0].entity.name.should.be.equal('aves')
        })

        it('file definitions should be accessible', () => {
            const result = interprete(interpreter, imports, 'pepita')
            result.should.be.equal(successDescription('pepita'))
        })

        it('imported definitions should be accessible', () => {
            const result = interprete(interpreter, imports, 'alpiste')
            result.should.be.equal(successDescription('alpiste'))
        })

        it('can be initialized with sub-folders file', async () => {
            [interpreter, imports] = await initializeInterpreter(join(projectPath, 'otros', 'personas', 'entrenadores'), options)
            imports.should.be.have.lengthOf(1)
            const result = interprete(interpreter, imports, 'ash')
            result.should.be.equal(successDescription('ash'))

        })
    })

    describe('without file', () => {

        it('should not auto import any file', () => {
            imports.should.be.empty
        })

        it('global definitions should be accessible', () => {
            const result = interprete(interpreter, imports, 'assert')
            result.should.be.equal(successDescription('assert'))
        })
    })
})