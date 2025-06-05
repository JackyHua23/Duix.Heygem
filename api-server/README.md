# HeyGem API Server

A Node.js/Express HTTP API server for HeyGem digital human video generation, refactored from the original Electron desktop application.

## Features

- **REST API**: Complete HTTP API for video generation, voice synthesis, and file management
- **Background Processing**: Automated task queue processing for video generation
- **File Management**: Upload, download, and storage management for media files
- **Database Integration**: SQLite database for persistent data storage
- **External APIs**: Integration with Face2Face and TTS services
- **Docker Support**: Containerized deployment with Docker and Docker Compose
- **Comprehensive Logging**: Structured logging with Winston
- **API Documentation**: Auto-generated Swagger/OpenAPI documentation

## Architecture

```
├── src/
│   ├── app.js                 # Main Express application
│   ├── api/                   # External API clients
│   │   ├── f2f.js            # Face2Face API client
│   │   ├── tts.js            # TTS API client
│   │   └── request.js        # HTTP request wrapper
│   ├── background/           # Background processing
│   │   └── index.js          # Task queue management
│   ├── config/               # Configuration management
│   │   ├── index.js          # Main configuration
│   │   └── env-validation.js # Environment validation
│   ├── dao/                  # Data Access Objects
│   │   ├── f2f-model.js      # Face2Face models
│   │   ├── video.js          # Video data access
│   │   ├── voice.js          # Voice data access
│   │   └── context.js        # Context data access
│   ├── db/                   # Database layer
│   │   ├── index.js          # Database initialization
│   │   └── sql.js            # SQL schema
│   ├── middleware/           # Express middleware
│   │   └── errorHandler.js   # Error handling
│   ├── routes/               # API routes
│   │   ├── models.js         # Model management
│   │   ├── videos.js         # Video generation
│   │   ├── voices.js         # Voice synthesis
│   │   ├── files.js          # File operations
│   │   └── tasks.js          # Task management
│   ├── services/             # Business logic layer
│   │   ├── video.js          # Video processing service
│   │   ├── voice.js          # Voice synthesis service
│   │   └── task.js           # Task management service
│   └── utils/                # Utility functions
│       ├── logger.js         # Winston logger
│       ├── storage.js        # File storage utilities
│       └── ffmpeg.js         # FFmpeg wrapper
```

## Installation

### Prerequisites

- Node.js 16+ 
- FFmpeg (for video processing)
- SQLite3

### Local Development

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd api-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000` with API documentation available at `http://localhost:3000/api-docs`.

### Docker Deployment

1. Build and start with Docker Compose:
   ```bash
   docker-compose up -d
   ```

2. View logs:
   ```bash
   docker-compose logs -f heygem-api
   ```

3. Stop the service:
   ```bash
   docker-compose down
   ```

## Configuration

Environment variables can be set in `.env` file or passed directly:

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3000` | Server port |
| `LOG_LEVEL` | `info` | Logging level |
| `DB_PATH` | `./data/heygem.db` | SQLite database path |
| `PROCESSING_INTERVAL` | `2000` | Background processing interval (ms) |
| `MAX_RETRIES` | `3` | Max task retry attempts |
| `QUEUE_POLLING_INTERVAL` | `5000` | Queue polling interval (ms) |

## API Endpoints

### Models
- `GET /api/v1/models` - List all models
- `GET /api/v1/models/:id` - Get model by ID
- `POST /api/v1/models` - Create new model
- `PUT /api/v1/models/:id` - Update model
- `DELETE /api/v1/models/:id` - Delete model

### Videos
- `GET /api/v1/videos` - List videos
- `GET /api/v1/videos/:id` - Get video by ID
- `POST /api/v1/videos` - Create new video
- `PUT /api/v1/videos/:id` - Update video
- `DELETE /api/v1/videos/:id` - Delete video
- `POST /api/v1/videos/:id/synthesize` - Start video synthesis

### Voices
- `GET /api/v1/voices` - List voices
- `GET /api/v1/voices/:id` - Get voice by ID
- `POST /api/v1/voices` - Create new voice
- `PUT /api/v1/voices/:id` - Update voice
- `DELETE /api/v1/voices/:id` - Delete voice
- `POST /api/v1/voices/:id/generate` - Generate TTS audio
- `POST /api/v1/voices/:id/train` - Train voice model

### Files
- `POST /api/v1/files/upload` - Upload file
- `POST /api/v1/files/upload-base64` - Upload from base64
- `GET /api/v1/files/download/:filename` - Download file
- `GET /api/v1/files/info/:filename` - Get file info
- `DELETE /api/v1/files/:filename` - Delete file
- `POST /api/v1/files/cleanup-temp` - Cleanup temp files

### Tasks
- `GET /api/v1/tasks` - List tasks
- `GET /api/v1/tasks/:id` - Get task by ID
- `POST /api/v1/tasks/:id/cancel` - Cancel task
- `POST /api/v1/tasks/:id/retry` - Retry task
- `GET /api/v1/tasks/queue/status` - Get queue status

## Services Integration

### Face2Face API
Configure the Face2Face service URL in the config:
```javascript
serviceUrl: {
  face2face: 'http://your-f2f-service:8383/easy'
}
```

### TTS API
Configure the TTS service URL in the config:
```javascript
serviceUrl: {
  tts: 'http://your-tts-service:18180'
}
```

## Development

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests

### Logging
The application uses Winston for structured logging:
- Console output in development
- File rotation in production
- JSON format for structured logs

### Error Handling
- Custom AppError class for application errors
- Global error handler middleware
- Async wrapper for route handlers

## Migration from Electron

This API server preserves the core business logic from the original Electron application:

1. **Database Schema**: Identical SQLite schema and data access patterns
2. **External APIs**: Same Face2Face and TTS API integration
3. **File Processing**: Preserved FFmpeg operations and file handling
4. **Business Logic**: Video generation, voice synthesis, and task management workflows

### Key Changes
- Replaced Electron IPC with HTTP REST API
- Converted renderer process calls to API endpoints  
- Added background processing for long-running tasks
- Implemented file upload/download via HTTP
- Added comprehensive API documentation

## Production Considerations

1. **Security**: Add authentication/authorization middleware
2. **Performance**: Implement caching and request optimization
3. **Monitoring**: Add health checks and metrics collection
4. **Scaling**: Consider horizontal scaling for high load
5. **Storage**: Use external storage (S3, etc.) for production files

## License

[Your License Here]
