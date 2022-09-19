import { Evaluation, InnerValue, link, parse, Name, RuntimeObject, validate } from 'wollok-ts'
import interpret, { Interpreter } from 'wollok-ts/dist/interpreter/interpreter'
import natives from 'wollok-ts/dist/wre/wre.natives'
import { buildEnvironmentForProject, failureDescription, problemDescription, successDescription, valueDescription } from '../utils'
import  logger  from  'loglevel'
import { Server } from 'socket.io'
import express from 'express'
import http from 'http'
import { app as client, BrowserWindow } from 'electron'
import path from 'path'
import { appendFileSync } from 'fs'


const { time, timeEnd, log } = console
const carpetaImgs = 'imagenes'
// TO-DO
//Acá habria que ver como hacer para agregar todos los nombres 
//posibles de la carpeta que contiene las imagenes (assets)

type Options = {
  project: string
  skipValidations: boolean
}
let interp: Interpreter

export default async function (programFQN: Name, { project, skipValidations }: Options): Promise<void> {
  logger.info(`Running ${valueDescription(programFQN)} on ${valueDescription(project)}`)

  let environment = await buildEnvironmentForProject(project)
  environment = link([parse.File('applier').tryParse('object applier{ method apply() native }')], environment)

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

    const nativesAndApply = {
      ...natives,
      applier: {
        applier: { *apply() { console.log("llegamos? Sí. Llegamos.")} },
      },
    }

    interp = interpret(environment, nativesAndApply)
    interp.run(programFQN)

    if(debug) timeEnd(successDescription('Run finalized successfully'))
  } catch (error: any) {
    logger.error(failureDescription('Uh-oh... An error occurred during the run!', error))
  }

  const game = interp?.object('wollok.game.game')
  const title = interp ? interp?.send('title', game!)?.innerString : 'Wollok Game'
  const width = interp?.send('width', game!)?.innerNumber
  const height = interp?.send('height', game!)?.innerNumber

  const pathDirname = path.dirname(project)

  const background = game.get('boardGround') ? game.get('boardGround')?.innerString : 'default'
  const pathBackground = path.join(pathDirname, '/', carpetaImgs, '/', background! )
  const visualsImages = getImages(game, pathDirname)
  const positions = getPositions(game)

  const server = http.createServer(express())
  const io = new Server(server)
  const url = require('url');

  io.on('connection', socket => {
    log('Client connected!')
    socket.on('disconnect', () => { log('Client disconnected!') })

    let count = 0

    socket.on('pong', payload => {
      log(`Received pong from client with value: ${payload}`)
      count = payload
    })
    socket.emit('getPathBackround', pathBackground)
    socket.emit('VisualsImage', visualsImages)
    socket.emit('VisualsPositions', positions)
  })
  server.listen(3000)

  await client.whenReady()
  const win = new BrowserWindow({
    width: width ? width*50 : 800,
    height: height ? height*50 : 600,
    icon: __dirname + 'wollok.ico',
    title: title,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  win.removeMenu()
  win.webContents.openDevTools()
  win.loadFile('./public/indexGame.html')
  interp.send('apply', interp.object('applier.applier'))
}

function getImages(game : RuntimeObject, pathProject : string){
  const visualsImages: (string | number | boolean | Error | RuntimeObject[] | null | undefined)[] = []
  game.get('visuals')?.innerCollection?.forEach(v => {
    const image = interp.send('image', v)?.innerString
    visualsImages.push(path.join(pathProject,'/',carpetaImgs,'/', image! ))
  })
  return visualsImages
}

function getPositions(game: RuntimeObject){
  const positions: { x: InnerValue | undefined; y: InnerValue | undefined }[] = []
  game.get('visuals')?.innerCollection?.forEach(v => {
    const x = interp.send('position', v)?.get('x')?.innerValue
    const y = interp.send('position', v)?.get('y')?.innerValue
    positions.push({'x': x,'y':y})
  })
  return positions
}