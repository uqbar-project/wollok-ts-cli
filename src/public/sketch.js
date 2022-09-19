var backgroundImage
var visualsImages = []
var positionsImages
function preload(){
  loadBackground()
  loadVisuals()
  loadPositionsVisuals()
}
function setup() {
  createCanvas(windowWidth, windowHeight);
}
function draw() {
  background(backgroundImage ? backgroundImage : 'grey')
  drawVisuals()
}

function loadBackground(){
  socket.on('getPathBackround', fondo =>{
    backgroundImage = loadImage(fondo);
  });
}

function loadVisuals(){
  socket.on('VisualsImage', images =>{
    for(i = 0; i < images.length ; i++){
      visualsImages.push(loadImage(images[i]))
    }
  });
}

function loadPositionsVisuals(){
  socket.on('VisualsPositions', positions =>{
    positionsImages = positions;
  });
}

function drawVisuals(){
  var heightWin = windowHeight-100
  for(i=0; i < visualsImages.length; i++){
    var positionX = (positionsImages[i].x)*50
    var positionY = positionsImages[i].y == 0 ? heightWin : ((heightWin) - positionsImages[i].y*50)
    image(visualsImages[i], positionX, positionY)
  }
}
