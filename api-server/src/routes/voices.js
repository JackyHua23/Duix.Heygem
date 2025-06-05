import express from 'express'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import * as voiceDao from '../dao/voice.js'

const router = express.Router()

/**
 * @swagger
 * /api/v1/voices:
 *   get:
 *     summary: Get all voices
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/', asyncHandler(async (req, res) => {
  const voices = voiceDao.selectAll()

  res.json({
    success: true,
    data: voices
  })
}))

/**
 * @swagger
 * /api/v1/voices/{id}:
 *   get:
 *     summary: Get voice by ID
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
 *         description: Voice not found
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const voice = voiceDao.selectByID(id)
  
  if (!voice) {
    throw new AppError('Voice not found', 404)
  }

  res.json({
    success: true,
    data: voice
  })
}))

export default router
