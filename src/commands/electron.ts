
import { app as client, BrowserWindow } from 'electron'
      
client.whenReady().then(() => {
    const win = new BrowserWindow({
    width: 800,
    height: 600,
    icon: __dirname + 'wollok.ico',
    })
    win.removeMenu()
    // win.webContents.openDevTools()
    win.loadFile('../public/index.html')
})