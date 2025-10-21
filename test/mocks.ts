import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import { io as client, Socket } from 'socket.io-client'

const port = '8787'

export const fakeIO = (): Server => {
  const app = express()
  const server = http.createServer(app)
  const io = new Server(server)
  return io
}

export const connectClient = (io: Server): Socket => {
  const socket = client(`http://localhost:${port}`)
  socket.on('connect', () => {
    socket.emit('ready')
  })
  io.httpServer.listen(port)
  return socket
}

export const received = (socket: Socket, event: string): Promise<any> =>
  new Promise((done) => {
    socket.on(event, done)
  })