import winston, { format } from 'winston'

export const logger = winston.createLogger({
  transports: [
    new winston.transports.File(
      {
        filename: 'log/wollok.log',
        maxsize: 1000000,
        format: format.combine(
          format.timestamp(),
          format.json(),
        ),
      },
    ),
  ],
})