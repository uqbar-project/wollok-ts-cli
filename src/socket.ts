/*import { io } from 'socket.io-client'

const socket = io('http://localhost:3000')

socket.on('connect', function () { console.log("conectado!") })
socket.on('event', function (data) { console.log(`evento! ${data}`) })
socket.on('disconnect', function () { console.log("desconectado!") })

const button = document.getElementById('sendPong')
const label = document.getElementById('pings')

button.addEventListener('click', e => {
console.log("Sending Pong!")
e.preventDefault()
socket.emit('pong', Number(label.innerText))
})

socket.on('ping', payload => {
console.log(`Received ping from server with value: ${payload}`)
label.innerText = `${payload}`
})
*/