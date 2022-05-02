import { readFile } from 'fs/promises'
import globby from 'globby'
import { join } from 'path'
import { buildEnvironment, Name, Program, validate } from 'wollok-ts'
import interpret from 'wollok-ts/dist/interpreter/interpreter'
import natives from 'wollok-ts/dist/wre/wre.natives'

const { time, timeEnd, log } = console

type Options = {
  project: string
  skipValidations: boolean
}


export default async function (programFQN: Name, { project, skipValidations }: Options): Promise<void> {
  log(`Running ${programFQN} on ${project}`)

  const paths = await globby('**/*.@(wlk|wtest|wpgm)', { cwd: project })

  time('Reading project files')
  const files = await Promise.all(paths.map(async name =>
    ({ name, content: await readFile(join(project, name), 'utf8') })
  ))
  timeEnd('Reading project files')

  time('Building environment')
  const environment = buildEnvironment(files)
  timeEnd('Building environment')

  if(!skipValidations) {
    const problems = validate(environment)
    if (problems.length) throw new Error(`Found ${problems.length} problems building the environment!: ${problems.map(({ code, node }) => `${code} at ${node?.sourceInfo() ?? 'unknown'}`).join('\n')}`)
    else log('No problems found building the environment!')
  }

  time(`Running ${programFQN}`)
  const program = environment.getNodeByFQN<Program>(programFQN)
  interpret(environment, natives).exec(program)
  timeEnd(`Running ${programFQN}`)
  log('Done.')
}