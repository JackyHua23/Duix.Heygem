import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import logger from '../utils/logger.js'
import { config } from '../config/index.js'
import * as modelDao from '../dao/f2f-model.js'
import { extractAudio } from '../utils/ffmpeg.js'

const router = express.Router()

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = config.assetPath.uploads
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`
    cb(null, uniqueName)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    if (config.upload.allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new AppError('Invalid file type. Only video files are allowed.', 400))
    }
  }
})

/**
 * @swagger
 * /api/v1/models:
 *   get:
 *     summary: Get paginated models
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
  
  const total = modelDao.count(name)
  const list = modelDao.selectPage({ 
    page: parseInt(page), 
    pageSize: parseInt(pageSize), 
    name 
  }).map((model) => ({
    ...model,
    video_path: path.join(config.assetPath.model, model.video_path || ''),
    audio_path: path.join(config.assetPath.ttsRoot, model.audio_path || '')
  }))

  res.json({
    success: true,
    data: {
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      list
    }
  })
}))

/**
 * @swagger
 * /api/v1/models/{id}:
 *   get:
 *     summary: Get model by ID
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
 *         description: Model not found
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const model = modelDao.selectByID(id)
  
  if (!model) {
    throw new AppError('Model not found', 404)
  }

  res.json({
    success: true,
    data: {
      ...model,
      video_path: path.join(config.assetPath.model, model.video_path || ''),
      audio_path: path.join(config.assetPath.ttsRoot, model.audio_path || '')
    }
  })
}))

/**
 * @swagger
 * /api/v1/models:
 *   post:
 *     summary: Create new model
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               video:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Model created successfully
 */
router.post('/', upload.single('video'), asyncHandler(async (req, res) => {
  const { name } = req.body
  
  if (!name) {
    throw new AppError('Model name is required', 400)
  }
  
  if (!req.file) {
    throw new AppError('Video file is required', 400)
  }

  // Move uploaded file to model directory
  const modelDir = config.assetPath.model
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true })
  }

  const originalPath = req.file.path
  const modelVideoPath = path.join(modelDir, `${uuidv4()}.mp4`)
  
  // Copy file to model directory
  fs.copyFileSync(originalPath, modelVideoPath)
  
  // Extract audio for voice training
  const audioFileName = `${uuidv4()}.wav`
  const audioPath = path.join(config.assetPath.ttsTrain, audioFileName)
  
  if (!fs.existsSync(config.assetPath.ttsTrain)) {
    fs.mkdirSync(config.assetPath.ttsTrain, { recursive: true })
  }

  try {
    await extractAudio(modelVideoPath, audioPath)
    
    // Save to database
    const modelId = modelDao.insert({
      modelName: name,
      videoPath: path.basename(modelVideoPath),
      audioPath: audioFileName,
      voiceId: null // Will be set after voice training
    })

    // Clean up uploaded file
    fs.unlinkSync(originalPath)

    logger.info(`Model created: ${name} (ID: ${modelId})`)

    res.status(201).json({
      success: true,
      data: {
        id: modelId,
        name,
        video_path: modelVideoPath,
        audio_path: audioPath
      }
    })
  } catch (error) {
    // Clean up files on error
    if (fs.existsSync(modelVideoPath)) {
      fs.unlinkSync(modelVideoPath)
    }
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath)
    }
    if (fs.existsSync(originalPath)) {
      fs.unlinkSync(originalPath)
    }
    throw error
  }
}))

/**
 * @swagger
 * /api/v1/models/{id}:
 *   delete:
 *     summary: Delete model
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Model deleted successfully
 *       404:
 *         description: Model not found
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const model = modelDao.selectByID(id)
  
  if (!model) {
    throw new AppError('Model not found', 404)
  }

  // Delete video file
  const videoPath = path.join(config.assetPath.model, model.video_path || '')
  if (model.video_path && fs.existsSync(videoPath)) {
    fs.unlinkSync(videoPath)
  }

  // Delete audio file
  const audioPath = path.join(config.assetPath.ttsRoot, model.audio_path || '')
  if (model.audio_path && fs.existsSync(audioPath)) {
    fs.unlinkSync(audioPath)
  }

  // Delete from database
  modelDao.remove(id)

  logger.info(`Model deleted: ${model.name} (ID: ${id})`)

  res.json({
    success: true,
    message: 'Model deleted successfully'
  })
}))

export default router
