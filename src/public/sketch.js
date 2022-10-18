var backgroundImage
var images = []
var visuals = []
var mensajeError
var wko
var messages = []
const TEXT_STYLE = 'bold'
const TEXT_SIZE = 14

function preload(){
  loadAllImages()
  wko = loadImage('./wko.png')
}
function setup() {
  createCanvas(windowWidth, windowHeight);
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
function checkError(){
  socket.on('errorDetected', errorM => {
    mensajeError = errorM
  })
  if (mensajeError){ 
    noLoop();
    clear();
    let title = createDiv('Uh-oh... An error occurred during the run:');
    title.style('font-size', '22px');
    title.style('color', 'red');
    title.position(10, 0);
    let div = createDiv(mensajeError);
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
  var heightWin = windowHeight-100
  for(i=0; i < visuals.length; i++){
    var positionX = (visuals[i].x)*50
    var positionY = visuals[i].y == 0 ? heightWin : ((heightWin) - visuals[i].y*50)
    var img = images.find(img => img.name == visuals[i].image)
    img ? image(img.url, positionX,positionY) : image(wko, positionX,positionY)
  }
}

function keyPressed(){
  socket.emit('keyPressed', {'key' : key, 'keyCode': keyCode});
}

function drawMessages(){
  var heightWin = windowHeight-100
  if (messages){
    for (i=0; i < messages.length; i++){
      var positionY = messages[i].y == 0 ? heightWin : ((heightWin) - messages[i].y*50)-5;
      drawMessageBackground(messages[i].x*50, positionY-15, (messages[i].message).length*8 )
      textSize(TEXT_SIZE)
      textStyle(TEXT_STYLE)
      fill('black')
      textAlign('left')
      noStroke()
      text(messages[i].message, messages[i].x*50, positionY)
    }
  }
}
function drawMessageBackground(positionX, positionY, sizeX) {
  fill('white')
  rect(positionX, positionY, sizeX, 20, 5, 5, 5, 5)
}