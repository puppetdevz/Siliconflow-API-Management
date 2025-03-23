// server.js
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')
const basicAuth = require('express-basic-auth')

// Initialize redis or another storage solution
const { createClient } = require('redis')
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
})

// Connect to Redis
;(async () => {
  redisClient.on('error', err => console.error('Redis Client Error', err))
  await redisClient.connect()
  console.log('Connected to Redis')
})()

// Configuration (can be overridden via admin interface)
const CONFIG = {
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'default-admin-username',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'default-admin-password',
  API_KEY: process.env.API_KEY || 'default-api-key',
  PAGE_SIZE: parseInt(process.env.PAGE_SIZE || '12'),
  ACCESS_CONTROL: process.env.ACCESS_CONTROL || 'open', // access control mode: "open", "restricted", "private"
  GUEST_PASSWORD: process.env.GUEST_PASSWORD || 'guest_password',
}

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(bodyParser.json())
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400, // 24 hours cache for preflight requests
  })
)

// Serve static files for main interface
app.use(express.static(path.join(__dirname, 'public')))

// Redis utility functions (replacing KV functions)
async function getKeyFromRedis(key) {
  return await redisClient.get(key)
}

async function setKeyInRedis(key, value) {
  await redisClient.set(key, value)
}

async function getJsonFromRedis(key) {
  const value = await redisClient.get(key)
  return value ? JSON.parse(value) : null
}

// Get all configuration
async function getConfiguration() {
  return {
    apiKey: (await getKeyFromRedis('api_key')) || CONFIG.API_KEY,
    adminUsername: (await getKeyFromRedis('admin_username')) || CONFIG.ADMIN_USERNAME,
    adminPassword: (await getKeyFromRedis('admin_password')) || CONFIG.ADMIN_PASSWORD,
    pageSize: parseInt((await getKeyFromRedis('page_size')) || CONFIG.PAGE_SIZE),
    accessControl: (await getKeyFromRedis('access_control')) || CONFIG.ACCESS_CONTROL,
    guestPassword: (await getKeyFromRedis('guest_password')) || CONFIG.GUEST_PASSWORD,
  }
}

// Update configuration
async function updateConfiguration(config) {
  if (config.apiKey) await setKeyInRedis('api_key', config.apiKey)
  if (config.adminUsername) await setKeyInRedis('admin_username', config.adminUsername)
  if (config.adminPassword) await setKeyInRedis('admin_password', config.adminPassword)
  if (config.pageSize) await setKeyInRedis('page_size', config.pageSize.toString())
  if (config.accessControl) await setKeyInRedis('access_control', config.accessControl)
  if (config.guestPassword !== undefined) await setKeyInRedis('guest_password', config.guestPassword)
}

// Get all keys
async function getAllKeys() {
  try {
    const keysJson = await getJsonFromRedis('keys')
    return keysJson || []
  } catch (error) {
    console.error('Error getting keys:', error)
    return []
  }
}

// Add a key
async function addKey(key, balance = 0) {
  const keys = await getAllKeys()
  const existingKeyIndex = keys.findIndex(k => k.key === key)

  if (existingKeyIndex !== -1) {
    keys[existingKeyIndex].balance = balance
  } else {
    keys.push({ key, balance, added: new Date().toISOString() })
  }

  await setKeyInRedis('keys', JSON.stringify(keys))
}

// Delete a key
async function deleteKey(key) {
  const keys = await getAllKeys()
  const updatedKeys = keys.filter(k => k.key !== key)
  await setKeyInRedis('keys', JSON.stringify(updatedKeys))
}

// Update key's last check time
async function updateKeyLastCheckTime(key, lastUpdated) {
  try {
    const keys = await getAllKeys()
    const keyIndex = keys.findIndex(k => k.key === key)

    if (keyIndex !== -1) {
      keys[keyIndex].lastUpdated = lastUpdated
      await setKeyInRedis('keys', JSON.stringify(keys))
      return true
    }
    return false
  } catch (error) {
    console.error(`Failed to update key ${key} time:`, error)
    return false
  }
}

// Check key validity and balance
async function checkKeyValidity(key) {
  try {
    // 1. Validate key
    const validationResponse = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen2.5-7B-Instruct',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 100,
        stream: false,
      }),
    })

    if (!validationResponse.ok) {
      const errorData = await validationResponse.json().catch(() => null)
      const errorMessage =
        errorData && errorData.error && errorData.error.message ? errorData.error.message : 'Key validation failed'

      return {
        isValid: false,
        balance: 0,
        message: errorMessage,
      }
    }

    // 2. Check balance
    const balanceResponse = await fetch('https://api.siliconflow.cn/v1/user/info', {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
    })

    if (!balanceResponse.ok) {
      const errorData = await balanceResponse.json().catch(() => null)
      const errorMessage =
        errorData && errorData.error && errorData.error.message ? errorData.error.message : 'Balance query failed'

      return {
        isValid: false,
        balance: 0,
        message: errorMessage,
      }
    }

    const data = await balanceResponse.json()
    const balance = (data.data && data.data.totalBalance) || 0

    return {
      isValid: true,
      balance: balance,
      message: 'Validation successful',
    }
  } catch (error) {
    console.error('Error checking key:', error)
    return {
      isValid: false,
      balance: 0,
      message: `Network error: ${error.message || 'Unknown error'}`,
    }
  }
}

