var backgroundImage
var images = []
var visuals = []
function preload(){
  loadAllImages()
  loadBackground()
}
function setup() {
  createCanvas(windowWidth, windowHeight);
}
function draw() {
  background(backgroundImage ? backgroundImage : 'grey')
  loadPositionsVisuals()
  drawVisuals()

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
    image(img.url, positionX,positionY)
  }
}
