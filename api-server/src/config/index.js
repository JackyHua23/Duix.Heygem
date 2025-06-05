import path from 'path'
import os from 'os'

const isDev = process.env.NODE_ENV === 'development'
const isWin = process.platform === 'win32'

export const config = {
  // Server config
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Service URLs
  serviceUrl: {
    face2face: isDev ? 'http://192.168.4.204:8383/easy' : 'http://127.0.0.1:8383/easy',
    tts: isDev ? 'http://192.168.4.204:18180' : 'http://127.0.0.1:18180'
  },

  // File storage paths
  assetPath: {
    model: isWin
      ? path.join('D:', 'heygem_data', 'face2face', 'temp')
      : path.join(os.homedir(), 'heygem_data', 'face2face', 'temp'),
    ttsProduct: isWin
      ? path.join('D:', 'heygem_data', 'face2face', 'temp')
      : path.join(os.homedir(), 'heygem_data', 'face2face', 'temp'),
    ttsRoot: isWin
      ? path.join('D:', 'heygem_data', 'voice', 'data')
      : path.join(os.homedir(), 'heygem_data', 'voice', 'data'),
    ttsTrain: isWin
      ? path.join('D:', 'heygem_data', 'voice', 'data', 'origin_audio')
      : path.join(os.homedir(), 'heygem_data', 'voice', 'data', 'origin_audio'),
    uploads: path.join(process.cwd(), 'uploads'),
    temp: path.join(process.cwd(), 'temp')
  },

  // Database config
  database: {
    path: process.env.DB_PATH || path.join(process.cwd(), 'data', 'heygem.db')
  },

  // Upload limits
  upload: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedVideoTypes: ['video/mp4', 'video/avi', 'video/mov', 'video/mkv'],
    allowedAudioTypes: ['audio/wav', 'audio/mp3', 'audio/m4a', 'audio/flac']
  },

  // Background processing
  background: {
    processingInterval: parseInt(process.env.PROCESSING_INTERVAL) || 2000,
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
    queuePollingInterval: parseInt(process.env.QUEUE_POLLING_INTERVAL) || 5000
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
    fileRotation: {
      maxSize: '100m',
      maxFiles: '14d'
    }
  }
}

export default config
