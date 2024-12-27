import { execSync } from 'child_process'
import path from 'path'
import { existsSync } from 'fs'  // Importar existsSync
import console from 'console'
import { Project } from '../utils'

export type Options = { //TODO revisar lo que se necesita!
  project: string,
  update: boolean,
}

const installDependencies = (projectPath: string): void => {
  if (!existsSync(path.join(projectPath, 'node_modules'))) {
    console.log('node_modules folder not found. Installing dependencies...')
  } else {
    console.log('Synchronizing dependencies...')
  }

  execSync('npm install', { cwd: projectPath, stdio: 'inherit' })
}

const add = ( { project, update=false } : Options, packages: string[]): void => {
  const proj = new Project(project)
  proj.properties.dependencies = proj.properties.dependencies || {}

  packages.forEach(pkg => {
    const [name, version] = pkg.split('@')
    if (proj.properties.dependencies[name]) {
      console.log(`Updating ${name} to version ${version || 'latest'}`)
    } else {
      console.log(`Adding ${name} version ${version || 'latest'}`)
    }
    proj.properties.dependencies[name] = version || 'latest'
  })
  proj.save()
  if (update) {
    installDependencies(project)
  }
}

const remove = ( { project, update }: Options, packages: string[] ): void => {
  const proj = new Project(project)

  proj.properties.dependencies = proj.properties.dependencies || {}

  packages.forEach(pkg => {
    if (proj.properties.dependencies[pkg]) {
      console.log(`Removing ${pkg}`)
      delete proj.properties.dependencies[pkg]
    } else {
      console.log(`${pkg} is not a dependency`)
    }
  })

  proj.save()
  if (update) {
    installDependencies(project)
  }
}

const download = (options: Options): void => {
  installDependencies(options.project)
}

export default { add, remove, download }