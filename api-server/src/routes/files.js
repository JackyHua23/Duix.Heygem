import express from 'express'
import path from 'path'
import fs from 'fs'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import config from '../config/index.js'
import { 
  upload, 
  saveBase64File, 
  getFileInfo, 
  deleteFile, 
  generateDownloadUrl,
  cleanupTempFiles 
} from '../utils/storage.js'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * @swagger
 * /api/v1/files/upload:
 *   post:
 *     summary: Upload file
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               subDir:
 *                 type: string
 *                 description: Subdirectory to store file in
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *       400:
 *         description: Bad request
 */
router.post('/upload', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400)
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`
  const downloadUrl = generateDownloadUrl(req.file.path, baseUrl)

  logger.info(`File uploaded: ${req.file.originalname} -> ${req.file.filename}`)

  res.json({
    success: true,
    data: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path,
      downloadUrl
    }
  })
}))

/**
 * @swagger
 * /api/v1/files/upload-base64:
 *   post:
 *     summary: Upload file from base64 data
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: string
 *                 description: Base64 encoded file data
 *               filename:
 *                 type: string
 *                 description: Original filename
 *               subDir:
 *                 type: string
 *                 description: Subdirectory to store file in
 *     responses:
 *       200:
 *         description: File uploaded successfully
 */
router.post('/upload-base64', asyncHandler(async (req, res) => {
  const { data, filename, subDir = '' } = req.body

  if (!data || !filename) {
    throw new AppError('Missing data or filename', 400)
  }

  const filePath = await saveBase64File(data, filename, subDir)
  const baseUrl = `${req.protocol}://${req.get('host')}`
  const downloadUrl = generateDownloadUrl(filePath, baseUrl)

  logger.info(`Base64 file uploaded: ${filename}`)

  res.json({
    success: true,
    data: {
      filename: path.basename(filePath),
      originalName: filename,
      path: filePath,
      downloadUrl
    }
  })
}))

/**
 * @swagger
 * /api/v1/files/download/{filename}:
 *   get:
 *     summary: Download file
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Encoded filename or relative path
 *     responses:
 *       200:
 *         description: File content
 *       404:
 *         description: File not found
 */
router.get('/download/:filename', asyncHandler(async (req, res) => {
  const filename = decodeURIComponent(req.params.filename)
  const filePath = path.join(config.assetPath.uploads, filename)
  
  const fileInfo = await getFileInfo(filePath)
  if (!fileInfo.exists) {
    throw new AppError('File not found', 404)
  }

  logger.info(`File download: ${filename}`)
  res.sendFile(path.resolve(filePath))
}))

/**
 * @swagger
 * /api/v1/files/info/{filename}:
 *   get:
 *     summary: Get file information
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File information
 *       404:
 *         description: File not found
 */
router.get('/info/:filename', asyncHandler(async (req, res) => {
  const filename = decodeURIComponent(req.params.filename)
  const filePath = path.join(config.assetPath.uploads, filename)
  
  const fileInfo = await getFileInfo(filePath)
  if (!fileInfo.exists) {
    throw new AppError('File not found', 404)
  }

  res.json({
    success: true,
    data: fileInfo
  })
}))

/**
 * @swagger
 * /api/v1/files/{filename}:
 *   delete:
 *     summary: Delete file
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       404:
 *         description: File not found
 */
router.delete('/:filename', asyncHandler(async (req, res) => {
  const filename = decodeURIComponent(req.params.filename)
  const filePath = path.join(config.assetPath.uploads, filename)
  
  const success = await deleteFile(filePath)
  if (!success) {
    throw new AppError('Failed to delete file', 500)
  }

  logger.info(`File deleted: ${filename}`)
  res.json({
    success: true,
    message: 'File deleted successfully'
  })
}))

/**
 * @swagger
 * /api/v1/files/cleanup-temp:
 *   post:
 *     summary: Cleanup temporary files
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               olderThanHours:
 *                 type: number
 *                 default: 24
 *     responses:
 *       200:
 *         description: Cleanup completed
 */
router.post('/cleanup-temp', asyncHandler(async (req, res) => {
  const { olderThanHours = 24 } = req.body
  
  const deletedCount = await cleanupTempFiles(olderThanHours)
  
  res.json({
    success: true,
    data: {
      deletedCount,
      olderThanHours
    }
  })
}))

export default router
