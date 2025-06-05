/**
 * Background Processing Module
 * Handles periodic task processing and queue management
 */

import logger from '../utils/logger.js'
import { startBackgroundProcessing, stopBackgroundProcessing } from '../services/task.js'

let backgroundInterval = null

/**
 * Initialize background processing
 * @param {number} [intervalMs=2000] - Processing interval in milliseconds
 */
export function initBackgroundProcessing(intervalMs = 2000) {
  if (backgroundInterval) {
    logger.warn('Background processing is already running')
    return
  }

  logger.info('Initializing background processing...')
  
  backgroundInterval = startBackgroundProcessing(intervalMs)
  
  // Handle graceful shutdown
  process.on('SIGINT', handleShutdown)
  process.on('SIGTERM', handleShutdown)
  
  logger.info('Background processing initialized successfully')
}

/**
 * Stop background processing
 */
export function stopBackground() {
  if (backgroundInterval) {
    stopBackgroundProcessing(backgroundInterval)
    backgroundInterval = null
    logger.info('Background processing stopped')
  }
}

/**
 * Handle graceful shutdown
 */
function handleShutdown() {
  logger.info('Received shutdown signal, stopping background processing...')
  stopBackground()
  process.exit(0)
}

/**
 * Get background processing status
 * @returns {Object} - Status information
 */
export function getBackgroundStatus() {
  return {
    running: backgroundInterval !== null,
    intervalId: backgroundInterval
  }
}
