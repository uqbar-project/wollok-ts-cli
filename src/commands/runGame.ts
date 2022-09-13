import { Server } from 'socket.io'
import express from 'express'
import http from 'http'
import { app as client, BrowserWindow } from 'electron'



export default async function (): Promise<void> {
  const server = http.createServer(express())
  const io = new Server(server)
  const url = require('url');

  await client.whenReady()
  const win = new BrowserWindow({
        width: 800,
        height: 600,
        icon: __dirname + 'wollok.ico',
        title: 'Wollok Game',
        webPreferences: { 
            nodeIntegration: true,
            contextIsolation: false
            }
    })

    win.removeMenu()
    win.webContents.openDevTools()
    win.loadFile('./public/indexGame.html')
}

