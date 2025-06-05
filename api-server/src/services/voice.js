/**
 * Voice Service
 * Handles TTS (Text-to-Speech) operations and audio processing
 */

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import dayjs from 'dayjs'
import { config } from '../config/index.js'
import logger from '../utils/logger.js'
import * as voiceDao from '../dao/voice.js'
import { makeAudio as makeAudioApi, preprocessAndTrain } from '../api/tts.js'

/**
 * Make audio from text using TTS service
 * @param {Object} params - Audio generation parameters
 * @param {string} params.voiceId - Voice ID to use
 * @param {string} params.text - Text content to synthesize
 * @param {string} [params.targetDir] - Target directory for output file
 * @returns {Promise<string>} - Generated audio file name
 */
export async function makeAudio({ voiceId, text, targetDir = config.assetPath.ttsProduct }) {
  const uuid = crypto.randomUUID()
  const voice = voiceDao.selectByID(voiceId)
  
  if (!voice) {
    throw new Error(`Voice not found: ${voiceId}`)
  }

  logger.info(`Making audio for voice ${voiceId}, text length: ${text.length}`)

  const audioParams = {
    speaker: uuid,
    text,
    format: 'wav',
    topP: 0.7,
    max_new_tokens: 1024,
    chunk_length: 100,
    repetition_penalty: 1.2,
    temperature: 0.7,
    need_asr: false,
    streaming: false,
    is_fixed_seed: 0,
    is_norm: 1,
    reference_audio: voice.asr_format_audio_url,
    reference_text: voice.reference_audio_text
  }

  logger.debug('TTS request params:', audioParams)

  try {
    const response = await makeAudioApi(audioParams)

    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    const fileName = `${uuid}.wav`
    const filePath = path.join(targetDir, fileName)
    
    fs.writeFileSync(filePath, response, 'binary')
    
    logger.info(`Audio generated successfully: ${fileName}`)
    return fileName
  } catch (error) {
    logger.error('Error generating audio:', error)
    throw new Error(`TTS service error: ${error.message}`)
  }
}

/**
 * Make audio for video generation
 * @param {Object} params - Audio generation parameters
 * @param {string} params.voiceId - Voice ID to use
 * @param {string} params.text - Text content to synthesize
 * @returns {Promise<string>} - Generated audio file name
 */
export async function makeAudioForVideo({ voiceId, text }) {
  return makeAudio({
    voiceId,
    text,
    targetDir: config.assetPath.ttsProduct
  })
}

/**
 * Copy audio file for video use
 * @param {string} filePath - Source audio file path
 * @returns {string} - Copied file name
 */
export function copyAudioForVideo(filePath) {
  const targetDir = config.assetPath.ttsProduct
  const fileName = dayjs().format('YYYYMMDDHHmmssSSS') + path.extname(filePath)
  const targetPath = path.join(targetDir, fileName)
  
  // Ensure target directory exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  fs.copyFileSync(filePath, targetPath)
  logger.info(`Audio copied for video: ${fileName}`)
  return fileName
}

/**
 * Generate audio for audition/preview
 * @param {string} voiceId - Voice ID to use
 * @param {string} text - Text content to synthesize
 * @returns {Promise<string>} - Full path to generated audio file
 */
export async function audition(voiceId, text) {
  const tmpDir = config.assetPath.temp || require('os').tmpdir()
  const fileName = await makeAudio({ 
    voiceId, 
    text, 
    targetDir: tmpDir 
  })
  return path.join(tmpDir, fileName)
}

/**
 * Train a new voice model
 * @param {string} audioPath - Path to training audio file
 * @param {string} [lang='zh'] - Language code
 * @returns {Promise<number|boolean>} - Voice ID if successful, false if failed
 */
export async function trainVoice(audioPath, lang = 'zh') {
  try {
    // Normalize path separators
    audioPath = audioPath.replace(/\\/g, '/')
    
    logger.info(`Training voice model from: ${audioPath}`)

    const trainParams = {
      format: '.' + audioPath.split('.').pop(),
      reference_audio: audioPath,
      lang
    }

    const response = await preprocessAndTrain(trainParams)

    logger.debug('Voice training response:', response)

    if (response.code !== 0) {
      logger.error('Voice training failed:', response)
      return false
    }

    const { asr_format_audio_url, reference_audio_text } = response
    
    const voiceId = voiceDao.insert({
      origin_audio_path: audioPath,
      lang,
      asr_format_audio_url,
      reference_audio_text
    })

    logger.info(`Voice model trained successfully, ID: ${voiceId}`)
    return voiceId
  } catch (error) {
    logger.error('Error training voice model:', error)
    throw new Error(`Voice training failed: ${error.message}`)
  }
}

/**
 * Get all available voices
 * @returns {Array} - List of all voices
 */
export function getAllVoices() {
  return voiceDao.selectAll()
}

/**
 * Get voice by ID
 * @param {number} id - Voice ID
 * @returns {Object|null} - Voice object or null if not found
 */
export function getVoiceById(id) {
  return voiceDao.selectByID(id)
}
