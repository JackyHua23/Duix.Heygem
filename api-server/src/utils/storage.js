/**
 * File Storage Management
 * Handles file uploads, downloads, and storage path management
 */

import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import config from '../config/index.js'
import logger from '../utils/logger.js'
import { AppError } from '../middleware/errorHandler.js'

const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)
const unlink = promisify(fs.unlink)
const stat = promisify(fs.stat)

/**
 * Multer configuration for file uploads
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = config.assetPath.uploads
    
    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}_${Date.now()}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  }
})

/**
 * File filter for uploads
 */
const fileFilter = (req, file, cb) => {
  const isVideo = config.upload.allowedVideoTypes.includes(file.mimetype)
  const isAudio = config.upload.allowedAudioTypes.includes(file.mimetype)
  
  if (isVideo || isAudio) {
    cb(null, true)
  } else {
    cb(new AppError(`Unsupported file type: ${file.mimetype}`, 400), false)
  }
}

/**
 * Multer upload middleware
 */
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize
  }
})

/**
 * Save base64 data as file
 * @param {string} base64Data - Base64 encoded file data
 * @param {string} fileName - Original filename
 * @param {string} [subDir=''] - Subdirectory to save in
 * @returns {Promise<string>} Path to saved file
 */
export async function saveBase64File(base64Data, fileName, subDir = '') {
  try {
    // Remove data URL prefix if present
    const base64Content = base64Data.replace(/^data:[^;]+;base64,/, '')
    const buffer = Buffer.from(base64Content, 'base64')
    
    // Generate unique filename
    const ext = path.extname(fileName)
    const uniqueName = `${uuidv4()}_${Date.now()}${ext}`
    
    // Construct file path
    const uploadDir = path.join(config.assetPath.uploads, subDir)
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    
    const filePath = path.join(uploadDir, uniqueName)
    
    // Save file
    await writeFile(filePath, buffer)
    
    logger.info(`Saved base64 file: ${filePath}`)
    return filePath
  } catch (error) {
    logger.error('Failed to save base64 file:', error)
    throw new AppError('Failed to save file', 500)
  }
}

/**
 * Get file info
 * @param {string} filePath - Path to file
 * @returns {Promise<object>} File information
 */
export async function getFileInfo(filePath) {
  try {
    const stats = await stat(filePath)
    return {
      exists: true,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory()
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { exists: false }
    }
    throw error
  }
}

/**
 * Delete file safely
 * @param {string} filePath - Path to file to delete
 * @returns {Promise<boolean>} Success status
 */
export async function deleteFile(filePath) {
  try {
    const info = await getFileInfo(filePath)
    if (!info.exists) {
      logger.warn(`File does not exist: ${filePath}`)
      return false
    }
    
    await unlink(filePath)
    logger.info(`Deleted file: ${filePath}`)
    return true
  } catch (error) {
    logger.error(`Failed to delete file ${filePath}:`, error)
    return false
  }
}

/**
 * Copy file to destination
 * @param {string} sourcePath - Source file path
 * @param {string} destPath - Destination file path
 * @returns {Promise<string>} Destination path
 */
export async function copyFile(sourcePath, destPath) {
  try {
    const sourceData = await readFile(sourcePath)
    
    // Ensure destination directory exists
    const destDir = path.dirname(destPath)
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true })
    }
    
    await writeFile(destPath, sourceData)
    logger.info(`Copied file from ${sourcePath} to ${destPath}`)
    return destPath
  } catch (error) {
    logger.error(`Failed to copy file from ${sourcePath} to ${destPath}:`, error)
    throw new AppError('Failed to copy file', 500)
  }
}

/**
 * Generate download URL for file
 * @param {string} filePath - Path to file
 * @param {string} baseUrl - Base URL of the server
 * @returns {string} Download URL
 */
export function generateDownloadUrl(filePath, baseUrl) {
  // Extract relative path from uploads directory
  const uploadsDir = config.assetPath.uploads
  const relativePath = path.relative(uploadsDir, filePath)
  return `${baseUrl}/api/v1/files/download/${encodeURIComponent(relativePath)}`
}

/**
 * Clean up temporary files older than specified hours
 * @param {number} [olderThanHours=24] - Remove files older than this many hours
 * @returns {Promise<number>} Number of files deleted
 */
export async function cleanupTempFiles(olderThanHours = 24) {
  const tempDir = config.assetPath.temp
  let deletedCount = 0
  
  try {
    if (!fs.existsSync(tempDir)) {
      return deletedCount
    }
    
    const files = fs.readdirSync(tempDir)
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000)
    
    for (const file of files) {
      const filePath = path.join(tempDir, file)
      const stats = await stat(filePath)
      
      if (stats.mtime.getTime() < cutoffTime) {
        await deleteFile(filePath)
        deletedCount++
      }
    }
    
    logger.info(`Cleaned up ${deletedCount} temporary files older than ${olderThanHours} hours`)
  } catch (error) {
    logger.error('Failed to cleanup temporary files:', error)
  }
  
  return deletedCount
}

/**
 * Ensure required directories exist
 */
export function ensureDirectories() {
  const dirs = [
    config.assetPath.uploads,
    config.assetPath.temp,
    config.assetPath.model,
    config.assetPath.ttsProduct,
    config.assetPath.ttsRoot,
    config.assetPath.ttsTrain
  ]
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      logger.info(`Created directory: ${dir}`)
    }
  }
}
