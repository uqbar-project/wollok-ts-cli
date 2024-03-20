var wko
var backgroundImage
var messageError
var gameWidth = 0
var gameHeight = 0
const sizeFactor = 50
var cellPixelSize
var images = new Array()
var visuals = new Array()
var sounds = new Map()

function preload() {
  loadAllImages()
  wko = loadImage("./wko.png")
  defaultBackground = loadImage("./background.jpg")
  socket.on("sizeCanvasInic", (size) => {
      gameWidth = size[0]
      gameHeight = size[1]
      resizeCanvas(gameWidth, gameHeight)
  })
  socket.on("cellPixelSize", (size) => {
    cellPixelSize = size
  })
}

function setup() {
  createCanvas(windowWidth - 20, windowHeight - 20)
  socket.on("updateSound", (data) => {
    updateSound(data.soundInstances)
  })
  loadBackground()
  loadVisuals()
  socket.emit("ready")
}

function draw() {
  clear()
  if (backgroundImage) background(backgroundImage)
  drawVisuals()
  checkError()
}

function checkError() {
  socket.on("errorDetected", (errorM) => {
    messageError = errorM
  })
  if (messageError) {
    noLoop()
    clear()
    let title = createDiv("Uh-oh... An error occurred during the run:")
    title.style("font-size", "22px")
    title.style("color", "red")
    title.position(10, 0)
    let div = createDiv(messageError)
    div.style("font-size", "16px")
    div.style("color", "red")
    div.position(10, 30)
  }
}

function loadBackground() {
  socket.on("background", (fondo) => {
    const imagen = images.find((img) => img.name == fondo)
    backgroundImage =
      fondo != "default" && imagen != null
        ? imagen.url
        : defaultBackground
  })
}

function loadAllImages() {
  socket.on("images", (img) => {
    for (i = 0 ; i < img.length ; i++) {
      images.push({ name: img[i].name, url: loadImage(`${img[i].url}`) })
    }
  })
}

function loadVisuals() {
  socket.on("visuals", (visualsList) => {
    visuals = visualsList
  })
}

function drawVisuals() {
  if (visuals) {
    for (i = 0 ; i < visuals.length ; i++) {
      var positionX = visuals[i].position.x * cellPixelSize
      var y = gameHeight - visuals[i].position.y * cellPixelSize
      var img = images.find((img) => img.name == visuals[i].image)
      var positionY = img ? y - img.url.height : y - wko.height
      if (img) image(img.url, positionX, positionY)
      else {
        image(wko, positionX, positionY)
        drawNotFound("Image\n not \nfound", positionX, positionY)
      }
      if (visuals[i].message) {
        drawMessage(visuals[i].message, positionX, positionY)
      }
    }
  }
}

function drawNotFound(message, positionX, positionY) {
  const limit = { x: sizeFactor, y: sizeFactor * 3 }
  textSize(14)
  textStyle("bold")
  fill("black")
  textAlign("center")
  noStroke()
  text(message, positionX - 1, positionY + 5, limit.x, limit.y)
}

function keyPressed() {
  socket.emit("keyPressed", { key: key, keyCode: keyCode })
}

function drawMessage(message, positionX, positionY) {
  const TEXT_STYLE = "bold"
  const TEXT_SIZE = 14
  var messagePosition = { x: positionX, y: positionY + 1 }
  drawMessageBackground(message, messagePosition)
  const position = messageTextPosition(messagePosition)
  const limit = { x: sizeFactor * 3, y: sizeFactor * 3 }
  textSize(TEXT_SIZE)
  textStyle(TEXT_STYLE)
  fill("black")
  textAlign("left")
  noStroke()
  text(message, position.x, position.y, limit.x, limit.y)
}

//___________________________________________________________

function drawMessageBackground(message, messagePosition) {
  var size = messageSize(message)
  const position = messageBackgroundPosition(messagePosition)
  fill("white")
  rect(position.x, position.y, size.x, size.y, 5, 15, 10, 0)
}

function messageSize(message) {
  const sizeLimit = { x: sizeFactor * 3, y: sizeFactor * 3 }
  const textWid = textWidth(message)
  const xSize = Math.min(textWid, sizeLimit.x) + 10
  const ySize =
    Math.min(
      ((sizeFactor - 15) * Math.ceil(textWid / sizeLimit.x)) / 2,
      sizeLimit.y
    ) + 10
  return { x: xSize, y: ySize }
}

function messageBackgroundPosition(message) {
  const xPosition = messageTextPosition(message).x - 5
  const yPosition = messageTextPosition(message).y - 5
  return { x: xPosition, y: yPosition }
}

function messageTextPosition(message) {
  return { x: messageXPosition(message), y: messageYPosition(message) }
}

function messageXPosition(message) {
  const xPos = message.x + sizeFactor
  const width = messageSize(message).x
  const inverseXPos = message.x - width

  return xPositionIsOutOfCanvas(xPos, width) ? inverseXPos : xPos
}

function xPositionIsOutOfCanvas(xPosition, width) {
  return xPosition + width > gameWidth
}

function yPositionIsOutOfCanvas(yPosition) {
  return yPosition < 0
}

function messageYPosition(message) {
  const messageSizeOffset = messageSize(message).y * 1.05
  const yPos = message.y - messageSizeOffset
  const inverseYPos = 1

  return yPositionIsOutOfCanvas(yPos) ? inverseYPos : yPos
}

//___________________________________________________________

function updateSound(soundInstances) {
  soundInstances = soundInstances ?? []

  for (const [id, sound] of sounds.entries()) {
    if (!soundInstances.some((sound) => sound[0] === id)) {
      sound.stopSound()
      sounds.delete(id)
    } else {
      sound.playSound()
    }
  }

  soundInstances.forEach((soundInstance) => {
    const soundState = {
      id: soundInstance[0],
      file: soundInstance[1], //soundInstance.file,
      status: soundInstance[2], //soundInstance.status,
      volume: soundInstance[3], //audioMuted ? 0 : soundInstance.volume,
      loop: soundInstance[4], //soundInstance.loop,
    }

    let sound = sounds.get(soundState.id)
    if (!sound) {
      const soundPath = soundState.file
      sound = new GameSound(soundState, soundPath)
      sounds.set(soundState.id, sound)
    }

    sound?.update(soundState)
  })
}

class GameSound {
  lastSoundState //: SoundState
  soundFile //: SoundFile
  started //: boolean
  toBePlayed //: boolean

  constructor(lastSoundState, soundPath) {
    this.lastSoundState = lastSoundState
    this.soundFile = loadSound(soundPath)
    this.started = false
    this.toBePlayed = false
  }

  isLoaded() {
    return this.soundFile.isLoaded()
  }

  canBePlayed(newSoundState) {
    return (
      (this.lastSoundState.status !== newSoundState.status || !this.started) &&
      this.isLoaded()
    )
  }

  update(newSoundState) {
    this.soundFile.setLoop(newSoundState.loop)
    this.soundFile.setVolume(newSoundState.volume)
    this.toBePlayed = this.canBePlayed(newSoundState)
    this.lastSoundState = newSoundState
  }

  playSound() {
    if (this.toBePlayed) {
      this.started = true

      switch (this.lastSoundState.status) {
        case "played":
          this.soundFile.play()
          break
        case "paused":
          this.soundFile.pause()
          break
        case "stopped":
          this.soundFile.stop()
      }
    }
  }

  stopSound() {
    this.soundFile.stop()
  }
}
