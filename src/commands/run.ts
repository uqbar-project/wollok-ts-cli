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
import globby from 'globby'


const { time, timeEnd, log } = console

type Options = {
  project: string
  skipValidations: boolean
}
let interp: Interpreter
let ioo: Server
let folderImages : string

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
            console.log("llegamos? Sí. Llegamos.", new Date()) 
            const game = interp?.object('wollok.game.game')
            const background = game.get('boardGround') ? game.get('boardGround')?.innerString : 'default'
            const visuals = getPositions(game, project)
            ioo.emit('background', background)
            ioo.emit('visuals', visuals)
          } catch (e){
            console.log(e)
          }
        }},
      },
    }

    interp = interpret(environment, nativesAndDraw)

    const game = interp?.object('wollok.game.game')
    const drawer = interp.object('draw.drawer')
    interp.send('onTick', game, interp.reify(1000), interp.reify('probando'), drawer )

    interp.run(programFQN)

    if(debug) timeEnd(successDescription('Run finalized successfully'))
  } catch (error: any) {
    logger.error(failureDescription('Uh-oh... An error occurred during the run!', error))
  }

  const game = interp?.object('wollok.game.game')
  const title = interp ? interp?.send('title', game!)?.innerString : 'Wollok Game'
  const width = interp?.send('width', game!)?.innerNumber
  const height = interp?.send('height', game!)?.innerNumber


  const server = http.createServer(express())
  ioo = new Server(server)
  const url = require('url');

  ioo.on('connection', socket => {
    log('Client connected!')
    socket.on('disconnect', () => { log('Client disconnected!') })

    socket.emit('images', getImages(project))

    let timmer = 0
    setInterval(() => {interp.send('flushEvents', game, interp.reify(timmer)); timmer+=5000 },5000)
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

}
function getImages(pathProject : string){
  let images: { name : any , url:any }[] = []
  const fs = require('fs');
  const pathDirname = path.dirname(pathProject)
  
  fs.readdirSync(pathDirname).forEach((file:any) => {
    if (file == 'assets' || file == 'imagenes'){  folderImages = file }
  })
  const pathImage = path.join(pathDirname,'/',folderImages)
  fs.readdirSync(pathImage).filter((file:any) => {
    images.push({'name': file , 'url': path.join(pathDirname,'/',folderImages,'/', file )})
  });
  return images
}

function getPositions(game: RuntimeObject, pathProject :string){
  let visuals: { image : any , x: InnerValue | undefined; y: InnerValue | undefined }[] = []
  game.get('visuals')?.innerCollection?.forEach(v => {
    const image = interp.send('image', v)?.innerString!
    let x = interp.send('position', v)?.get('x')?.innerValue
    let y = interp.send('position', v)?.get('y')?.innerValue
    visuals.push({'image':image,'x': x,'y':y})
  })
  return visuals
}