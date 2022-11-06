import { link, parse, Name, RuntimeObject, validate, WollokException, Id } from 'wollok-ts'
import interpret, { Interpreter } from 'wollok-ts/dist/interpreter/interpreter'
import natives from 'wollok-ts/dist/wre/wre.natives'
import { buildEnvironmentForProject, failureDescription, problemDescription, successDescription, valueDescription } from '../utils'
import  logger  from  'loglevel'
import { Server } from 'socket.io'
import express from 'express'
import http from 'http'
import { app as client, BrowserWindow } from 'electron'
import path from 'path'
import { buildKeyPressEvent, queueEvent, wKeyCode, CanvasResolution, canvasResolution, visualState } from './extrasGame';
import { StringDict } from 'p5'

const { time, timeEnd, log } = console

type Options = {
  project: string
  skipValidations: boolean
}
let interp: Interpreter
let io: Server
let folderImages: string
let timmer = 0
let sizeCanvas: CanvasResolution
//let loadedSounds: Map<Id, GameSound>

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

    let c = 0
    const nativesAndDraw = {
      ...natives,
      draw: {
        drawer: { *apply() {
          try {
            const game = interp?.object('wollok.game.game')
            const background = game.get('boardGround') ? game.get('boardGround')?.innerString : 'default'
            const visuals = getVisuals(game)
            const messages = getMessages(game)
            io.emit('cellPixelSize', game.get('cellSize')!.innerNumber!)
            io.emit('background', background)
            io.emit('visuals', visuals)
            io.emit('messages', messages)
            const gameSounds = game.get('sounds')?.innerCollection ?? []
            console.log(gameSounds)
            const mappedSounds = gameSounds.map( sound =>
            [
              sound.id,
              sound.get('file')!.innerString!,
              sound.get('status')!.innerString!,
              sound.get('volume')!.innerNumber!,
              sound.get('loop')!.innerBoolean!,
            ])
            console.log(mappedSounds)
            //loadedSounds = updateSound({ gameProject: project, interpreter: interp, sounds: loadedSounds, io: io })
            if(c < 10) {io.emit('updateSound', { path: folderSound(project), soundInstances: mappedSounds })}
            c++
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
    interp.send('onTick', game, interp.reify(1000), interp.reify('probando'), drawer )

    interp.run(programFQN)

    if(debug) timeEnd(successDescription('Run finalized successfully'))
  } catch (error: any) {
    logger.error(failureDescription('Uh-oh... An error occurred during the run!', error))
  }

  const title =  getTitle(interp)
  sizeCanvas = canvasResolution(interp)

  const server = http.createServer(express())
  io = new Server(server)
  const url = require('url');

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
      try {
        interp.send('flushEvents', game, interp.reify(timmer))
        timmer+=100
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
function getTitle(interp: Interpreter){
  const game = interp?.object('wollok.game.game')
  return interp ? interp?.send('title', game!)?.innerString : 'Wollok Game'
}

function getImages(pathProject : string){
  const images: { name: any, url: any }[] = []
  const fs = require('fs');
  const pathDirname = path.dirname(pathProject)

  fs.readdirSync(pathDirname).forEach((file: any) => {
    if (file == 'assets' || file == 'imagenes'){  folderImages = file }
  })
  const pathImage = path.join(pathDirname,'/',folderImages)
  fs.readdirSync(pathImage).filter((file:any) => {
    images.push({'name': file , 'url': path.join(pathDirname,'/',folderImages,'/', file )})
  })
  return images
}

function getVisuals(game: RuntimeObject){
  const visuals: { image: any, x: any; y: any }[] = []
  for (const visual of game.get('visuals')?.innerCollection ?? []) {
    const { image, position} = visualState(interp, visual)
    visuals.push({'image':image,'x': position.x,'y':position.y})
  }
  return visuals
}

function getMessages(game: RuntimeObject){
  const messages: DrawableMessage[] = []
  game.get('visuals')?.innerCollection?.forEach(visual => {
    const message = visual.get('message')?.innerString
    const messageTime = Number(visual.get('messageTime')?.innerValue)
    if (message != undefined && messageTime > timmer){
      const x = Number(getPosition(visual ,'x'))
      const y = Number(getPosition(visual ,'y'))
      const draw: DrawableMessage = {'message' : message, 'x': x, 'y': y}
      messages.push(draw)
    }
  })
  return messages
}

function getPosition(visual: RuntimeObject, position :string){
  return interp.send('position', visual)?.get(position)?.innerValue
}

function folderSound(pathProject: string): string {
  return path.join(path.dirname(pathProject), '/sounds/')
}

export interface DrawableMessage {
  message: string;
  x: number;
  y: number;
}

/*
function getSounds(pathProject : string){
  const sounds: { url: any }[] = []
  const fs = require('fs');
  const pathDirname = path.dirname(pathProject)

  fs.readdirSync(pathDirname).forEach((file: any) => {
    if (file == 'sounds'){  folderSounds = file }
  })
  const pathSound = path.join(pathDirname, '/', folderSounds )
  fs.readdirSync(pathSound).filter((file: any) => {
    sounds.push('url': path.join(pathDirname, '/', folderSounds, '/', file ))
  })
  return sounds
}

//----------------------------------------------------------------------------------
/*
interface SoundAssets {
  gameProject: string
  interpreter: Interpreter
  sounds: Map<Id, GameSound>
  io: Server
}

type SoundStatus = 'played' | 'paused' | 'stopped'
interface SoundState {
  id: Id;
  file: string;
  status: SoundStatus;
  volume: number;
  loop: boolean;
}

export class GameSound {
  public lastSoundState: SoundState
  public soundFile: string
  public started: boolean
  public toBePlayed: boolean

  constructor(lastSoundState: SoundState, soundPath: string) {
    this.lastSoundState = lastSoundState
    this.soundFile = soundPath
    this.started = false
    this.toBePlayed = false
  }

  public canBePlayed(newSoundState: SoundState): boolean {
    return this.lastSoundState.status !== newSoundState.status || !this.started //&& this.isLoaded()
  }

  public update(newSoundState: SoundState): void {
    /*Mover a sketch
    this.soundFile.setLoop(newSoundState.loop)
    this.soundFile.setVolume(newSoundState.volume)*//*
    this.toBePlayed = this.canBePlayed(newSoundState)
    this.lastSoundState = newSoundState
  }

  public play(io: Server): void {
    if (this.toBePlayed) {
      //this.started = true

      console.log("Llegue a play")
      switch (this.lastSoundState.status) {
        case 'played':
          io.emit('playSound', this.soundFile)
          break
        case 'paused':
          io.emit('pauseSound', this.soundFile)
          break
        case 'stopped':
          io.emit('stopSound', this.soundFile)
      }
    }
  }
}

function updateSound(assets: SoundAssets): Map<Id, GameSound> {
  const { gameProject, interpreter, sounds } = assets
  const soundInstances = interpreter.object('wollok.game.game').get('sounds')?.innerCollection ?? []

  for (const [id, sound] of sounds.entries()) {
    if (!soundInstances.some(sound => sound.id === id)) {
      io.emit('stopSound', sound.soundFile)
      sounds.delete(id)
    } else {
      sound.play(io)
    }
  }

  soundInstances.forEach(soundInstance => {
    const soundState: SoundState = {
      id: soundInstance.id,
      file: soundInstance.get('file')!.innerString!,
      status: soundInstance.get('status')!.innerString! as SoundStatus,
      volume: soundInstance.get('volume')!.innerNumber!,
      loop: soundInstance.get('loop')!.innerBoolean!,
    }

    let sound = sounds.get(soundState.id)
    if(!sound){
      sound = new GameSound(soundState, path.join(path.dirname(gameProject), '/sounds/', soundState.file))
      sounds.set(soundState.id, sound)
    }

    sound?.update(soundState)
  })
  return sounds
}*/