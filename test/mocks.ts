import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import { io as client, Socket } from 'socket.io-client'
import { MockInstance, vi } from 'vitest'
import * as game from '../src/game.js'
import * as utils from '../src/utils.js'

export const fakeIO = (): Server => {
  const app = express()
  const server = http.createServer(app)
  // Simulate listening
  server.listen = () => server
  server.addListener = (event: string, listener: (...args: any[]) => void) => {
    if (event === 'listening') listener()
    return server
  }
  // Avoid new servers
  vi
    .spyOn(http, 'createServer')
    .mockImplementation(() => server)
  return new Server(server)
}

export const connectClient = (port: number): Socket => {
  const socket = client(`http://localhost:${port}`)
  socket.on('connect', () => {
    socket.emit('ready')
  })
  return socket
}

export const received = (socket: Socket, event: string): Promise<any> =>
  new Promise((done) => {
    socket.on(event, done)
  })

export const handleErrorMock = (handler: (error: Error) => void): MockInstance =>
  vi.spyOn(utils, 'handleError').mockImplementation(handler)

export const exitMock = (handler: () => never = () => undefined as never): MockInstance =>
  vi.spyOn(process, 'exit').mockImplementation(handler)

export const initializeGameClientMock = (io: Server): MockInstance =>
  vi.spyOn(game, 'initializeGameClient').mockReturnValue(io)