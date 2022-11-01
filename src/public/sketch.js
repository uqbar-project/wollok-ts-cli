var backgroundImage
var widthGame
var images = []
var visuals = []
var messageError
var wko
var messages = []
const sizeFactor = 50
var cellPixelSize

function preload(){
  loadAllImages()
  wko = loadImage('./wko.png')
  socket.on('sizeCanvasInic', size => {
    widthGame = size[0]
  })
  socket.on('cellPixelSize', size =>{ cellPixelSize = size });
}
function setup() {
  createCanvas(windowWidth ,windowHeight);
}
function draw() {
  clear();
  loadBackground();
  loadVisuals();
  loadMessages();
  background(backgroundImage ? backgroundImage : 'grey');
  drawVisuals();
  drawMessages();
  checkError();
 
}

function windowResized() {
  resizeCanvas(windowWidth-20, windowHeight-20);
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
  const TEXT_STYLE = 'bold'
  const TEXT_SIZE = 14
  if (messages){
    for (i=0; i < messages.length; i++){
      var positionX= ((messages[i].x) * cellPixelSize) * (windowWidth/widthGame)+5;
      var positionY = (windowHeight-100) - (messages[i].y +1) * cellPixelSize;
      var messagePosition = {x : positionX, y : positionY}
      drawMessageBackground(messages[i].message, messagePosition)
      const position = messageTextPosition(messagePosition)
      const limit = { x: sizeFactor * 3, y: sizeFactor * 3 }
      textSize(TEXT_SIZE)
      textStyle(TEXT_STYLE)
      fill('black')
      textAlign('left')
      noStroke()
      text(messages[i].message, position.x, position.y, limit.x, limit.y)
    }
  }
}
function drawMessageBackground(message, messagePosition) {
  var size = messageSize(message)
  const position = messageBackgroundPosition(messagePosition)
  console.log(position)
  fill('white')
  rect(position.x, position.y, size.x, size.y, 5, 15, 10, 0)
}

function messageSize(message) {
  const sizeLimit = { x: sizeFactor * 3, y: sizeFactor * 3 }
  const textWid = textWidth(message)
  const xSize = Math.min(textWid, sizeLimit.x) + 10
  const ySize = Math.min((sizeFactor - 15) * Math.ceil(textWid / sizeLimit.x) / 2, sizeLimit.y) + 10
  return { x: xSize, y: ySize }
}

function messageBackgroundPosition(message) {
  const xPosition = messageTextPosition(message).x - 5
  const yPosition = messageTextPosition(message).y - 5
  return { x: xPosition, y: yPosition }
}
function messageTextPosition(message){
  return { x: messageXPosition(message), y: messageYPosition(message) }
}
function messageXPosition(message) {
  const xPos = message.x + sizeFactor
  const width = messageSize(message).x
  const inverseXPos = message.x - width

  return xPositionIsOutOfCanvas(xPos, width) ? inverseXPos : xPos
}
function xPositionIsOutOfCanvas(xPosition, width) {
  return xPosition + width > windowWidth
}
function yPositionIsOutOfCanvas(yPosition) {
  return yPosition < 0
}
function messageYPosition(message) {
  const messageSizeOffset = messageSize(message).y * 1.05
  const yPos = message.y - messageSizeOffset
  const inverseYPos = message.y + sizeFactor

  return yPositionIsOutOfCanvas(yPos) ? inverseYPos : yPos
}