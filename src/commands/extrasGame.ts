import { RuntimeObject } from "wollok-ts"
import { Interpreter } from "wollok-ts/dist/interpreter/interpreter"

const { round, min } = Math

export interface CanvasResolution {
  width: number;
  height: number;
}
export function canvasResolution(interpreter: Interpreter): CanvasResolution {
  const game = interpreter.object('wollok.game.game')
  const cellPixelSize = game.get('cellSize')!.innerNumber!
  const width = round(game.get('width')!.innerNumber!) * cellPixelSize
  const height = round(game.get('height')!.innerNumber!) * cellPixelSize
  return { width, height }
}
export interface VisualState {
  image?: string;
  position: Position;
  message?: string;
}
export interface Position {
  x: number;
  y: number;
}
export interface Image {
  name: string;
  url: string;
}
function invokeMethod(interpreter: Interpreter, visual: RuntimeObject, method: string) {
  const lookedUpMethod = visual.module.lookupMethod(method, 0)
  return lookedUpMethod && interpreter.invoke(lookedUpMethod, visual)!.innerString
}
export function visualState(interpreter: Interpreter, visual: RuntimeObject): VisualState {
  const image = invokeMethod(interpreter, visual, 'image')
  const position = interpreter.send('position', visual)!
  const roundedPosition = interpreter.send('round', position)!
  const x = roundedPosition.get('x')!.innerNumber!
  const y = roundedPosition.get('y')!.innerNumber!
  const message = visual.get('message')?.innerString
  return { image, position: { x, y }, message }
}
export function queueEvent(interpreter: Interpreter, ...events: RuntimeObject[]): void {
    const io = interpreter.object('wollok.lang.io')
    events.forEach(e => interpreter.send('queueEvent', io, e))
}

export function buildKeyPressEvent(interpreter: Interpreter, keyCode: string): RuntimeObject {
    return interpreter.list(
      interpreter.reify('keypress'),
      interpreter.reify(keyCode)
    )
}

export function wKeyCode(keyName: string, keyCode: number): string { //These keyCodes correspond to http://keycode.info/
    if (keyCode >= 48 && keyCode <= 57) return `Digit${keyName}` //Numbers (non numpad)
    if (keyCode >= 65 && keyCode <= 90) return `Key${keyName.toUpperCase()}` //Letters
    if (keyCode === 18) return 'AltLeft'
    if (keyCode === 225) return 'AltRight'
    if (keyCode === 8) return 'Backspace'
    if (keyCode === 17) return 'Control'
    if (keyCode === 46) return 'Delete'
    if (keyCode >= 37 && keyCode <= 40) return keyName //Arrows
    if (keyCode === 13) return 'Enter'
    if (keyCode === 189) return 'Minus'
    if (keyCode === 187) return 'Plus'
    if (keyCode === 191) return 'Slash'
    if (keyCode === 32) return 'Space'
    if (keyCode === 16) return 'Shift'
    return '' //If an unknown key is pressed, a string should be returned
  }
