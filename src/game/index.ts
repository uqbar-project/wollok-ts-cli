import Game from "../game/game"

console.log('index.ts')
declare global {
    interface Window { Game: typeof Game; }
}

window.Game = Game