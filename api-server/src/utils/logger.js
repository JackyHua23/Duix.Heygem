import winston from 'winston'
import path from 'path'
import fs from 'fs'

let logger = null

export function initLogger() {
  // Create logs directory if it doesn't exist
  const logsDir = path.join(process.cwd(), 'logs')
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
  }

  // Define log format
  const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  )

  // Console format for development
  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`
    })
  )

  // Create logger
  logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'heygem-api' },
    transports: [
      // Write all logs to combined.log
      new winston.transports.File({ 
        filename: path.join(logsDir, 'combined.log'),
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      // Write errors to error.log
      new winston.transports.File({ 
        filename: path.join(logsDir, 'error.log'), 
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      })
    ]
  })

  // Add console transport in development
  if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
      format: consoleFormat
    }))
  }

  return logger
}

export { logger }

// Create a proxy object that will delegate to the actual logger
const loggerProxy = {
  info: (...args) => logger ? logger.info(...args) : console.log(...args),
  error: (...args) => logger ? logger.error(...args) : console.error(...args),
  warn: (...args) => logger ? logger.warn(...args) : console.warn(...args),
  debug: (...args) => logger ? logger.debug(...args) : console.log(...args)
}

// Export logger proxy
export default loggerProxy
