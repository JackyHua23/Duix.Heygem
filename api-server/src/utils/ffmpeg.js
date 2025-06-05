import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import logger from './logger.js'

let isInitialized = false

function initFFmpeg() {
  if (isInitialized) return
  
  // For API server, we'll use system ffmpeg or specify paths
  // You can customize these paths based on your deployment
  const ffmpegPath = {
    'development-win32': path.join(process.cwd(), '../resources/ffmpeg/win-amd64/bin/ffmpeg.exe'),
    'development-linux': path.join(process.cwd(), '../resources/ffmpeg/linux-amd64/ffmpeg'),
    'development-darwin': 'ffmpeg', // Use system ffmpeg on macOS
    'production-win32': path.join(process.cwd(), 'resources/ffmpeg/win-amd64/bin/ffmpeg.exe'),
    'production-linux': path.join(process.cwd(), 'resources/ffmpeg/linux-amd64/ffmpeg'),
    'production-darwin': 'ffmpeg' // Use system ffmpeg on macOS
  }

  if (process.env.NODE_ENV === undefined) {
    process.env.NODE_ENV = 'production'
  }

  const ffmpegPathValue = ffmpegPath[`${process.env.NODE_ENV}-${process.platform}`] || 'ffmpeg'
  console.log('FFmpeg ENV:', `${process.env.NODE_ENV}-${process.platform}`)
  console.log('FFmpeg path:', ffmpegPathValue)
  ffmpeg.setFfmpegPath(ffmpegPathValue)

  const ffprobePath = {
    'development-win32': path.join(process.cwd(), '../resources/ffmpeg/win-amd64/bin/ffprobe.exe'),
    'development-linux': path.join(process.cwd(), '../resources/ffmpeg/linux-amd64/ffprobe'),
    'development-darwin': 'ffprobe', // Use system ffprobe on macOS
    'production-win32': path.join(process.cwd(), 'resources/ffmpeg/win-amd64/bin/ffprobe.exe'),
    'production-linux': path.join(process.cwd(), 'resources/ffmpeg/linux-amd64/ffprobe'),
    'production-darwin': 'ffprobe' // Use system ffprobe on macOS
  }

  const ffprobePathValue = ffprobePath[`${process.env.NODE_ENV}-${process.platform}`] || 'ffprobe'
  console.log('FFprobe path:', ffprobePathValue)
  ffmpeg.setFfprobePath(ffprobePathValue)
  
  isInitialized = true
}

// Export the init function to be called after logger is ready
export { initFFmpeg }

export function extractAudio(videoPath, audioPath) {
  // Ensure FFmpeg is initialized
  initFFmpeg()
  
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('pcm_s16le') // WAV format
      .audioFrequency(16000)   // 16kHz for TTS
      .audioChannels(1)        // Mono
      .save(audioPath)
      .on('end', () => {
        logger.info('Audio extraction completed:', audioPath)
        resolve(true)
      })
      .on('error', (err) => {
        logger.error('Audio extraction failed:', err)
        reject(err)
      })
  })
}

export function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath).ffprobe((err, data) => {
      if (err) {
        logger.error("Error getting video duration:", err)
        reject(err)
      } else if (data && data.streams && data.streams.length > 0) {
        // Find video stream
        const videoStream = data.streams.find(stream => stream.codec_type === 'video')
        if (videoStream && videoStream.duration) {
          resolve(parseFloat(videoStream.duration)) // Duration in seconds
        } else {
          logger.error('No video stream found')
          reject(new Error('No video stream found'))
        }
      } else {
        logger.error('No streams found')
        reject(new Error('No streams found'))
      }
    })
  })
}
