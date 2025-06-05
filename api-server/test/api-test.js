/**
 * Basic API Tests
 * Simple tests to verify API endpoints are working
 */

import axios from 'axios'

const API_BASE = 'http://localhost:3000'

/**
 * Test API health endpoint
 */
async function testHealth() {
  try {
    console.log('Testing health endpoint...')
    const response = await axios.get(`${API_BASE}/health`)
    console.log('✅ Health check passed:', response.data)
    return true
  } catch (error) {
    console.error('❌ Health check failed:', error.message)
    return false
  }
}

/**
 * Test models endpoint
 */
async function testModels() {
  try {
    console.log('Testing models endpoint...')
    const response = await axios.get(`${API_BASE}/api/v1/models`)
    console.log('✅ Models endpoint passed:', response.status)
    return true
  } catch (error) {
    console.error('❌ Models endpoint failed:', error.message)
    return false
  }
}

/**
 * Test videos endpoint
 */
async function testVideos() {
  try {
    console.log('Testing videos endpoint...')
    const response = await axios.get(`${API_BASE}/api/v1/videos`)
    console.log('✅ Videos endpoint passed:', response.status)
    return true
  } catch (error) {
    console.error('❌ Videos endpoint failed:', error.message)
    return false
  }
}

/**
 * Test voices endpoint
 */
async function testVoices() {
  try {
    console.log('Testing voices endpoint...')
    const response = await axios.get(`${API_BASE}/api/v1/voices`)
    console.log('✅ Voices endpoint passed:', response.status)
    return true
  } catch (error) {
    console.error('❌ Voices endpoint failed:', error.message)
    return false
  }
}

/**
 * Test tasks endpoint
 */
async function testTasks() {
  try {
    console.log('Testing tasks endpoint...')
    const response = await axios.get(`${API_BASE}/api/v1/tasks`)
    console.log('✅ Tasks endpoint passed:', response.status)
    return true
  } catch (error) {
    console.error('❌ Tasks endpoint failed:', error.message)
    return false
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🚀 Starting API tests...\n')
  
  const tests = [
    testHealth,
    testModels,
    testVideos,
    testVoices,
    testTasks
  ]
  
  let passed = 0
  
  for (const test of tests) {
    const result = await test()
    if (result) passed++
    console.log('')
  }
  
  console.log(`\n📊 Test Results: ${passed}/${tests.length} tests passed`)
  
  if (passed === tests.length) {
    console.log('🎉 All tests passed!')
    process.exit(0)
  } else {
    console.log('💥 Some tests failed!')
    process.exit(1)
  }
}

// Wait for server to be ready before running tests
setTimeout(runTests, 2000)
