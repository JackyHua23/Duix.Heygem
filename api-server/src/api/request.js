import axios from 'axios'
import logger from '../utils/logger.js'

const instance = axios.create({
  timeout: 30000 // 30 seconds timeout
})

// Request interceptor
instance.interceptors.request.use(
  (config) => {
    logger.debug(`[HTTP Request] ${config.method?.toUpperCase()} ${config.url}`, {
      data: config.data,
      params: config.params
    })
    return config
  },
  (error) => {
    logger.error('[HTTP Request Error]:', error)
    return Promise.reject(error)
  }
)

// Response interceptor
instance.interceptors.response.use(
  (response) => {
    logger.debug(`[HTTP Response] ${response.status} ${response.config.url}`, {
      data: response.data
    })
    return response.data
  },
  (error) => {
    logger.error('[HTTP Response Error]:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url
    })
    return Promise.reject(error)
  }
)

export default instance
