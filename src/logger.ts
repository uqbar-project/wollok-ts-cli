import winston, { format } from 'winston'

export const logger = winston.createLogger({
  transports: [
    new winston.transports.File(
      {
        filename: 'wollok.log',
        format: format.combine(
          format.timestamp(),
          format.json(),
        ),
      },
    ),
  ],
})