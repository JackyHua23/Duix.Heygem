/**
 * Task Service
 * Handles background task management and queue processing
 */

import logger from '../utils/logger.js'
import * as videoDao from '../dao/video.js'
import { processPendingVideos, processNextWaitingVideo } from './video.js'

/**
 * Get task statistics
 * @returns {Object} - Task statistics by status
 */
export function getTaskStats() {
  const stats = {
    pending: videoDao.selectByStatus('pending').length,
    processing: videoDao.selectByStatus('processing').length,
    waiting: videoDao.selectByStatus('waiting').length,
    completed: videoDao.selectByStatus('completed').length,
    failed: videoDao.selectByStatus('failed').length,
    draft: videoDao.selectByStatus('draft').length
  }

  stats.total = Object.values(stats).reduce((sum, count) => sum + count, 0)

  return stats
}

/**
 * Get tasks by status
 * @param {string} status - Task status
 * @returns {Array} - List of tasks
 */
export function getTasksByStatus(status) {
  return videoDao.selectByStatus(status)
}

/**
 * Get pending tasks
 * @returns {Array} - List of pending tasks
 */
export function getPendingTasks() {
  return videoDao.selectByStatus('pending')
}

/**
 * Get processing tasks
 * @returns {Array} - List of processing tasks
 */
export function getProcessingTasks() {
  return videoDao.selectByStatus('processing')
}

/**
 * Get waiting tasks with queue positions
 * @returns {Array} - List of waiting tasks with queue info
 */
export function getWaitingTasks() {
  const waitingTasks = videoDao.selectByStatus('waiting')
  
  return waitingTasks.map((task, index) => ({
    ...task,
    queuePosition: index + 1,
    totalInQueue: waitingTasks.length
  }))
}

/**
 * Process task queue (main background processing function)
 * This function should be called periodically to process pending tasks
 * @returns {Promise<Object>} - Processing result
 */
export async function processTaskQueue() {
  try {
    logger.debug('Processing task queue...')

    const stats = getTaskStats()
    logger.debug('Current task stats:', stats)

    // Process pending videos (check status updates)
    const processedVideo = await processPendingVideos()
    
    // If no pending videos, try to start next waiting video
    if (!processedVideo) {
      processNextWaitingVideo()
    }

    return {
      success: true,
      processedVideo: processedVideo?.id || null,
      stats: getTaskStats()
    }
  } catch (error) {
    logger.error('Error processing task queue:', error)
    return {
      success: false,
      error: error.message,
      stats: getTaskStats()
    }
  }
}

/**
 * Start background task processing
 * Sets up interval for processing task queue
 * @param {number} [intervalMs=2000] - Processing interval in milliseconds
 * @returns {NodeJS.Timeout} - Interval ID for stopping
 */
export function startBackgroundProcessing(intervalMs = 2000) {
  logger.info(`Starting background task processing with ${intervalMs}ms interval`)
  
  const intervalId = setInterval(async () => {
    try {
      await processTaskQueue()
    } catch (error) {
      logger.error('Background processing error:', error)
    }
  }, intervalMs)

  // Process immediately on start
  setImmediate(() => processTaskQueue())

  return intervalId
}

/**
 * Stop background task processing
 * @param {NodeJS.Timeout} intervalId - Interval ID to stop
 */
export function stopBackgroundProcessing(intervalId) {
  if (intervalId) {
    clearInterval(intervalId)
    logger.info('Background task processing stopped')
  }
}

/**
 * Get task queue status
 * @returns {Object} - Queue status information
 */
export function getQueueStatus() {
  const pending = getPendingTasks()
  const waiting = getWaitingTasks()
  const processing = getProcessingTasks()
  
  return {
    queue: {
      pending: pending.length,
      waiting: waiting.length,
      processing: processing.length
    },
    details: {
      pendingTasks: pending.map(task => ({
        id: task.id,
        name: task.name,
        progress: task.progress,
        message: task.message
      })),
      waitingTasks: waiting.map(task => ({
        id: task.id,
        name: task.name,
        queuePosition: task.queuePosition,
        totalInQueue: task.totalInQueue
      })),
      processingTasks: processing.map(task => ({
        id: task.id,
        name: task.name,
        message: task.message
      }))
    }
  }
}

/**
 * Retry failed task
 * @param {number} taskId - Task (video) ID to retry
 * @returns {boolean} - Success status
 */
export function retryFailedTask(taskId) {
  try {
    const video = videoDao.selectByID(taskId)
    if (!video) {
      throw new Error(`Task not found: ${taskId}`)
    }

    if (video.status !== 'failed') {
      throw new Error(`Task is not in failed status: ${taskId}`)
    }

    // Reset task to waiting status
    videoDao.update({
      id: taskId,
      status: 'waiting',
      message: 'Retrying task...',
      progress: 0
    })

    logger.info(`Task ${taskId} queued for retry`)
    return true
  } catch (error) {
    logger.error(`Error retrying task ${taskId}:`, error)
    throw error
  }
}

/**
 * Cancel waiting or processing task
 * @param {number} taskId - Task (video) ID to cancel
 * @returns {boolean} - Success status
 */
export function cancelTask(taskId) {
  try {
    const video = videoDao.selectByID(taskId)
    if (!video) {
      throw new Error(`Task not found: ${taskId}`)
    }

    if (!['waiting', 'processing', 'pending'].includes(video.status)) {
      throw new Error(`Cannot cancel task in status: ${video.status}`)
    }

    // Set task to failed status with cancellation message
    videoDao.update({
      id: taskId,
      status: 'failed',
      message: 'Task cancelled by user',
      progress: 0
    })

    logger.info(`Task ${taskId} cancelled`)
    return true
  } catch (error) {
    logger.error(`Error cancelling task ${taskId}:`, error)
    throw error
  }
}

/**
 * Get detailed task information
 * @param {number} taskId - Task (video) ID
 * @returns {Object|null} - Detailed task information
 */
export function getTaskDetails(taskId) {
  const video = videoDao.selectByID(taskId)
  if (!video) {
    return null
  }

  const result = {
    id: video.id,
    name: video.name,
    status: video.status,
    progress: video.progress,
    message: video.message,
    created_at: video.created_at,
    model_id: video.model_id,
    voice_id: video.voice_id,
    text_content: video.text_content,
    audio_path: video.audio_path,
    file_path: video.file_path,
    duration: video.duration
  }

  // Add queue position for waiting tasks
  if (video.status === 'waiting') {
    const waitingTasks = getWaitingTasks()
    const queueInfo = waitingTasks.find(t => t.id === taskId)
    if (queueInfo) {
      result.queuePosition = queueInfo.queuePosition
      result.totalInQueue = queueInfo.totalInQueue
    }
  }

  return result
}
