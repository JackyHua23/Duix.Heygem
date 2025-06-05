import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import swaggerUi from 'swagger-ui-express'
import swaggerJsdoc from 'swagger-jsdoc'

import { initDB } from './db/index.js'
import { initLogger } from './utils/logger.js'
import logger from './utils/logger.js'
import { errorHandler } from './middleware/errorHandler.js'
import { initBackgroundProcessing } from './background/index.js'
import config from './config/index.js'
import { validateEnvironment, setupDefaults } from './config/env-validation.js'
import { ensureDirectories } from './utils/storage.js'

// Import routes
import modelsRouter from './routes/models.js'
import videosRouter from './routes/videos.js'
import voicesRouter from './routes/voices.js'
import filesRouter from './routes/files.js'
import tasksRouter from './routes/tasks.js'

const app = express()
const PORT = config.port || process.env.PORT || 3000

// Initialize application components
async function initializeApp() {
  try {
    // Setup environment defaults
    setupDefaults()
    
    // Initialize logger first
    initLogger()
    logger.info('Starting HeyGem API Server...')

    // Validate environment
    validateEnvironment()
    
    // Ensure storage directories exist
    ensureDirectories()
    
    // Initialize database
    await initDB()
    logger.info('Database initialized successfully')

    // Initialize background processing
    initBackgroundProcessing(config.background?.processingInterval || 2000)
    logger.info('Background processing initialized')

    return true
  } catch (error) {
    logger.error('Failed to initialize application:', error)
    process.exit(1)
  }
}

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HeyGem API',
      version: '1.0.0',
      description: 'HeyGem Digital Human API Server',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/routes/*.js'], // Path to the API docs
}

const specs = swaggerJsdoc(swaggerOptions)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
})

// Middleware
app.use(helmet())
app.use(cors())
app.use(compression())
app.use(limiter)
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs))

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
})

// API Routes
app.use('/api/v1/models', modelsRouter)
app.use('/api/v1/videos', videosRouter)
app.use('/api/v1/voices', voicesRouter)
app.use('/api/v1/files', filesRouter)
app.use('/api/v1/tasks', tasksRouter)

// Error handling middleware
app.use(errorHandler)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Start server
async function startServer() {
  await initializeApp()
  
  app.listen(PORT, () => {
    logger.info(`HeyGem API Server running on port ${PORT}`)
    logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`)
    logger.info('Server ready to accept connections')
  })
}

// Start the application
startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})

export default app
