
const parentGame = document.getElementById('game')
console.log('main.js')
function isSourceFile(file) { return file.name.endsWith('wlk') }
function isImagePNGFile(file) { return file.name.endsWith('png') }
function isImageJPGFile(file) { return file.name.endsWith('jpg') }
function isProgram(file) { return file.name.endsWith('wpgm') }

async function buildSource(file) {
    console.log(file)
    const name = file.name
    const content = await file.text()
    return { name, content }
}

function buildImage(file) {
    const possiblePaths = [file.name]
    const url = URL.createObjectURL(file)
    return { possiblePaths, url }
}

const input = document.getElementById('input-project')

input.onchange = async () => {
    const files = Array.from(input.files)
    const sourceFiles = files.filter(isSourceFile || isProgram)
    const programFile = files.filter(isProgram)[0]
    sourceFiles.push(programFile)

    const imageFilesPNG = files.filter(isImagePNGFile)
    const imageFilesJPG = files.filter(isImageJPGFile)
    const imageFiles = imageFilesPNG.concat(imageFilesJPG)
    console.log(imageFiles)
    const main = sourceFiles[0].name.split('.')[0]
    const programName = programFile.name.split('.')[0]
    const sounds = []
    const images = imageFiles.map(buildImage)
    const sources = await Promise.all(sourceFiles.map(buildSource))
    const project = { main, images, sounds, sources, programName }
    new Game(project).start(parentGame)
    document.getElementById('title-input').remove()
    input.remove()
}