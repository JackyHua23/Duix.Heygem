/**
 * Video Service
 * Handles video processing, synthesis, and management
 */

import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import { config } from '../config/index.js'
import logger from '../utils/logger.js'
import * as videoDao from '../dao/video.js'
import * as modelDao from '../dao/f2f-model.js'
import * as voiceDao from '../dao/voice.js'
import { makeVideo as makeVideoApi, getVideoStatus } from '../api/f2f.js'
import { makeAudioForVideo, copyAudioForVideo } from './voice.js'
import { getVideoDuration } from '../utils/ffmpeg.js'

/**
 * Get paginated videos with queue information
 * @param {Object} params - Pagination parameters
 * @param {number} params.page - Page number
 * @param {number} params.pageSize - Page size
 * @param {string} [params.name=''] - Name filter
 * @returns {Object} - Paginated video list
 */
export function getVideoPage({ page, pageSize, name = '' }) {
  // Get waiting videos for queue position calculation
  const waitingVideos = videoDao.selectByStatus('waiting').map((v) => v.id)
  const total = videoDao.count(name)
  const list = videoDao.selectPage({ page, pageSize, name }).map((video) => {
    // Add full file path if file exists
    video = {
      ...video,
      file_path: video.file_path 
        ? path.join(config.assetPath.model, video.file_path) 
        : video.file_path
    }

    // Add queue position for waiting videos
    if (video.status === 'waiting') {
      const queuePosition = waitingVideos.indexOf(video.id) + 1
      video.progress = `${queuePosition} / ${waitingVideos.length}`
    }
    
    return video
  })

  return { total, list }
}

/**
 * Get video by ID
 * @param {number} videoId - Video ID
 * @returns {Object|null} - Video object with full file path
 */
export function getVideoById(videoId) {
  const video = videoDao.selectByID(videoId)
  if (!video) return null

  return {
    ...video,
    file_path: video.file_path 
      ? path.join(config.assetPath.model, video.file_path) 
      : video.file_path
  }
}

/**
 * Create or update video
 * @param {Object} videoData - Video data
 * @param {number} [videoData.id] - Video ID for updates
 * @param {number} videoData.model_id - Model ID
 * @param {string} videoData.name - Video name
 * @param {string} videoData.text_content - Text content
 * @param {number} [videoData.voice_id] - Voice ID
 * @param {string} [videoData.audio_path] - Audio file path
 * @returns {number} - Video ID
 */
export function saveVideo({ id, model_id, name, text_content, voice_id, audio_path }) {
  let processedAudioPath = audio_path

  // Copy audio file if provided
  if (audio_path) {
    processedAudioPath = copyAudioForVideo(audio_path)
  }

  if (id) {
    // Update existing video
    const video = videoDao.selectByID(id)
    if (video) {
      videoDao.update({
        id,
        model_id,
        name,
        text_content,
        voice_id,
        audio_path: processedAudioPath
      })
      logger.info(`Video updated: ${name} (ID: ${id})`)
      return id
    }
  }

  // Create new video
  const videoId = videoDao.insert({
    model_id,
    name,
    status: 'draft',
    text_content,
    voice_id,
    audio_path: processedAudioPath
  })

  logger.info(`Video created: ${name} (ID: ${videoId})`)
  return videoId
}

/**
 * Start video generation process
 * @param {number} videoId - Video ID
 * @returns {Promise<number>} - Video ID
 */
export function startVideoGeneration(videoId) {
  // Update video status to waiting
  videoDao.update({
    id: videoId,
    status: 'waiting'
  })

  logger.info(`Video generation queued: ID ${videoId}`)
  return videoId
}

/**
 * Process video synthesis (main synthesis logic)
 * @param {number} videoId - Video ID to process
 * @returns {Promise<number>} - Video ID
 */
