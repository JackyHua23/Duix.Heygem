import request from './request.js'
import { config } from '../config/index.js'
import logger from '../utils/logger.js'

export function makeVideo(param) {
  logger.debug('Face2Face makeVideo param:', JSON.stringify(param))
  return request.post(`${config.serviceUrl.face2face}/submit`, param)
}

export function getVideoStatus(taskCode) {
  return request.get(`${config.serviceUrl.face2face}/query?code=${taskCode}`).then((res) => {
    logger.debug('Face2Face getVideoStatus response:', JSON.stringify(res))
    return res
  })
}
