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