var backgroundImage
var widthGame
var heightGame
var images = []
var visuals = []
var messageError
var wko
var messages = []
const TEXT_STYLE = 'bold'
const TEXT_SIZE = 14
var cellPixelSize
var sounds = new Map()

function preload(){
  loadAllImages()
  wko = loadImage('./wko.png')
  socket.on('sizeCanvasInic', size => {
    widthGame = size[0]
    heightGame = size[1]
  })
}

function setup() {
  createCanvas(windowWidth ,windowHeight);
  socket.on('updateSound', data => {
    updateSound( data.path, data.soundInstances )
  })
}

function draw() {
  clear();
  socket.on('cellPixelSize', size =>{ cellPixelSize = size });
  loadBackground();
  loadVisuals();
  loadMessages();
  background(backgroundImage ? backgroundImage : 'grey');
  drawVisuals();
  drawMessages();
  checkError();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function checkError(){
  socket.on('errorDetected', errorM => {
    messageError = errorM
  })
  if (messageError){ 
    noLoop();
    clear();
    let title = createDiv('Uh-oh... An error occurred during the run:');
    title.style('font-size', '22px');
    title.style('color', 'red');
    title.position(10, 0);
    let div = createDiv(messageError);
    div.style('font-size', '16px');
    div.style('color', 'red');
    div.position(10, 30);
  }
}
function loadBackground(){
  socket.on('background', fondo =>{
    backgroundImage = images.find(img => img.name == fondo).url
  });
}

function loadAllImages(){
  socket.on('images', img =>{
    for(i = 0; i < img.length ; i++){
      images.push({'name': img[i].name, 'url': loadImage(img[i].url)})
    }
  });
}

function loadVisuals(){
  socket.on('visuals', visualsList =>{
    visuals = visualsList
  });
}
function loadMessages(){
  socket.on('messages', messagesList =>{
    messages = messagesList
  });
}

function drawVisuals(){
  if (visuals){
    for(i=0; i < visuals.length; i++){
      var positionX = (visuals[i].x * cellPixelSize) * (windowWidth/widthGame)
      var positionY = (windowHeight-100) - (visuals[i].y+1) * cellPixelSize
      var img = images.find(img => img.name == visuals[i].image)
      img ? image(img.url, positionX, positionY) : image(wko, positionX,positionY)
    }
  }
}

function keyPressed(){
  socket.emit('keyPressed', {'key' : key, 'keyCode': keyCode});
}

function drawMessages(){
  if (messages){
    for (i=0; i < messages.length; i++){
      var positionX= ((messages[i].x) * cellPixelSize) * (windowWidth/widthGame)+5;
      var positionY = (windowHeight-100) - (messages[i].y +1) * cellPixelSize;
      var positionYText = positionY < 0 ? 15 : positionY; 
      drawMessageBackground(positionX, positionY, (messages[i].message).length * 7,5 )
      textSize(TEXT_SIZE)
      textStyle(TEXT_STYLE)
      fill('black')
      textAlign('left')
      noStroke()
      text(messages[i].message, positionX, positionYText)
    }
  }
}
function drawMessageBackground(positionX, positionY, sizeX) {
  var positionYRect = positionY < 0 ? 0 : positionY-15; 
  fill('white')
  rect(positionX, positionYRect, sizeX, 20, 2, 2, 2, 2)
}

//___________________________________________________________

function updateSound(gameProject, soundInstances) {
  soundInstances = soundInstances ? soundInstances : []

  for (const [id, sound] of sounds.entries()) {
    if (!soundInstances.some(sound => sound[0] === id)) {
      sound.stopSound()
      sounds.delete(id)
    } else {
      sound.playSound()
    }
  }

  soundInstances.forEach(soundInstance => {
    const soundState = {
      id: soundInstance[0],
      file: soundInstance[1],//soundInstance.file,
      status: soundInstance[2],//soundInstance.status,
      volume: soundInstance[3],//audioMuted ? 0 : soundInstance.volume,
      loop: soundInstance[4],//soundInstance.loop,
    }

    let sound = sounds.get(soundState.id)
    if (!sound) {
      const soundPath = gameProject + soundState.file
      sound = new GameSound(soundState, soundPath)
      sounds.set(soundState.id, sound)
    }

    sound?.update(soundState)
  })
}

class GameSound {
  lastSoundState//: SoundState
  soundFile//: SoundFile
  started//: boolean
  toBePlayed//: boolean

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
    return (this.lastSoundState.status !== newSoundState.status || !this.started) && this.isLoaded()
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
        case 'played':
          this.soundFile.play()
          break
        case 'paused':
          this.soundFile.pause()
          break
        case 'stopped':
          this.soundFile.stop()
      }
    }
  }

  stopSound() {
    this.soundFile.stop()
  }
}
