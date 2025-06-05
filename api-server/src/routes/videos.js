import express from 'express'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import logger from '../utils/logger.js'
import { config } from '../config/index.js'
import * as videoService from '../services/video.js'
import { audition } from '../services/voice.js'
import fs from 'fs'
import path from 'path'

const router = express.Router()

/**
 * @swagger
 * /api/v1/videos:
 *   get:
 *     summary: Get paginated videos
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 10, name = '' } = req.query
  
  const result = videoService.getVideoPage({
    page: parseInt(page),
    pageSize: parseInt(pageSize),
    name
  })

  res.json({
    success: true,
    data: {
      ...result,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }
  })
}))

/**
 * @swagger
 * /api/v1/videos/{id}:
 *   get:
 *     summary: Get video by ID
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
 *         description: Video not found
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const video = videoService.getVideoById(id)
  
  if (!video) {
    throw new AppError('Video not found', 404)
  }

  res.json({
    success: true,
    data: video
  })
}))

/**
 * @swagger
 * /api/v1/videos:
 *   post:
 *     summary: Create new video
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               model_id:
 *                 type: integer
 *               text_content:
 *                 type: string
 *               voice_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Video created successfully
 */
router.post('/', asyncHandler(async (req, res) => {
  const { name, model_id, text_content, voice_id } = req.body
  
  if (!name || !model_id || !text_content) {
    throw new AppError('Name, model_id and text_content are required', 400)
  }

  // Validate model exists
  const model = modelDao.selectByID(model_id)
  if (!model) {
    throw new AppError('Model not found', 404)
  }

  // Validate voice exists if provided
  if (voice_id) {
    const voice = voiceDao.selectByID(voice_id)
    if (!voice) {
      throw new AppError('Voice not found', 404)
    }
  }

  const videoId = videoDao.insert({
    name,
    model_id,
    text_content,
    voice_id,
    status: 'draft',
    progress: 0
  })

  logger.info(`Video created: ${name} (ID: ${videoId})`)

  res.status(201).json({
    success: true,
    data: {
      id: videoId,
      name,
      model_id,
      text_content,
      voice_id,
      status: 'draft'
    }
  })
}))

/**
 * @swagger
 * /api/v1/videos/{id}/generate:
 *   post:
 *     summary: Start video generation
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Video generation started
 *       404:
 *         description: Video not found
 */
router.post('/:id/generate', asyncHandler(async (req, res) => {
  const { id } = req.params
  const video = videoDao.selectByID(id)
  
  if (!video) {
    throw new AppError('Video not found', 404)
  }

  if (video.status === 'processing' || video.status === 'pending') {
    throw new AppError('Video is already being processed', 400)
  }

  // Update status to waiting
  videoDao.update({
    id,
    status: 'waiting',
    progress: 0
  })

  logger.info(`Video generation started: ${video.name} (ID: ${id})`)

  res.json({
    success: true,
    message: 'Video generation started',
    data: {
      id,
      status: 'waiting'
    }
  })

  // Start async processing (will be handled by background service)
  setImmediate(() => videoService.synthesizeVideo(id))
}))

/**
 * @swagger
 * /api/v1/videos/{id}/status:
 *   get:
 *     summary: Get video generation status
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params
  const video = videoDao.selectByID(id)
  
  if (!video) {
    throw new AppError('Video not found', 404)
  }

  res.json({
    success: true,
    data: {
      id,
      status: video.status,
      progress: video.progress || 0,
      message: video.message,
      file_path: video.file_path
    }
  })
}))

/**
 * @swagger
 * /api/v1/videos/{id}/download:
 *   get:
 *     summary: Download generated video
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Video file
 *       404:
 *         description: Video not found or not ready
 */
router.get('/:id/download', asyncHandler(async (req, res) => {
  const { id } = req.params
  const video = videoDao.selectByID(id)
  
  if (!video) {
    throw new AppError('Video not found', 404)
  }

  if (video.status !== 'completed' || !video.file_path) {
    throw new AppError('Video is not ready for download', 400)
  }

  const filePath = path.join(config.assetPath.model, video.file_path)
  
  if (!fs.existsSync(filePath)) {
    throw new AppError('Video file not found', 404)
  }

  res.download(filePath, `${video.name}.mp4`)
}))

/**
 * @swagger
 * /api/v1/videos/{id}:
 *   put:
 *     summary: Update video
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               text_content:
 *                 type: string
 *               voice_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Video updated successfully
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const updates = req.body
  
  const video = videoDao.selectByID(id)
  if (!video) {
    throw new AppError('Video not found', 404)
  }

  videoDao.update({
    id,
    ...updates
  })

  logger.info(`Video updated: ${video.name} (ID: ${id})`)

  res.json({
    success: true,
    message: 'Video updated successfully',
    data: {
      id,
      ...updates
    }
  })
}))

/**
 * @swagger
 * /api/v1/videos/{id}:
 *   delete:
 *     summary: Delete video
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Video deleted successfully
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  
  videoService.deleteVideo(id)

  res.json({
    success: true,
    message: 'Video deleted successfully'
  })
}))

// Helper function to process video (will be extracted to service layer)
async function processVideo(videoId) {
  try {
    logger.info(`Starting video processing for ID: ${videoId}`)
    // Use service layer for video processing
    await videoService.synthesizeVideo(videoId)
  } catch (error) {
    logger.error(`Error processing video ${videoId}:`, error)
    // Service layer will handle error status update
  }
}

export default router
