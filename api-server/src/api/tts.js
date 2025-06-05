/**
 * TTS (Text-to-Speech) API Client
 * Handles communication with the TTS service
 */

import request from './request.js'
import { config } from '../config/index.js'
import logger from '../utils/logger.js'

/**
 * Generate audio from text using TTS service
 * @param {Object} params - TTS parameters
 * @param {string} params.speaker - Speaker UUID
 * @param {string} params.text - Text to synthesize
 * @param {string} params.format - Audio format (e.g., 'wav')
 * @param {number} params.topP - Top-p sampling parameter
 * @param {number} params.max_new_tokens - Maximum new tokens
 * @param {number} params.chunk_length - Chunk length
 * @param {number} params.repetition_penalty - Repetition penalty
 * @param {number} params.temperature - Temperature parameter
 * @param {boolean} params.need_asr - Whether ASR is needed
 * @param {boolean} params.streaming - Whether to use streaming
 * @param {number} params.is_fixed_seed - Fixed seed parameter
 * @param {number} params.is_norm - Normalization parameter
 * @param {string} params.reference_audio - Reference audio URL
 * @param {string} params.reference_text - Reference text
 * @returns {Promise<Buffer>} - Audio data as buffer
 */
export function makeAudio(params) {
  logger.debug('TTS makeAudio request:', JSON.stringify(params))
  
  return request.post(`${config.serviceUrl.tts}/v1/invoke`, params, {
    responseType: 'arraybuffer'
  })
}

/**
 * Preprocess and train voice model
 * @param {Object} params - Training parameters
 * @param {string} params.format - Audio format (e.g., '.wav')
 * @param {string} params.reference_audio - Reference audio file path
 * @param {string} params.lang - Language code (e.g., 'zh')
 * @returns {Promise<Object>} - Training result
 */
export function preprocessAndTrain(params) {
  logger.debug('TTS preprocessAndTrain request:', JSON.stringify(params))
  
  return request.post(`${config.serviceUrl.tts}/v1/preprocess_and_tran`, params)
}

/**
 * Health check for TTS service
 * @returns {Promise<Object>} - Health status
 */
export async function healthCheck() {
  try {
    const response = await request.get(`${config.serviceUrl.tts}/health`)
    return { healthy: true, response }
  } catch (error) {
    logger.error('TTS service health check failed:', error)
    return { healthy: false, error: error.message }
  }
}
