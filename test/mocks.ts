import express from 'express'
import http from 'http'
import { Server } from 'socket.io'

export const fakeIO = (): Server => {
  const app = express()
  const server = http.createServer(app)
  const io = new Server(server)
  return io
}