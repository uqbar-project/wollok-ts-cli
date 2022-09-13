import p5 from "p5"
import { Id } from "wollok-ts"
import { Interpreter } from "wollok-ts/dist/interpreter/interpreter"
import { DEFAULT_GAME_ASSETS_DIR, GameProject } from "./gameProject"
// import { GameSound } from "./gameSound"
import { buildKeyPressEvent, canvasResolution, defaultImgs, queueEvent, resizeCanvas, step, wKeyCode } from "./render"

export default (project: GameProject, interpreter: Interpreter, canvasParent?: Element) => (p: p5) => {
    const images = new Map<string, p5.Image>()
    // const sounds = new Map<Id, GameSound>()
    let stop = false
    let gamePaused = false
    let audioMuted = false

    p.setup = () => {
        const { width, height } = canvasResolution(interpreter)
        const renderer = p.createCanvas(width, height)
        if (canvasParent) renderer.parent(canvasParent)

        defaultImgs.forEach(path => images.set(path, p.loadImage(DEFAULT_GAME_ASSETS_DIR + path)))
        console.log(project.images)
        project.images.forEach(({ possiblePaths, url }) =>
            possiblePaths.forEach(path =>
                images.set(path, p.loadImage(url))
            )
        )
        resizeCanvas(width, height, renderer, canvasParent)
    }

    p.draw = () => {
        if (!interpreter.object('wollok.game.game').get('running')!.innerBoolean!) { stop = true }
        // else step({ sketch: p, gameProject: project, interpreter, sounds, images, audioMuted, gamePaused })
        else step({ sketch: p, gameProject: project, interpreter, images, audioMuted, gamePaused })
    }


    p.keyPressed = () => {
        if (!gamePaused) {
            window.performance.mark('key-start')
            queueEvent(interpreter, buildKeyPressEvent(interpreter, wKeyCode(p.key, p.keyCode)), buildKeyPressEvent(interpreter, 'ANY'))
            window.performance.mark('key-end')
            window.performance.measure('key-start-to-end', 'key-start', 'key-end')
        }

        return false
    }
}