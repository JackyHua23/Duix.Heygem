#!/usr/bin/env node

/**
 * HeyGem API Server Startup Script
 * Provides interactive startup and validation
 */

import { execSync, spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warning: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m'
  }
  console.log(`${colors[type]}${message}${colors.reset}`)
}

function checkNodeVersion() {
  const version = process.version
  const major = parseInt(version.slice(1).split('.')[0])
  
  if (major < 16) {
    log(`❌ Node.js ${version} is not supported. Please upgrade to Node.js 16+`, 'error')
    return false
  }
  
  log(`✅ Node.js ${version} is supported`, 'success')
  return true
}

function checkDependencies() {
  try {
    if (!fs.existsSync('node_modules')) {
      log('📦 Installing dependencies...', 'info')
      execSync('npm install', { stdio: 'inherit' })
    }
    log('✅ Dependencies are installed', 'success')
    return true
  } catch (error) {
    log('❌ Failed to install dependencies', 'error')
    console.error(error.message)
    return false
  }
}

function checkEnvironment() {
  if (!fs.existsSync('.env')) {
    log('⚠️  No .env file found. Using default configuration.', 'warning')
    log('💡 Copy .env.example to .env to customize settings', 'info')
  } else {
    log('✅ Environment file found', 'success')
  }
  return true
}

function createDirectories() {
  const dirs = ['data', 'uploads', 'temp', 'logs']
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      log(`📁 Created directory: ${dir}`, 'info')
    }
  }
  
  log('✅ Required directories exist', 'success')
  return true
}

async function startServer(mode = 'development') {
  log(`🚀 Starting HeyGem API Server in ${mode} mode...`, 'info')
  
  const command = mode === 'development' ? 'npm run dev' : 'npm start'
  
  try {
    const child = spawn('npm', mode === 'development' ? ['run', 'dev'] : ['start'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: mode }
    })
    
    child.on('error', (error) => {
      log(`❌ Failed to start server: ${error.message}`, 'error')
    })
    
    child.on('exit', (code) => {
      if (code !== 0) {
        log(`❌ Server exited with code ${code}`, 'error')
      }
    })
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      log('\n🛑 Shutting down server...', 'info')
      child.kill('SIGINT')
      process.exit(0)
    })
    
  } catch (error) {
    log(`❌ Failed to start server: ${error.message}`, 'error')
    return false
  }
}

async function main() {
  console.log('🎯 HeyGem API Server Setup\n')
  
  // Pre-flight checks
  if (!checkNodeVersion()) {
    process.exit(1)
  }
  
  if (!checkDependencies()) {
    process.exit(1)
  }
  
  if (!checkEnvironment()) {
    process.exit(1)
  }
  
  if (!createDirectories()) {
    process.exit(1)
  }
  
  log('\n✅ Pre-flight checks completed successfully!\n', 'success')
  
  // Ask user for startup mode
  const mode = await question('Select startup mode:\n1. Development (with auto-reload)\n2. Production\nChoice (1-2): ')
  
  const isDevelopment = mode === '1' || mode.toLowerCase() === 'development'
  const selectedMode = isDevelopment ? 'development' : 'production'
  
  log(`\n🔧 Configuration:`, 'info')
  log(`   Mode: ${selectedMode}`, 'info')
  log(`   Port: ${process.env.PORT || 3000}`, 'info')
  log(`   API Docs: http://localhost:${process.env.PORT || 3000}/api-docs`, 'info')
  log(`   Health Check: http://localhost:${process.env.PORT || 3000}/health\n`, 'info')
  
  const confirm = await question('Start the server? (y/N): ')
  
  if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
    rl.close()
    await startServer(selectedMode)
  } else {
    log('👋 Startup cancelled', 'info')
    rl.close()
    process.exit(0)
  }
}

main().catch((error) => {
  log(`❌ Startup failed: ${error.message}`, 'error')
  process.exit(1)
})
