const express = require('express');
const cors = require('cors');
const axios = require('axios');
const msgpack = require('msgpack-lite');
const https = require('https');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Configuration with timeouts
const MSF_CONFIG = {
  host: process.env.MSF_HOST || '127.0.0.1',
  port: process.env.MSF_PORT || 55553,
  uri: process.env.MSF_URI || '/api/1.0/',
  ssl: process.env.MSF_SSL !== 'false',
  user: process.env.MSF_USER || 'msf',
  pass: process.env.MSF_PASS || 'msf',
  timeout: 30000, // 30 second timeout for requests
};

// Keep a reference to the token for reuse
let tokenCache = {
  token: null,
  expiry: null,
  permanentToken: null
};

// Create custom axios agent with keep-alive
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  rejectUnauthorized: false // Match Java's behavior of ignoring SSL errors
});

// Configure axios with timeouts and keep-alive
const msfClient = axios.create({
  baseURL: `${MSF_CONFIG.ssl ? 'https' : 'http'}://${MSF_CONFIG.host}:${MSF_CONFIG.port}${MSF_CONFIG.uri}`,
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true // Good practice to keep this
  }),
  headers: {
    'Content-Type': 'binary/message-pack',
    'User-Agent': 'Metasploit RPC Proxy/1.0'
  },
  responseType: 'arraybuffer',
  validateStatus: function (status) {
    return status >= 200 && status < 500;
  },
  timeout: 120000 // Increase timeout to 120 seconds (120000 ms) FOR TESTING ONLY
});


// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Login and generate permanent token on startup
async function initializeToken() {
  try {
    console.log('Initializing MSF connection...');
    
    // First get temp token
    const loginAuth = await makeRpcCall('auth.login', [MSF_CONFIG.user, MSF_CONFIG.pass]);
    if (!loginAuth || !loginAuth.token) {
      throw new Error('Initial login failed');
    }
    
    // Then generate permanent token like Java does
    const permToken = await makeRpcCall('auth.token_generate', [loginAuth.token]);
    if (!permToken || !permToken.token) {
      throw new Error('Permanent token generation failed');
    }
    
    tokenCache.permanentToken = permToken.token;
    console.log('Successfully initialized MSF connection with permanent token');
    
    // Schedule token refresh before expiration (every 4 hours)
    setInterval(async () => {
      try {
        const newToken = await makeRpcCall('auth.token_generate', [tokenCache.permanentToken]);
        tokenCache.permanentToken = newToken.token;
        console.log('Refreshed permanent token');
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
      }
    }, 4 * 60 * 60 * 1000);
    
  } catch (initError) {
    console.error('Failed to initialize MSF connection:', initError);
  }
}

// Helper function for RPC calls
async function makeRpcCall(method, params = [], token = null) {
  try {
    let args = [method];
    if (method !== 'auth.login' && token) {
      args.push(token);
    }
    args = args.concat(params);
    
    const encoded = msgpack.encode(args);
    const response = await msfClient.post('', encoded);
    
    const decoded = msgpack.decode(new Uint8Array(response.data));
    return decoded;
  } catch (error) {
    console.error('RPC call failed:', { method, error });
    throw error;
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    msf_connection: `${MSF_CONFIG.host}:${MSF_CONFIG.port}`,
    timestamp: new Date().toISOString(),
    token_active: !!tokenCache.permanentToken
  });
});

// Login endpoint - now uses cached token
app.post('/api/login', async (req, res) => {
  try {
    if (!tokenCache.permanentToken) {
      await initializeToken();
    }
    
    res.json({ 
      success: true, 
      token: tokenCache.permanentToken,
      expires_in: 0, // Indicates permanent token
      token_type: 'permanent'
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Login failed',
      details: error.message
    });
  }
});

// RPC proxy endpoint
app.post('/api/rpc', async (req, res) => {
  try {
    const { method, params = [] } = req.body;
    
    if (!method) {
      return res.status(400).json({ error: 'Method name is required' });
    }
    
    if (!tokenCache.permanentToken) {
      await initializeToken();
    }
    
    const result = await makeRpcCall(method, params, tokenCache.permanentToken);
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      error: 'RPC call failed',
      details: error.message
    });
  }
});

// Start server and initialize connection
app.listen(PORT, async () => {
  console.log(`Metasploit RPC Proxy running on port ${PORT}`);
  console.log(`Connecting to: ${MSF_CONFIG.ssl ? 'https' : 'http'}://${MSF_CONFIG.host}:${MSF_CONFIG.port}${MSF_CONFIG.uri}`);
  
  // Initialize token on startup
  await initializeToken();
});

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}
