import express from 'express'
import http from 'http'
import logger from 'loglevel'
import path from 'path'
import { Server } from 'socket.io'
import { link, Name, parse, RuntimeObject, validate, WollokException } from 'wollok-ts'
import interpret, { Interpreter } from 'wollok-ts/dist/interpreter/interpreter'
import natives from 'wollok-ts/dist/wre/wre.natives'
import { buildEnvironmentForProject, failureDescription, problemDescription, publicPath, successDescription, valueDescription } from '../utils'
import { buildKeyPressEvent, canvasResolution, Image, queueEvent, visualState, VisualState, wKeyCode } from './extrasGame'
import fs, { Dirent } from 'fs'
import cors from 'cors'
import { bold } from 'chalk'

const { time, timeEnd } = console

type Options = {
  project: string
  assets: string | undefined
  skipValidations: boolean
  port: string
}
let interp: Interpreter
let io: Server
let folderImages: string
let timmer = 0

export default async function (programFQN: Name, { project, assets, skipValidations, port }: Options): Promise<void> {
  logger.info(`Running ${valueDescription(programFQN)} on ${valueDescription(project)}`)
  const packageProperties = readPackageProperties(project)

  folderImages = path.join(project, assets ?? packageProperties.assets)

  let environment = await buildEnvironmentForProject(project)
  environment = link([parse.File('draw').tryParse('object drawer{ method apply() native }')], environment)

  if (!skipValidations) {
    const problems = validate(environment)
    problems.forEach(problem => logger.info(problemDescription(problem)))
    if (!problems.length) logger.info(successDescription('No problems found building the environment!'))
    else if (problems.some(_ => _.level === 'error')) return logger.error(failureDescription('Aborting run due to validation errors!'))
  }

  logger.info(`Running ${valueDescription(programFQN)}...\n`)

  try {
    const debug = logger.getLevel() <= logger.levels.DEBUG
    if (debug) time(successDescription('Run finalized successfully'))

    const nativesAndDraw = {
      ...natives,
      draw: {
        drawer: {
          *apply() {
            try {
              const game = interp?.object('wollok.game.game')
              const background = game.get('boardGround') ? game.get('boardGround')?.innerString : 'default'
              const visuals = getVisuals(game)
              io.emit('background', background)
              io.emit('visuals', visuals)

              const gameSounds = game.get('sounds')?.innerCollection ?? []
              const mappedSounds = gameSounds.map(sound =>
                [
                  sound.id,
                  sound.get('file')!.innerString!,
                  sound.get('status')!.innerString!,
                  sound.get('volume')!.innerNumber!,
                  sound.get('loop')!.innerBoolean!,
                ])
              io.emit('updateSound', { path: folderSound(project), soundInstances: mappedSounds })
            } catch (e: any) {
              if (e instanceof WollokException) logger.error(failureDescription(e.message))
              interp.send('stop', game)
            }
          },
        },
      },
    }

    interp = interpret(environment, nativesAndDraw)

    const game = interp?.object('wollok.game.game')
    const drawer = interp.object('draw.drawer')
    interp.send('onTick', game, interp.reify(17), interp.reify('renderizar'), drawer)

    interp.run(programFQN)

    if (debug) timeEnd(successDescription('Run finalized successfully'))
  } catch (error: any) {
    logger.error(failureDescription('Uh-oh... An error occurred during the run!', error))
  }

  const sizeCanvas = canvasResolution(interp)

  const app = express()
  const server = http.createServer(app)
  io = new Server(server)

  app.use(
    cors({ allowedHeaders: '*' }),
    express.static(publicPath('game'), { maxAge: '1d' }),
    express.static(folderImages, { maxAge: '1d' }))
  server.listen(parseInt(port), 'localhost')

  logger.info(successDescription('Game available at: ' + bold(`http://localhost:${port}`)))

  io.on('connection', socket => {
    logger.info(successDescription('Running game!'))
    socket.on('disconnect', () => { logger.info(successDescription('Game finished')) })
    socket.on('keyPressed', key => {
      queueEvent(interp, buildKeyPressEvent(interp, wKeyCode(key.key, key.keyCode)), buildKeyPressEvent(interp, 'ANY'))
    })
    socket.emit('images', getImages())
    socket.emit('sizeCanvasInic', [sizeCanvas.width, sizeCanvas.height])

    const id = setInterval(() => {
      const game = interp?.object('wollok.game.game')
      socket.emit('cellPixelSize', game.get('cellSize')!.innerNumber!)
      try {
        interp.send('flushEvents', game, interp.reify(timmer))
        timmer += 300
        if (!game.get('running')) { clearInterval(id) }
      } catch (e: any) {
        interp.send('stop', game)
        socket.emit('errorDetected', e.message)
        clearInterval(id)
      }
    }, 100)
  })
  server.listen(3000)
}

function getImages() {
  const images: Image[] = []
  const loadImagesIn = (basePath: string) => fs.readdirSync(basePath, { withFileTypes: true })
    .forEach((file: Dirent) => {
      if (file.isDirectory()) loadImagesIn(path.join(basePath, file.name))
      else {
        if (file.name.endsWith('png') || file.name.endsWith('jpg')) {
          const fileName = path.relative(folderImages, path.join(basePath, file.name)) 
          images.push({ 'name': fileName, 'url': fileName })
        }
      }
    })
  loadImagesIn(folderImages)
  return images
}

function getVisuals(game: RuntimeObject) {
  const visuals: VisualState[] = []
  for (const visual of game.get('visuals')?.innerCollection ?? []) {
    const { image, position, message } = visualState(interp, visual)
    const messageTime = Number(visual.get('messageTime')?.innerValue)

    if (message != undefined && messageTime > timmer) {
      visuals.push({ 'image': image, 'position': position, 'message': message })
    } else {
      visuals.push({ 'image': image, 'position': position, 'message': undefined })
    }
  }
  return visuals
}

function folderSound(pathProject: string) {
  const pathDirname = path.dirname(pathProject)
  const folder = fs.readdirSync(pathDirname).includes('sounds') ? 'sounds' : folderImages

  return path.join(path.dirname(pathProject), '/' + folder + '/')
}

function readPackageProperties(pathProject: string): any {
  const packagePath = path.join(pathProject, 'package.json')
  return JSON.parse(fs.readFileSync(packagePath, { encoding: 'utf-8' }))
}