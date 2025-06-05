# Migration Guide: Electron Desktop App to HTTP API Server

This guide helps you migrate from the HeyGem Electron desktop application to the new HTTP API server.

## Overview

The refactoring preserves all core functionality while transforming the desktop application into a web-based API service. This enables:

- **Remote Access**: Access HeyGem from any device via HTTP API
- **Scalability**: Deploy on servers for better performance and concurrent users
- **Integration**: Easily integrate with other applications and services
- **Containerization**: Deploy using Docker for consistent environments

## Architecture Changes

### Before (Electron Desktop App)
```
┌─────────────────────────────────────┐
│           Electron Main             │
│  ┌─────────────┐ ┌─────────────────┐│
│  │   Renderer  │ │  Main Process   ││
│  │   (Vue.js)  │ │   (Node.js)     ││
│  │             │ │                 ││
│  │ - UI Logic  │ │ - Business Logic││
│  │ - User      │ │ - File System   ││
│  │   Input     │ │ - External APIs ││
│  │             │ │ - Database      ││
│  └─────────────┘ └─────────────────┘│
└─────────────────────────────────────┘
```

### After (API Server + Client)
```
┌─────────────────┐    HTTP/REST    ┌─────────────────────────────────┐
│   Web Client    │◄──────────────►│        API Server               │
│   (Frontend)    │                 │                                 │
│                 │                 │ ┌─────────────────────────────┐ │
│ - UI Interface  │                 │ │     Express.js App          │ │
│ - User Input    │                 │ │                             │ │
│ - API Calls     │                 │ │ - REST API Endpoints        │ │
│                 │                 │ │ - Business Logic Services   │ │
└─────────────────┘                 │ │ - Background Processing     │ │
                                    │ │ - File Storage              │ │
                                    │ │ - Database Access           │ │
                                    │ │ - External API Integration  │ │
                                    │ └─────────────────────────────┘ │
                                    └─────────────────────────────────┘
```

## Functional Mapping

### Original Desktop App Functions → API Endpoints

| Desktop Function | API Endpoint | Method | Description |
|------------------|--------------|--------|-------------|
| Model Management | `/api/v1/models` | GET/POST/PUT/DELETE | CRUD operations for F2F models |
| Video Creation | `/api/v1/videos` | POST | Create new video project |
| Video Synthesis | `/api/v1/videos/:id/synthesize` | POST | Start video generation |
| Voice Management | `/api/v1/voices` | GET/POST/PUT/DELETE | Manage voice models |
| TTS Generation | `/api/v1/voices/:id/generate` | POST | Generate audio from text |
| Voice Training | `/api/v1/voices/:id/train` | POST | Train custom voice model |
| File Upload | `/api/v1/files/upload` | POST | Upload media files |
| Task Monitoring | `/api/v1/tasks` | GET | Monitor background tasks |

### Data Preservation

All existing data structures are preserved:

1. **Database Schema**: Identical SQLite tables and relationships
2. **File Storage**: Same directory structure and file naming
3. **Configuration**: Similar settings with environment variables
4. **Business Logic**: Identical processing workflows

## Migration Steps

### 1. Data Migration

Your existing Electron app data can be migrated directly:

```bash
# Copy SQLite database
cp /path/to/electron/app/data/heygem.db /path/to/api-server/data/

# Copy uploaded files
cp -r /path/to/electron/app/uploads/* /path/to/api-server/uploads/

# Copy model files
cp -r /path/to/electron/app/heygem_data/* /Users/$(whoami)/heygem_data/
```

### 2. Configuration Migration

Map Electron configuration to environment variables:

| Electron Config | Environment Variable | Example |
|----------------|---------------------|---------|
| Service URLs | `F2F_SERVICE_URL`, `TTS_SERVICE_URL` | `http://192.168.4.204:8383/easy` |
| File Paths | Auto-configured based on OS | Linux: `~/heygem_data/` |
| Database Path | `DB_PATH` | `./data/heygem.db` |

### 3. API Server Setup

1. **Install and Start**:
   ```bash
   cd api-server
   npm install
   npm run setup  # Interactive setup
   ```

2. **Configuration**:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Start Server**:
   ```bash
   npm run dev     # Development mode
   npm start       # Production mode
   ```

### 4. Client Integration

Replace Electron IPC calls with HTTP requests:

#### Before (Electron IPC):
```javascript
// In renderer process
const result = await window.electronAPI.invoke('create-video', videoData)
```

#### After (HTTP API):
```javascript
// In web client
const response = await fetch('/api/v1/videos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(videoData)
})
const result = await response.json()
```

## API Usage Examples

### 1. Create a Video Project

```javascript
const videoData = {
  name: "My Video",
  model_id: 1,
  voice_id: 1,
  script: "Hello, this is a test video",
  background: "default"
}

const response = await fetch('/api/v1/videos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(videoData)
})
```

### 2. Start Video Synthesis

```javascript
const videoId = 123
const response = await fetch(`/api/v1/videos/${videoId}/synthesize`, {
  method: 'POST'
})
```

### 3. Monitor Task Progress

```javascript
const response = await fetch('/api/v1/tasks')
const tasks = await response.json()

// Check specific task
const taskResponse = await fetch(`/api/v1/tasks/${taskId}`)
const task = await taskResponse.json()
console.log(`Task status: ${task.status}`)
```

### 4. Upload Files

```javascript
const formData = new FormData()
formData.append('file', fileInput.files[0])

const response = await fetch('/api/v1/files/upload', {
  method: 'POST',
  body: formData
})
```

## Key Differences

### 1. Asynchronous Processing

- **Electron**: Synchronous or callback-based operations
- **API Server**: Promise-based with background task queue

### 2. File Handling

- **Electron**: Direct file system access
- **API Server**: HTTP upload/download with temporary storage

### 3. Real-time Updates

- **Electron**: IPC events for real-time updates
- **API Server**: Polling or WebSocket connections (implement as needed)

### 4. Authentication

- **Electron**: No authentication needed (local app)
- **API Server**: Add authentication middleware for production use

## Deployment Options

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Docker
```bash
docker-compose up -d
```

### Cloud Deployment
Deploy to any cloud provider supporting Node.js:
- AWS (EC2, ECS, Lambda)
- Google Cloud (Compute Engine, Cloud Run)
- Azure (App Service, Container Instances)
- DigitalOcean (Droplets, App Platform)

## Benefits of Migration

1. **Accessibility**: Access from any device with network connectivity
2. **Scalability**: Handle multiple concurrent users
3. **Maintenance**: Centralized updates and configuration
4. **Integration**: Easy integration with other systems
5. **Deployment**: Standardized deployment with containers
6. **Monitoring**: Better logging and monitoring capabilities

## Backward Compatibility

The API server maintains full backward compatibility with existing data:

- ✅ Database schema unchanged
- ✅ File formats preserved
- ✅ Business logic identical
- ✅ External API integration unchanged
- ✅ Configuration mapping provided

## Support and Troubleshooting

### Common Issues

1. **Port Conflicts**: Change `PORT` environment variable
2. **Database Access**: Ensure SQLite file permissions are correct
3. **File Uploads**: Check directory permissions for uploads/temp
4. **External Services**: Verify F2F and TTS service URLs are accessible

### Getting Help

1. Check server logs: `docker-compose logs -f heygem-api`
2. API documentation: `http://localhost:3000/api-docs`
3. Health check: `http://localhost:3000/health`
4. Test endpoints: `npm run test:api`

This migration preserves all your existing functionality while providing a modern, scalable API-based architecture.
