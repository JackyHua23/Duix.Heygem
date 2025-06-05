/**
 * Environment Variables Validation
 */

import fs from 'fs'
import path from 'path'
import logger from '../utils/logger.js'

/**
 * Validate required environment variables and configurations
 */
export function validateEnvironment() {
  const errors = []
  const warnings = []

  // Check Node.js version
  const nodeVersion = process.version
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0])
  if (majorVersion < 16) {
    errors.push(`Node.js version ${nodeVersion} is not supported. Please use Node.js 16 or higher.`)
  }

  // Check required directories exist or can be created
  const requiredDirs = [
    path.join(process.cwd(), 'data'),
    path.join(process.cwd(), 'uploads'),
    path.join(process.cwd(), 'temp'),
    path.join(process.cwd(), 'logs')
  ]

  for (const dir of requiredDirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
        logger.info(`Created directory: ${dir}`)
      }
    } catch (error) {
      errors.push(`Failed to create directory ${dir}: ${error.message}`)
    }
  }

  // Check environment variables
  const envVars = {
    optional: [
      'NODE_ENV',
      'PORT',
      'DB_PATH',
      'LOG_LEVEL',
      'PROCESSING_INTERVAL',
      'MAX_RETRIES',
      'QUEUE_POLLING_INTERVAL'
    ]
  }

  // Validate optional environment variables
  for (const varName of envVars.optional) {
    if (!process.env[varName]) {
      warnings.push(`Environment variable ${varName} is not set, using default value`)
    }
  }

  // Log results
  if (warnings.length > 0) {
    warnings.forEach(warning => logger.warn(warning))
  }

  if (errors.length > 0) {
    errors.forEach(error => logger.error(error))
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`)
  }

  logger.info('Environment validation completed successfully')
  return true
}

/**
 * Setup default environment variables if not set
 */
export function setupDefaults() {
  const defaults = {
    NODE_ENV: 'development',
    PORT: '3000',
    LOG_LEVEL: 'info',
    PROCESSING_INTERVAL: '2000',
    MAX_RETRIES: '3',
    QUEUE_POLLING_INTERVAL: '5000'
  }

  for (const [key, value] of Object.entries(defaults)) {
    if (!process.env[key]) {
      process.env[key] = value
      logger.debug(`Set default environment variable: ${key}=${value}`)
    }
  }
}