export async function synthesizeVideo(videoId) {
  try {
    // Update status to processing
    videoDao.update({
      id: videoId,
      file_path: null,
      status: 'processing',
      message: 'Submitting task...'
    })

    logger.info(`Starting video synthesis for ID: ${videoId}`)

    // Get video details
    const video = videoDao.selectByID(videoId)
    if (!video) {
      throw new Error(`Video not found: ${videoId}`)
    }

    // Get model information
    const model = modelDao.selectByID(video.model_id)
    if (!model) {
      throw new Error(`Model not found: ${video.model_id}`)
    }

    let audioPath

    if (video.audio_path) {
      // Use existing audio file
      audioPath = video.audio_path
      logger.debug(`Using existing audio: ${audioPath}`)
    } else {
      // Generate audio from text using TTS
      const voice = voiceDao.selectByID(video.voice_id || model.voice_id)
      if (!voice) {
        throw new Error(`Voice not found: ${video.voice_id || model.voice_id}`)
      }

      logger.debug(`Generating audio for voice: ${voice.id}`)
      audioPath = await makeAudioForVideo({
        voiceId: voice.id,
        text: video.text_content
      })
      logger.debug(`Audio generated: ${audioPath}`)
    }

    // Call Face2Face API for video generation
    let result, param
    if (process.env.NODE_ENV === 'development') {
      // Mock result for development
      result = { code: 10000, msg: 'Development mode - task submitted' }
      param = { code: crypto.randomUUID() }
      logger.debug('Development mode: using mock Face2Face response')
    } else {
      const response = await callFace2FaceAPI(audioPath, model.video_path)
      result = response.result
      param = response.param
    }

    logger.debug('Face2Face API response:', { result, param })

    // Update video status based on API response
    if (result.code === 10000) {
      // Success - move to pending status
      videoDao.update({
        id: videoId,
        file_path: null,
        status: 'pending',
        message: result.msg || 'Task submitted successfully',
        audio_path: audioPath,
        param: JSON.stringify(param),
        code: param.code
      })
      logger.info(`Video task submitted successfully: ${videoId}`)
    } else {
      // Failed
      videoDao.update({
        id: videoId,
        file_path: null,
        status: 'failed',
        message: result.msg || 'Task submission failed',
        audio_path: audioPath,
        param: JSON.stringify(param),
        code: param.code
      })
      logger.error(`Video task submission failed: ${videoId}, ${result.msg}`)
    }

    return videoId
  } catch (error) {
    logger.error(`Video synthesis error for ID ${videoId}:`, error)
    
    // Update status to failed
    videoDao.updateStatus(videoId, 'failed', error.message)
    
    throw error
  }
}

/**
 * Call Face2Face API for video generation
 * @param {string} audioPath - Audio file path
 * @param {string} videoPath - Model video path
 * @returns {Promise<Object>} - API response with param and result
 */
async function callFace2FaceAPI(audioPath, videoPath) {
  const uuid = crypto.randomUUID()
  const param = {
    audio_url: audioPath,
    video_url: videoPath,
    code: uuid,
    chaofen: 0,
    watermark_switch: 0,
    pn: 1
  }

  const result = await makeVideoApi(param)
  return { param, result }
}

/**
 * Process pending videos (check status and update)
 * @returns {Promise<Object|null>} - Processed video or null
 */
export async function processPendingVideos() {
  const video = videoDao.findFirstByStatus('pending')
  
  if (!video) {
    // No pending videos, try to start next waiting video
    processNextWaitingVideo()
    return null
  }

  try {
    logger.debug(`Checking status for pending video: ${video.id}`)
    
    const statusResponse = await getVideoStatus(video.code)
    logger.debug(`Status response for video ${video.id}:`, statusResponse)

    // Handle different status codes
    if ([9999, 10002, 10003].includes(statusResponse.code)) {
      // Failed status codes
      videoDao.updateStatus(video.id, 'failed', statusResponse.msg)
      logger.error(`Video ${video.id} failed: ${statusResponse.msg}`)
    } else if (statusResponse.code === 10000) {
      // Success status code - check detailed status
      const { status, msg, progress, result } = statusResponse.data

      if (status === 1) {
        // Still processing
        videoDao.updateStatus(video.id, 'pending', msg, progress)
        logger.debug(`Video ${video.id} processing: ${progress}%`)
      } else if (status === 2) {
        // Synthesis completed successfully
        await handleVideoCompletion(video, statusResponse.data)
      } else if (status === 3) {
        // Synthesis failed
        videoDao.updateStatus(video.id, 'failed', msg)
        logger.error(`Video ${video.id} synthesis failed: ${msg}`)
      }
    }

    return video
  } catch (error) {
    logger.error(`Error checking video status for ID ${video.id}:`, error)
    videoDao.updateStatus(video.id, 'failed', `Status check failed: ${error.message}`)
    return video
  }
}