// Update all key balances
async function updateAllKeyBalances() {
  try {
    const keys = await getAllKeys()
    const updatedKeys = [...keys]
    const now = new Date().toISOString()
    const results = {
      success: true,
      updated: 0,
      failed: 0,
      details: [],
    }

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i].key
      try {
        const result = await checkKeyValidity(key)

        if (result.isValid) {
          updatedKeys[i].balance = result.balance
          updatedKeys[i].lastUpdated = now
          updatedKeys[i].lastError = null
          results.updated++
        } else {
          updatedKeys[i].balance = 0
          updatedKeys[i].lastUpdated = now
          updatedKeys[i].lastError = result.message
          results.failed++
        }

        results.details.push({
          key: key,
          success: result.isValid,
          balance: result.balance,
          message: result.message,
        })
      } catch (error) {
        updatedKeys[i].lastError = error.message || 'Unknown error'
        updatedKeys[i].lastUpdated = now
        results.failed++
        results.details.push({
          key: key,
          success: false,
          message: error.message || 'Unknown error',
        })
      }
    }

    await setKeyInRedis('keys', JSON.stringify(updatedKeys))
    return results
  } catch (error) {
    console.error('Error updating all key balances:', error)
    return {
      success: false,
      message: error.message || 'Unknown error',
    }
  }
}

// Authentication middleware for guest
async function authenticateGuest(req, res, next) {
  const config = await getConfiguration()

  // If fully open, pass through
  if (config.accessControl === 'open') {
    return next()
  }

  // If private, require admin authentication
  if (config.accessControl === 'private') {
    return authenticateAdmin(req, res, next)
  }

  // Restricted mode, check guest password
  if (config.accessControl === 'restricted') {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        requireAuth: true,
        accessControl: config.accessControl,
      })
    }

    const guestToken = authHeader.replace('Bearer ', '').trim()
    if (guestToken === config.guestPassword) {
      return next()
    }
  }

  // Default deny access
  return res.status(401).json({
    success: false,
    message: 'Authentication required',
    requireAuth: true,
    accessControl: config.accessControl,
  })
}

// Admin basic auth middleware factory
async function getAdminAuthMiddleware() {
  const config = await getConfiguration()

  const users = {}
  users[config.adminUsername] = config.adminPassword

  return basicAuth({
    users: users,
    challenge: true,
    realm: 'Admin Interface',
  })
}

// Routes

// Admin interface
app.get('/admin', async (req, res) => {
  const adminAuth = await getAdminAuthMiddleware()
  adminAuth(req, res, () => {
    res.sendFile(path.join(__dirname, 'admin.html'))
  })
})

// Admin API routes
app.get('/admin/api/pageSize', async (req, res) => {
  const pageSize = parseInt((await getKeyFromRedis('page_size')) || CONFIG.PAGE_SIZE)
  res.json({ success: true, data: pageSize })
})

