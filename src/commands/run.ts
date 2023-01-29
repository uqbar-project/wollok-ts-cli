import { app as client, BrowserWindow } from 'electron'
import express from 'express'
import http from 'http'
import logger from 'loglevel'
import path from 'path'
import { Server } from 'socket.io'
import { link, Name, parse, RuntimeObject, validate, WollokException } from 'wollok-ts'
import interpret, { Interpreter } from 'wollok-ts/dist/interpreter/interpreter'
import natives from 'wollok-ts/dist/wre/wre.natives'
import { buildEnvironmentForProject, failureDescription, problemDescription, successDescription, valueDescription } from '../utils'
import { buildKeyPressEvent, canvasResolution, Image, queueEvent, visualState, VisualState, wKeyCode } from './extrasGame'

const { time, timeEnd, log } = console
const fs = require('fs');

type Options = {
  project: string
  skipValidations: boolean
}
let interp: Interpreter
let io: Server
let folderImages: string
let timmer = 0
const namesFolder = ['imagenes', 'assets', 'img', 'asset']

export default async function (programFQN: Name, { project, skipValidations }: Options): Promise<void> {
  logger.info(`Running ${valueDescription(programFQN)} on ${valueDescription(project)}`)

  let environment = await buildEnvironmentForProject(project)
  environment = link([parse.File('draw').tryParse('object drawer{ method apply() native }')], environment)

  if(!skipValidations) {
    const problems = validate(environment)
    problems.forEach(problem => logger.info(problemDescription(problem)))
    if(!problems.length) logger.info(successDescription('No problems found building the environment!'))
    else if(problems.some(_ => _.level === 'error')) return logger.error(failureDescription('Aborting run due to validation errors!'))
  }

  logger.info(`Running ${valueDescription(programFQN)}...\n`)

  try {
    const debug = logger.getLevel() <= logger.levels.DEBUG
    if(debug) time(successDescription('Run finalized successfully'))

    const nativesAndDraw = {
      ...natives,
      draw: {
        drawer: { *apply() {
          try {
            const game = interp?.object('wollok.game.game')
            const background = game.get('boardGround') ? game.get('boardGround')?.innerString : 'default'
            const visuals = getVisuals(game)
            io.emit('background', background)
            io.emit('visuals', visuals)

            const gameSounds = game.get('sounds')?.innerCollection ?? []
            const mappedSounds = gameSounds.map( sound =>
              [
                sound.id,
                sound.get('file')!.innerString!,
                sound.get('status')!.innerString!,
                sound.get('volume')!.innerNumber!,
                sound.get('loop')!.innerBoolean!,
              ])
            io.emit('updateSound', { path: folderSound(project), soundInstances: mappedSounds })
          } catch (e: any){
            if (e instanceof WollokException) logger.error(failureDescription(e.message))
            interp.send('stop', game)
          }
        }},
      },
    }

    interp = interpret(environment, nativesAndDraw)

    const game = interp?.object('wollok.game.game')
    const drawer = interp.object('draw.drawer')
    interp.send('onTick', game, interp.reify(17), interp.reify('renderizar'), drawer )

    interp.run(programFQN)

    if(debug) timeEnd(successDescription('Run finalized successfully'))
  } catch (error: any) {
    logger.error(failureDescription('Uh-oh... An error occurred during the run!', error))
  }

  const sizeCanvas = canvasResolution(interp)

  const server = http.createServer(express())
  io = new Server(server)

  io.on('connection', socket => {
    log('Client connected!')
    socket.on('disconnect', () => { log('Client disconnected!') })
    socket.on('keyPressed', key => {
      queueEvent(interp, buildKeyPressEvent(interp, wKeyCode(key.key, key.keyCode)), buildKeyPressEvent(interp, 'ANY'))
    })
    socket.emit('images', getImages(project))
    socket.emit('sizeCanvasInic', [sizeCanvas.width,sizeCanvas.height])

    const id = setInterval(() => {
      const game = interp?.object('wollok.game.game')
      socket.emit('cellPixelSize', game.get('cellSize')!.innerNumber!)
      try {
        interp.send('flushEvents', game, interp.reify(timmer))
        timmer+=300
        if(!game.get('running')) {clearInterval(id)}
      } catch(e: any){
        interp.send('stop', game)
        socket.emit('errorDetected', e.message)
        clearInterval(id)
      }
    }, 100)
  })
  server.listen(3000)

  await client.whenReady()
  const win = new BrowserWindow({
    width: sizeCanvas.width,
    height: sizeCanvas.height,
    icon: __dirname + 'wollok.ico',
    title: getTitle(interp),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  win.removeMenu()
  win.loadFile('./public/indexGame.html')
}

function getTitle(interp: Interpreter){
  const game = interp?.object('wollok.game.game')
  return interp ? interp?.send('title', game!)?.innerString : 'Wollok Game'
}

function getImages(pathProject : string){
  const images: Image[] = []

  const pathDirname = path.dirname(pathProject)
  fs.readdirSync(pathDirname).forEach((file: any) => {
    if (namesFolder.includes(file)){ folderImages = file }
  })
  const pathImage = path.join(pathDirname,'/',folderImages)
  fs.readdirSync(pathImage).filter((file: any) => {
    if(file.endsWith('png') || file.endsWith('jpg')) {
      images.push({ 'name': file, 'url': path.join(pathDirname, '/', folderImages, '/', file )})
    }
  })
  return images
}

function getVisuals(game: RuntimeObject){
  const visuals: VisualState[] = []
  for (const visual of game.get('visuals')?.innerCollection ?? []) {
    const { image, position, message } = visualState(interp, visual)
    const messageTime = Number(visual.get('messageTime')?.innerValue)

    if (message != undefined && messageTime > timmer){
      visuals.push({ 'image': image, 'position': position, 'message': message})
    } else {
      visuals.push({ 'image': image, 'position': position, 'message': undefined})
    }
  }
  return visuals
}

function folderSound(pathProject: string){
  const pathDirname = path.dirname(pathProject)
  const folder = fs.readdirSync(pathDirname).includes('sounds') ? 'sounds' : folderImages

  return path.join(path.dirname(pathProject), '/' + folder + '/')
}