/**
 * Handle video completion (status 2)
 * @param {Object} video - Video object
 * @param {Object} statusData - Status response data
 */
async function handleVideoCompletion(video, statusData) {
  try {
    const { msg, progress, result } = statusData

    // Get video duration using FFmpeg
    let duration
    if (process.env.NODE_ENV === 'development') {
      // Mock duration for development
      duration = 10
    } else {
      const resultPath = path.join(config.assetPath.model, result)
      duration = await getVideoDuration(resultPath)
    }

    // Update video with completion status
    videoDao.update({
      id: video.id,
      status: 'completed',
      message: msg,
      progress: progress,
      file_path: result,
      duration
    })

    logger.info(`Video synthesis completed: ${video.name} (ID: ${video.id})`)
  } catch (error) {
    logger.error(`Error handling video completion for ID ${video.id}:`, error)
    videoDao.updateStatus(video.id, 'failed', `Completion handling failed: ${error.message}`)
  }
}

/**
 * Process next waiting video
 */
export function processNextWaitingVideo() {
  const video = videoDao.findFirstByStatus('waiting')
  if (video) {
    logger.info(`Starting synthesis for waiting video: ${video.id}`)
    // Start synthesis asynchronously
    setImmediate(() => synthesizeVideo(video.id))
  }
}

/**
 * Delete video and associated files
 * @param {number} videoId - Video ID
 * @returns {boolean} - Success status
 */
export function deleteVideo(videoId) {
  try {
    const video = videoDao.selectByID(videoId)
    if (!video) {
      throw new Error(`Video not found: ${videoId}`)
    }

    logger.info(`Deleting video: ${video.name} (ID: ${videoId})`)

    // Delete video file if exists
    if (video.file_path) {
      const videoFilePath = path.join(config.assetPath.model, video.file_path)
      if (fs.existsSync(videoFilePath)) {
        fs.unlinkSync(videoFilePath)
        logger.debug(`Deleted video file: ${videoFilePath}`)
      }
    }

    // Delete audio file if exists
    if (video.audio_path) {
      const audioFilePath = path.join(config.assetPath.ttsProduct, video.audio_path)
      if (fs.existsSync(audioFilePath)) {
        fs.unlinkSync(audioFilePath)
        logger.debug(`Deleted audio file: ${audioFilePath}`)
      }
    }

    // Remove from database
    videoDao.remove(videoId)
    
    logger.info(`Video deleted successfully: ${videoId}`)
    return true
  } catch (error) {
    logger.error(`Error deleting video ${videoId}:`, error)
    throw error
  }
}

/**
 * Export video to specified path
 * @param {number} videoId - Video ID
 * @param {string} outputPath - Output file path
 * @returns {boolean} - Success status
 */
export function exportVideo(videoId, outputPath) {
  try {
    const video = videoDao.selectByID(videoId)
    if (!video) {
      throw new Error(`Video not found: ${videoId}`)
    }

    if (!video.file_path) {
      throw new Error(`Video file not available: ${videoId}`)
    }

    const sourceFilePath = path.join(config.assetPath.model, video.file_path)
    if (!fs.existsSync(sourceFilePath)) {
      throw new Error(`Video file not found: ${sourceFilePath}`)
    }

    fs.copyFileSync(sourceFilePath, outputPath)
    logger.info(`Video exported: ${videoId} -> ${outputPath}`)
    return true
  } catch (error) {
    logger.error(`Error exporting video ${videoId}:`, error)
    throw error
  }
}

/**
 * Get video count by name filter
 * @param {string} [name=''] - Name filter
 * @returns {number} - Video count
 */
export function getVideoCount(name = '') {
  return videoDao.count(name)
}
