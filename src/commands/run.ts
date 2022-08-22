import { Evaluation, Name, validate } from 'wollok-ts'
import interpret from 'wollok-ts/dist/interpreter/interpreter'
import natives from 'wollok-ts/dist/wre/wre.natives'
import { buildEnvironmentForProject, failureDescription, problemDescription, successDescription, valueDescription } from '../utils'
import  logger  from  'loglevel'
import { Server } from 'socket.io'
import express from 'express'
import http from 'http'
import path from 'path'
import { app as client, BrowserWindow } from 'electron'


const { time, timeEnd, log } = console

type Options = {
  project: string
  skipValidations: boolean
}

export default async function (programFQN: Name, { project, skipValidations }: Options): Promise<void> {
  logger.info(`Running ${valueDescription(programFQN)} on ${valueDescription(project)}`)

  const environment = await buildEnvironmentForProject(project)

  if(!skipValidations) {
    const problems = validate(environment)
    problems.forEach(problem => logger.info(problemDescription(problem)))
    if(!problems.length) logger.info(successDescription('No problems found building the environment!'))
    else if(problems.some(_ => _.level === 'error')) return logger.error(failureDescription('Aborting run due to validation errors!'))
  }

  logger.info(`Running ${valueDescription(programFQN)}...\n`)
  let interp
  try {
    const debug = logger.getLevel() <= logger.levels.DEBUG
    if(debug) time(successDescription('Run finalized successfully'))
    // console.log(environment.members)
    interp = interpret(environment, natives)
    interp.run(programFQN)
    // interp.evaluation.allInstances().forEach((obj) => console.log(obj.module.fullyQualifiedName()))
    // console.log(interp.evaluation.allInstances())
    if(debug) timeEnd(successDescription('Run finalized successfully'))
  } catch (error: any) {
    logger.error(failureDescription('Uh-oh... An error occurred during the run!', error))
  }

  let evaluation = interp?.evaluation
  let titlee = evaluation?.send('title', evaluation?.object('wollok.game.game')).next().value
  console.log(titlee)
  
  log()
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
    })
    server.listen(3000)

    await client.whenReady()
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        icon: __dirname + 'wollok.ico',
        // title: titlee,
        webPreferences: { 
            nodeIntegration: true,
            }
    })
    
    win.removeMenu()
    // win.webContents.openDevTools()
    win.loadFile('./public/indexGame.html')
}