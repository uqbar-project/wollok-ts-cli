var backgroundImage
var images = []
var visuals = []
var mensajeError
var wko
function preload(){
  loadAllImages()
  wko = loadImage('./wko.png')
}
function setup() {
  createCanvas(windowWidth, windowHeight);
}
function draw() {
  loadBackground();
  background(backgroundImage ? backgroundImage : 'grey');
  loadPositionsVisuals();
  drawVisuals();
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

function loadPositionsVisuals(){
  socket.on('visuals', v =>{
    visuals = v
  });
}

function drawVisuals(){
  var heightWin = windowHeight-100
  for(i=0; i < visuals.length; i++){
    var positionX = (visuals[i].x)*50
    var positionY = visuals[i].y == 0 ? heightWin : ((heightWin) - visuals[i].y*50)
    var img = images.find(img => img.name == visuals[i].image)
    if (img){
      image(img.url, positionX,positionY)
    } else {
      image(wko, positionX,positionY)
    }
  }
}
