import express from 'express'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import * as taskService from '../services/task.js'

const router = express.Router()

/**
 * @swagger
 * /api/v1/tasks:
 *   get:
 *     summary: Get task status overview
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/', asyncHandler(async (req, res) => {
  const stats = taskService.getTaskStats()

  res.json({
    success: true,
    data: stats
  })
}))

/**
 * @swagger
 * /api/v1/tasks/pending:
 *   get:
 *     summary: Get pending tasks
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/pending', asyncHandler(async (req, res) => {
  const tasks = taskService.getPendingTasks()

  res.json({
    success: true,
    data: tasks
  })
}))

/**
 * @swagger
 * /api/v1/tasks/processing:
 *   get:
 *     summary: Get processing tasks
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/processing', asyncHandler(async (req, res) => {
  const tasks = taskService.getProcessingTasks()

  res.json({
    success: true,
    data: tasks
  })
}))

/**
 * @swagger
 * /api/v1/tasks/queue:
 *   get:
 *     summary: Get queue status with detailed information
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/queue', asyncHandler(async (req, res) => {
  const queueStatus = taskService.getQueueStatus()

  res.json({
    success: true,
    data: queueStatus
  })
}))

/**
 * @swagger
 * /api/v1/tasks/{id}:
 *   get:
 *     summary: Get detailed task information
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Task not found
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const task = taskService.getTaskDetails(id)

  if (!task) {
    throw new AppError('Task not found', 404)
  }

  res.json({
    success: true,
    data: task
  })
}))

/**
 * @swagger
 * /api/v1/tasks/{id}/retry:
 *   post:
 *     summary: Retry failed task
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Task queued for retry
 *       400:
 *         description: Task cannot be retried
 */
router.post('/:id/retry', asyncHandler(async (req, res) => {
  const { id } = req.params
  
  taskService.retryFailedTask(id)

  res.json({
    success: true,
    message: 'Task queued for retry'
  })
}))

/**
 * @swagger
 * /api/v1/tasks/{id}/cancel:
 *   post:
 *     summary: Cancel waiting or processing task
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Task cancelled
 *       400:
 *         description: Task cannot be cancelled
 */
router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const { id } = req.params
  
  taskService.cancelTask(id)

  res.json({
    success: true,
    message: 'Task cancelled'
  })
}))

export default router