app.get('/admin/api/keys', async (req, res) => {
  try {
    // Need either admin or guest authentication
    const config = await getConfiguration()

    // Check if admin auth is provided
    const authHeader = req.headers.authorization

    if (authHeader && authHeader.startsWith('Basic ')) {
      // Admin basic auth handling
      const adminAuth = await getAdminAuthMiddleware()
      return adminAuth(req, res, async () => {
        const keys = await getAllKeys()
        res.json({ success: true, data: keys })
      })
    } else if (await authenticateGuest(req, res, () => {})) {
      // Guest auth handling
      const keys = await getAllKeys()
      return res.json({ success: true, data: keys })
    }

    // If we get here and neither auth passed
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      requireAuth: true,
      accessControl: config.accessControl,
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

app.get('/admin/api/access-control', async (req, res) => {
  const config = await getConfiguration()
  res.json({
    success: true,
    data: {
      accessControl: config.accessControl,
    },
  })
})

app.post('/admin/api/verify-guest', async (req, res) => {
  try {
    const data = req.body
    const config = await getConfiguration()

    if (config.accessControl !== 'restricted') {
      return res.json({
        success: false,
        message: 'Guest authentication not required in current mode',
      })
    }

    if (data.password === config.guestPassword) {
      return res.json({
        success: true,
        token: config.guestPassword,
      })
    } else {
      return res.status(401).json({
        success: false,
        message: 'Incorrect guest password',
      })
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

app.get('/admin/api/config', async (req, res) => {
  try {
    const adminAuth = await getAdminAuthMiddleware()
    adminAuth(req, res, async () => {
      const config = await getConfiguration()
      res.json({ success: true, data: config })
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

app.post('/admin/api/add-key', async (req, res) => {
  try {
    const adminAuth = await getAdminAuthMiddleware()
    adminAuth(req, res, async () => {
      const data = req.body
      if (!data.key) {
        return res.status(400).json({ success: false, message: 'Key is required' })
      }
      await addKey(data.key, data.balance || 0)
      res.json({ success: true })
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

app.post('/admin/api/add-keys-bulk', async (req, res) => {
  try {
    const adminAuth = await getAdminAuthMiddleware()
    adminAuth(req, res, async () => {
      const data = req.body
      if (!data.keys) {
        return res.status(400).json({ success: false, message: 'Keys are required' })
      }

      const keys = data.keys
        .split('\n')
        .map(k => k.trim())
        .filter(k => k)

      for (const key of keys) {
        await addKey(key, 0)
      }

      res.json({ success: true, count: keys.length })
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

app.post('/admin/api/delete-key', async (req, res) => {
  try {
    const adminAuth = await getAdminAuthMiddleware()
    adminAuth(req, res, async () => {
      const data = req.body
      if (!data.key) {
        return res.status(400).json({ success: false, message: 'Key is required' })
      }
      await deleteKey(data.key)
      res.json({ success: true })
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

app.delete('/admin/api/keys/:key', async (req, res) => {
  try {
    const adminAuth = await getAdminAuthMiddleware()
    adminAuth(req, res, async () => {
      const key = req.params.key
      await deleteKey(key)
      res.json({ success: true })
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

app.post('/admin/api/update-config', async (req, res) => {
  try {
    const adminAuth = await getAdminAuthMiddleware()
    adminAuth(req, res, async () => {
      const data = req.body
      await updateConfiguration(data)
      res.json({ success: true })
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

app.post('/admin/api/update-balances', async (req, res) => {
  try {
    const adminAuth = await getAdminAuthMiddleware()
    adminAuth(req, res, async () => {
      const data = req.body

      // Test mode support
      if (data.test === true) {
        return res.json({
          success: true,
          message: 'Connectivity test successful',
          testTime: new Date().toISOString(),
        })
      }

      // Actual update operation
      const result = await updateAllKeyBalances()
      res.json(result)
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Update failed: ${error.message || 'Unknown error'}`,
    })
  }
})

app.post('/admin/api/update-key-balance', async (req, res) => {
  try {
    const adminAuth = await getAdminAuthMiddleware()
    adminAuth(req, res, async () => {
      const data = req.body
      if (!data.key) {
        return res.status(400).json({ success: false, message: 'Key cannot be empty' })
      }

      const keys = await getAllKeys()
      const keyIndex = keys.findIndex(k => k.key === data.key)

      if (keyIndex === -1) {
        return res.status(404).json({ success: false, message: 'Key does not exist' })
      }

      try {
        const result = await checkKeyValidity(data.key)
        const now = new Date().toISOString()

        if (result.isValid) {
          keys[keyIndex].balance = result.balance
          keys[keyIndex].lastUpdated = now
          keys[keyIndex].lastError = null
        } else {
          keys[keyIndex].balance = 0
          keys[keyIndex].lastUpdated = now
          keys[keyIndex].lastError = result.message
        }

        await setKeyInRedis('keys', JSON.stringify(keys))

        res.json({
          success: result.isValid,
          balance: result.balance,
          message: result.message,
          key: data.key,
          isValid: result.isValid,
          lastUpdated: now,
        })
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Failed to check balance: ' + error.message,
        })
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// API proxy routes
app.all('/v1/*', async (req, res) => {
  try {
    // Validate API request
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return res.status(401).json({
        error: { message: 'Authentication required' },
      })
    }

    // Extract token from Authorization header
    const providedToken = authHeader.replace('Bearer ', '').trim()

    // Get API key from Redis or use default
    const apiKey = (await getKeyFromRedis('api_key')) || CONFIG.API_KEY

    if (providedToken !== apiKey) {
      return res.status(401).json({
        error: { message: 'Invalid API key' },
      })
    }

    // Get all valid keys for load balancing
    const allKeys = await getAllKeys()
    const validKeys = allKeys.filter(k => k.balance > 0)

    if (validKeys.length === 0) {
      return res.status(503).json({
        error: { message: 'No available API keys' },
      })
    }

    // Load balancing - randomly select a key
    const randomIndex = Math.floor(Math.random() * validKeys.length)
    const selectedKey = validKeys[randomIndex].key

    // Get the original path
    const path = req.originalUrl

    // Clone request and modify headers
    const headers = { ...req.headers }
    headers['authorization'] = `Bearer ${selectedKey}`

    // Delete host header to avoid conflicts
    delete headers.host

    // Create request options
    const requestOptions = {
      method: req.method,
      headers: headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
      redirect: 'follow',
    }

    // Forward the request
    const response = await fetch(`https://api.siliconflow.cn${path}`, requestOptions)

    // Get the response data
    const data = await response.buffer()

    // Set response headers
    Object.entries(response.headers.raw()).forEach(([key, value]) => {
      res.set(key, value)
    })

    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*')
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
    res.set('Access-Control-Allow-Credentials', 'true')
    res.set('Access-Control-Max-Age', '86400')

    // Set cache control headers
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')

    // Send response
    res.status(response.status).send(data)
  } catch (error) {
    console.error('Error in API proxy:', error)
    res.status(500).json({
      error: { message: 'Server error: ' + (error.message || 'Unknown error') },
    })
  }
})

// Main route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
