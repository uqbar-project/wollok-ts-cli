import { RuntimeObject } from "wollok-ts"
import { Interpreter } from "wollok-ts/dist/interpreter/interpreter"

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
