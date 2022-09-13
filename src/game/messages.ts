
export interface DrawableMessage {
  message: string;
  x: number;
  y: number;
}

export interface MessageDrawer {
  width: number;
  textWidth(message: string): number;
  rect(xPos: number, yPos: number, xSize: number, ySize: number, tl?: number, tr?: number, br?: number, bl?: number): void;
  text(message: string, xPos: number, yPos: number, xLimit: number, yLimit: number): void;
  fill(color: string): void;
  textAlign(alignment: string): void;
  textSize(size: number): void;
  textStyle(style: string): void;
  stroke(color: string): void;
  noStroke(): void;
}

export const TEXT_STYLE = 'bold'
export const TEXT_SIZE = 14

const sizeFactor = 50

function messageSizeLimit() {
  return { x: sizeFactor * 3, y: sizeFactor * 3 }
}

function xPositionIsOutOfCanvas(drawer: MessageDrawer, xPosition: number, width: number) {
  return xPosition + width > drawer.width
}

function messageXPosition(drawer: MessageDrawer, message: DrawableMessage) {
  const xPos = message.x + sizeFactor
  const width = messageSize(drawer, message).x
  const inverseXPos = message.x - width

  return xPositionIsOutOfCanvas(drawer, xPos, width) ? inverseXPos : xPos
}

function yPositionIsOutOfCanvas(yPosition: number) {
  return yPosition < 0
}

function messageYPosition(drawer: MessageDrawer, message: DrawableMessage) {
  const messageSizeOffset = messageSize(drawer, message).y * 1.05
  const yPos = message.y - messageSizeOffset
  const inverseYPos = message.y + sizeFactor

  return yPositionIsOutOfCanvas(yPos) ? inverseYPos : yPos
}

export function messageTextPosition(drawer: MessageDrawer, message: DrawableMessage): { x: number; y: number } {
  return { x: messageXPosition(drawer, message), y: messageYPosition(drawer, message) }
}

function messageSize(drawer: MessageDrawer, message: DrawableMessage) {
  const sizeLimit = messageSizeLimit()
  const textWidth = drawer.textWidth(message.message)
  const xSize = Math.min(textWidth, sizeLimit.x) + 10
  const ySize = Math.min((sizeFactor - 15) * Math.ceil(textWidth / sizeLimit.x) / 2, sizeLimit.y) + 10
  return { x: xSize, y: ySize }
}

function messageBackgroundPosition(drawer: MessageDrawer, message: DrawableMessage) {
  const xPosition = messageTextPosition(drawer, message).x - 5
  const yPosition = messageTextPosition(drawer, message).y - 5
  return { x: xPosition, y: yPosition }
}

function drawMessageBackground(drawer: MessageDrawer, message: DrawableMessage) {
  const size = messageSize(drawer, message)
  const position = messageBackgroundPosition(drawer, message)
  drawer.fill('white')
  drawer.rect(position.x, position.y, size.x, size.y, 0, 15, 10, 5)
}

export const drawMessage = (drawer: MessageDrawer) => (message: DrawableMessage): void => {
  drawMessageBackground(drawer, message)
  const position = messageTextPosition(drawer, message)
  const limit = messageSizeLimit()
  drawer.textSize(TEXT_SIZE)
  drawer.textStyle(TEXT_STYLE)
  drawer.fill('black')
  drawer.textAlign('left')
  drawer.noStroke()
  drawer.text(message.message, position.x, position.y, limit.x, limit.y)
}