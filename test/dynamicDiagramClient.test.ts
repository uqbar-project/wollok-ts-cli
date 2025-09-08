import { join } from 'path'
import { Evaluation, Interpreter, WRENatives } from 'wollok-ts'
import { buildEnvironmentForProject, initializeDynamicDiagram } from '../src/utils.js'
import { beforeEach, describe, expect, it } from 'vitest'

describe('dynamic diagram client', () => {
  const projectPath = join('examples', 'repl-examples')

  const options = {
    project: projectPath,
    assets: '',
    skipValidations: false,
    darkMode: true,
    port: '8080',
    host: 'localhost',
    skipDiagram: false,
  }
  let interpreter: Interpreter

  beforeEach(async () =>
    interpreter = new Interpreter(Evaluation.build(await buildEnvironmentForProject(projectPath), WRENatives))
  )

  it('should work for root path', async () => {
    const { enabled, server } = initializeDynamicDiagram(interpreter, options, interpreter.evaluation.environment.replNode())
    try {
      expect(enabled).toBe(true)
      const response = await fetch(`http://${options.host}:${options.port}/index.html`)
      expect(response.status).toBe(200)
    } finally {
      server?.close()
    }
  })

  it('should return a fake client if does not start diagram', () => {
    const { enabled, server } = initializeDynamicDiagram(interpreter, options, interpreter.evaluation.environment.replNode(), false)
    expect(enabled).to.be.false
    expect(server).to.be.undefined
  })

  // testing failure cases are extremely complicated due to server listeners and async notifications

})