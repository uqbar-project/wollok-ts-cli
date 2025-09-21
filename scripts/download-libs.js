import path from "node:path"
import fs from "fs"
import http from "node:http"
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const libsToDownload = [
  {
    libDest: "game",
    libs: [
      {
        filename: "p5.min.js",
        url: "http://cdnjs.cloudflare.com/ajax/libs/p5.js/1.10.0/p5.min.js",
      },
      {
        filename: "p5.sound.min.js",
        url: "http://cdnjs.cloudflare.com/ajax/libs/p5.js/1.10.0/addons/p5.sound.min.js",
      },
      {
        filename: "socket.io.esm.min.js",
        url: "http://cdn.socket.io/4.7.5/socket.io.esm.min.js",
      },
      {
        filename: "socket.io.esm.min.js.map",
        url: "http://cdn.socket.io/4.7.5/socket.io.esm.min.js.map",
      },
    ],
  },
  {
    libDest: "diagram",
    libs: [
      {
        filename: "socket.io.esm.min.js",
        url: "http://cdn.socket.io/4.7.5/socket.io.esm.min.js",
      },
      {
        filename: "socket.io.esm.min.js.map",
        url: "http://cdn.socket.io/4.7.5/socket.io.esm.min.js.map",
      },
      {
        filename: "cytoscape.min.js",
        url: "http://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.30.2/cytoscape.min.js",
      },
    ],
  },
]
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

for (const { libDest, libs } of libsToDownload) {
  console.log(`Downloading ${libDest} libraries`)

  const libFolder = path.resolve(__dirname, "../public", libDest, "lib")

  if (!fs.existsSync(libFolder)) {
    console.log("Creating lib folder")
    fs.mkdirSync(libFolder, { recursive: true })
  }

  for (const { filename, url } of libs) {
    const dest = path.join(libFolder, filename)
    if (!fs.existsSync(dest)) {
      download(url, dest)
    } else {
      console.log(`Found local version of ${filename}, skipping download`)
    }
  }
}

function download(url, dest) {
  console.log(`Downloading from ${url}`)
  const file = fs.createWriteStream(dest)
  const options = {}
  http
    .get(url, options, (response) => {
      response.pipe(file)
      file.on("finish", () => file.close())
    })
    .on("error", function (err) {
      fs.unlink(dest)
      console.log(err.message)
    })
}
