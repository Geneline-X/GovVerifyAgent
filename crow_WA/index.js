const express = require('express');
const bodyParser = require('body-parser');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { Server } = require('socket.io');
const cors = require('cors');
const http = require('http');
const path = require('path');
require('dotenv').config();
const axios = require('axios');

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await gracefulShutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await gracefulShutdown();
  process.exit(0);
});

async function gracefulShutdown() {
  console.log('Starting graceful shutdown...');
  
  for (const [chatbotId] of sessionHealthChecks) {
    stopHealthMonitoring(chatbotId);
  }
  
  console.log('Shutdown complete');
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NEXT_PUBLIC_ABSOLUTE_URL || 'http://localhost:3001' || "https://rag-x.dev/",
    methods: ['GET', 'POST'],
    credentials: true,
  },
  path: '/socket.io',
});

app.use(cors({
  origin: process.env.NEXT_PUBLIC_ABSOLUTE_URL || 'http://localhost:3001' || "https://rag-x.dev/",
  methods: ['GET', 'POST'],
  credentials: true,
}));
app.use(bodyParser.json(
  {
    limit: '10mb'
  }
));
app.use(express.static('public'));

// API Key middleware for authentication
const requireApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const expectedApiKey = process.env.API_KEY;
  
  if (!expectedApiKey) {
    console.error('⚠️ API_KEY not configured in environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }
  
  if (!apiKey || apiKey !== expectedApiKey) {
    console.warn(`🔒 ${process.env.BRAND_NAME || 'Server'}: Unauthorized API access attempt from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
  }
  
  next();
};

const qrCodes = new Map();
const clients = new Map();
const messagesLog = [];
const MAX_LOG = 200;

// Session monitoring
const sessionHealthChecks = new Map();
const HEALTH_CHECK_INTERVAL = 30000; // 30 secondsAdd
const SESSION_TIMEOUT = 300000; // 5 minutes without activity before considering unhealthy

// Message queue helper functions
async function sendMessageDirectly(client, phoneE164, message) {
  try {
    // Validate number is on WhatsApp and get proper JID
    const number = phoneE164.replace('+', '');
    const wid = await client.getNumberId(number);
    if (!wid || !wid._serialized) {
      throw new Error(`Number ${phoneE164} is not on WhatsApp`);
    }

    // Small delay before sending
    await new Promise(resolve => setTimeout(resolve, 300));
    await client.sendMessage(wid._serialized, message);
    
    return { success: true, jid: wid._serialized };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Check network connectivity to web.whatsapp.com
async function checkNetwork() {
  if (String(process.env.SKIP_NETWORK_CHECK).toLowerCase() === 'true') {
    console.warn('Network check skipped due to SKIP_NETWORK_CHECK=true');
    return true;
  }
  return new Promise((resolve) => {
    const req = require('https').get('https://web.whatsapp.com', { timeout: 15000 }, (res) => {
      if (res.statusCode === 200) {
        console.log('Network check passed: web.whatsapp.com is reachable');
        resolve(true);
      } else {
        console.error(`Network check failed: HTTP ${res.statusCode}`);
        resolve(false);
      }
    });
    req.on('timeout', () => {
      console.error('Network check timed out');
      req.destroy();
      resolve(false);
    });
    req.on('error', (error) => {
      console.error('Network check error:', error.message);
      resolve(false);
    });
  });
}

// Health monitoring functions
function startHealthMonitoring(chatbotId, client) {
  if (sessionHealthChecks.has(chatbotId)) {
    clearInterval(sessionHealthChecks.get(chatbotId));
  }
  
  const healthCheck = setInterval(async () => {
    try {
      const state = await client.getState().catch(() => null);
      const isHealthy = state && !['UNPAIRED', 'UNPAIRED_IDLE', 'CONFLICT', 'UNLAUNCHED'].includes(state);
      
      if (!isHealthy) {
        console.warn(`Health check failed for ${chatbotId}. State: ${state}`);
        // Don't immediately reconnect, just log the issue
        // The disconnected event will handle reconnection
      } else {
        console.log(`Health check passed for ${chatbotId}. State: ${state}`);
        
        // Send periodic keep-alive to maintain session
        try {
          await client.sendPresenceAvailable();
        } catch (presenceError) {
          console.warn(`Failed to send presence for ${chatbotId}:`, presenceError.message);
        }
      }
    } catch (error) {
      console.error(`Health check error for ${chatbotId}:`, error.message);
    }
  }, HEALTH_CHECK_INTERVAL);
  
  sessionHealthChecks.set(chatbotId, healthCheck);
  console.log(`Started health monitoring for ${chatbotId}`);
}

function stopHealthMonitoring(chatbotId) {
  if (sessionHealthChecks.has(chatbotId)) {
    clearInterval(sessionHealthChecks.get(chatbotId));
    sessionHealthChecks.delete(chatbotId);
    console.log(`Stopped health monitoring for ${chatbotId}`);
  }
}

async function clearSession(chatbotId) {
  try {
    const fs = require('fs');
    const path = require('path');
    const sessionPath = path.join(__dirname, '.wwebjs_auth', `session-${String(chatbotId).replace(/[^A-Za-z0-9_-]/g, '_')}`);
    
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`Cleared local session for ${chatbotId}`);
    }
  } catch (error) {
    console.error(`Error clearing local session for ${chatbotId}:`, error.message);
  }
}

// Initialize WhatsApp client
async function initializeClient(retryCount = 0, maxRetries = 3) {
  const chatbotId = process.env.CLIENT_PHONE_E164;
  if (!chatbotId) {
    throw new Error('CLIENT_PHONE_E164 is not set in .env');
  }

  if (clients.has(chatbotId)) {
    const client = clients.get(chatbotId);
    try {
      const isConnected = client?.info?.wid?.user ? true : false;
      if (isConnected) {
        console.log(`Client already connected for ${chatbotId}: ${client.info.wid.user}`);
        return { status: 'connected', phoneNumber: client.info.wid.user };
      } else if (qrCodes.has(chatbotId)) {
        console.log(`Client awaiting QR scan for ${chatbotId}`);
        return { status: 'awaiting_qr', qr: qrCodes.get(chatbotId)?.base64 };
      }
    } catch (error) {
      console.error(`Error checking client status for ${chatbotId}:`, error.message, error.stack);
      clients.delete(chatbotId);
      if (client) {
        try {
          await client.destroy();
        } catch (destroyError) {
          console.error(`Error destroying stale client for ${chatbotId}:`, destroyError.message);
        }
      }
    }
  }

  const networkOk = await checkNetwork();
  if (!networkOk) {
    throw new Error('Network check failed: Cannot reach web.whatsapp.com');
  }

  // Simple client configuration with LocalAuth
  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });
  
  const sessionStorageType = 'local';
  console.log(`💾 ${process.env.BRAND_NAME || 'Server'}: Using simple LocalAuth configuration`);

  client.on('loading_screen', (percent, message) => {
    console.log(`Loading screen for ${chatbotId}: ${percent}% - ${message}`);
  });
  client.on('change_state', (state) => {
    console.log(`Client state changed for ${chatbotId}:`, state);
  });
  client.on('loading_failed', (event) => {
    console.error(`Loading failed for ${chatbotId}:`, event);
  });
  client.on('browser_close', () => {
    console.error(`Browser closed unexpectedly for ${chatbotId}`);
  });

  client.on('qr', async (qr) => {
    console.log(`📱 ${process.env.BRAND_NAME || 'Server'}: QR code generated for ${chatbotId}`);
    try {
      const base64 = await qrcode.toDataURL(qr, {
        width: 512,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      qrCodes.set(chatbotId, { qr, base64 });
      io.emit(`qr:${chatbotId}`, base64);
      console.log(`📱 ${process.env.BRAND_NAME || 'Server'}: QR code generated successfully`);
    } catch (error) {
      console.error(`❌ ${process.env.BRAND_NAME || 'Server'}: Error generating QR code for ${chatbotId}:`, error.message, error.stack);
    }
  });

  client.on('ready', async () => {
    console.log(`✅ ${process.env.BRAND_NAME || 'Server'}: Client ready for ${chatbotId}`);
    const phoneNumber = client.info?.wid?.user || 'unknown';
    
    startHealthMonitoring(chatbotId, client);
    
    try {
      await fetch(`${process.env.NEXT_PUBLIC_ABSOLUTE_URL}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': process.env.AGENT_API_KEY
        },
        body: JSON.stringify({
          chatbotId,
          event: 'connected',
          phoneNumber,
        }),
      });
      io.emit(`connected:${chatbotId}`, { phoneNumber });
      qrCodes.delete(chatbotId);
    } catch (error) {
      console.error(`Error notifying Next.js for ${chatbotId}:`, error.message, error.stack);
    }
  });

  client.on('authenticated', () => {
    console.log(`🔐 ${process.env.BRAND_NAME || 'Server'}: Session authenticated for ${chatbotId}`);
  });

  client.on('message_create', async (message) => {
    const msgType = message.type || 'undefined';
    console.log(`[message_create] from=${message.from}, to=${message.to}, fromMe=${message.fromMe}, type=${msgType}, body="${message.body}"`);
  });

  // Process incoming personal messages only
  client.on('message', async (message) => {
    try {
      const messageId = message.id?.id || message.id?._serialized || `${message.from}_${message.timestamp}`;
      
      const chat = await message.getChat().catch(() => null);
      const isGroup = chat?.isGroup === true;
      const isPersonal = message.from.endsWith('@c.us');
      const isFromMe = message.fromMe === true;
      const isStatus = message.from === 'status@broadcast';
      const msgType = message.type || 'undefined';
      const isNotification = message.type && (message.type.includes('notification') || message.type === 'e2e_notification');
      const hasBody = message.body && message.body.trim().length > 0;
      
      console.log(`[message] from=${message.from}, isGroup=${isGroup}, isPersonal=${isPersonal}, isFromMe=${isFromMe}, type=${msgType}, hasMedia=${message.hasMedia}, hasLocation=${!!message.location}, body="${message.body}", msgId=${messageId}`);

      // Skip messages with undefined type and no media/body
      if (!message.type && !hasBody && !message.hasMedia) {
        console.log('[message] Ignored (undefined type with no body or media)');
        return;
      }

      // Ignore notifications, self-messages, groups, non-personal messages, and empty messages (but allow media messages)
      if (isFromMe || isGroup || !isPersonal || isStatus || (isNotification && !hasBody && !message.hasMedia)) {
        console.log('[message] Ignored (self/group/non-personal/status/notification/empty)');
        return;
      }

      // Check for and download media if present
      let mediaData = null;
      if (message.hasMedia) {
        try {
          console.log(`[message] Downloading media from ${message.from}, type: ${msgType}`);
          const media = await message.downloadMedia();
          if (media) {
            mediaData = {
              mimetype: media.mimetype,
              filename: media.filename || `media_${Date.now()}`,
              data: media.data, // base64 encoded data
              size: media.data ? Buffer.from(media.data, 'base64').length : 0
            };
            console.log(`[message] Media downloaded: ${mediaData.mimetype}, ${mediaData.filename}, ${mediaData.size} bytes`);
          }
        } catch (mediaError) {
          console.error(`[message] Error downloading media:`, mediaError.message);
          // Continue processing without media data
        }
      }

      // Log incoming
      try {
        messagesLog.push({
          ts: new Date().toISOString(),
          from: message.from,
          to: message.to,
          body: message.body,
          id: message.id?.id || null,
          type: 'incoming',
          messageType: msgType,
          hasMedia: message.hasMedia || false,
          ...(mediaData && { 
            mediaType: mediaData.mimetype,
            mediaSize: mediaData.size,
            mediaFilename: mediaData.filename
          }),
          ...(message.location && {
            hasLocation: true,
            latitude: message.location.latitude,
            longitude: message.location.longitude
          })
        });
        if (messagesLog.length > MAX_LOG) messagesLog.shift();
      } catch {}

      // Derive phoneE164 from JID if possible (e.g., "1234567890@c.us" -> "+1234567890")
      const jidLocal = (message.from || '').split('@')[0] || '';
      const phoneE164 = /^\d{6,15}$/.test(jidLocal) ? `+${jidLocal}` : undefined;

      // Extract location data if message type is location
      let locationData = null;
      if (msgType === 'location' && message.location) {
        locationData = {
          latitude: message.location.latitude,
          longitude: message.location.longitude,
          description: message.location.description || message.body || ''
        };
        console.log(`[message] Location shared: lat=${locationData.latitude}, lng=${locationData.longitude}, description="${locationData.description}"`);
      }

      // Prepare webhook payload
      const webhookPayload = {
        chatbotId,
        event: 'message',
        message: message.body,
        from: message.from,
        email: `${message.from.split('@')[0]}@gmail.com`,
        phoneE164,
        messageType: msgType,
        hasMedia: message.hasMedia || false,
        ...(mediaData && { media: mediaData }),
        ...(locationData && { location: locationData })
      };

      console.log(`[message] Webhook payload prepared: hasMedia=${webhookPayload.hasMedia}, messageType=${webhookPayload.messageType}${mediaData ? `, mediaType=${mediaData.mimetype}` : ''}${locationData ? `, hasLocation=true` : ''}`);

      // Call Next.js API for incoming message processing using env base URL
      const apiBase = (process.env.NEXT_PUBLIC_ABSOLUTE_URL || 'http://localhost:3001').replace(/\/+$/, '');
      const response = await fetch(`${apiBase}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': process.env.AGENT_API_KEY
        },
        body: JSON.stringify(webhookPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[message] API error: ${response.status} - ${errorText}`);
        throw new Error(`Failed to fetch response from local API: ${response.status} - ${errorText}`);
      }

      let data;
      const responseText = await response.text();
      console.log(`[message] Raw API response (${responseText.length} chars): ${responseText.substring(0, 500)}`);
      
      try {
        data = JSON.parse(responseText);
        console.log(`[message] Parsed API response:`, JSON.stringify(data).substring(0, 500));
      } catch (parseError) {
        console.error(`[message] Failed to parse API response as JSON:`, parseError.message);
        data = {};
      }
      
      // Handle different possible response formats
      let text = '';
      if (data && typeof data === 'object') {
        if (data.answer) {
          text = String(data.answer);
        } else if (data.message) {
          text = String(data.message);
        } else if (data.response) {
          text = String(data.response);
        } else if (data.reply) {
          text = String(data.reply);
        } else if (data.text) {
          text = String(data.text);
        } else {
          console.warn(`[message] API response does not contain expected fields. Keys present:`, Object.keys(data));
        }
      } else if (typeof data === 'string') {
        text = data;
      }
      
      console.log(`[message] Extracted text (${text.length} chars): ${text.substring(0, 200)}`);
      
      if (!text || !text.trim()) {
        console.warn(`[message] Empty or whitespace-only response from API. Full data:`, JSON.stringify(data));
      }

      if (text.trim()) {
        try {
          await client.sendMessage(message.from, text);
          console.log(`[message] Reply sent to ${message.from}: ${text}`);
          try {
            messagesLog.push({
              ts: new Date().toISOString(),
              from: 'bot',
              to: message.from,
              body: text,
              id: null,
              type: 'outgoing',
            });
            if (messagesLog.length > MAX_LOG) messagesLog.shift();
          } catch {}
        } catch (error) {
          console.error('[message] Error sending reply:', error.message, error.stack);
          try {
            await client.sendPresenceAvailable();
            await client.simulateTyping(message.from, true);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await client.simulateTyping(message.from, false);
            await client.sendMessage(message.from, 'Sorry, there was an error processing your request.');
          } catch (sendError) {
            console.error('Error sending error message:', sendError.message, sendError.stack);
          }
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 500));
        await client.sendMessage(message.from, 'Sorry, I couldn\'t generate a response.');
        console.log('[message] Sent fallback message due to empty response');
        try {
          messagesLog.push({
            ts: new Date().toISOString(),
            from: 'bot',
            to: message.from,
            body: "Sorry, I couldn't generate a response.",
            id: null,
            type: 'outgoing',
          });
          if (messagesLog.length > MAX_LOG) messagesLog.shift();
        } catch {}
      }
    } catch (error) {
      console.error('[message] Error processing incoming message:', error.message, error.stack);
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        await client.sendMessage(message.from, 'Sorry, there was an error processing your request.');
      } catch (sendError) {
        console.error('Error sending error message:', sendError.message, sendError.stack);
      }
    }
  });

  client.on('disconnected', async (reason) => {
    console.log(`❌ ${process.env.BRAND_NAME || 'Server'}: Client disconnected for ${chatbotId}:`, reason);
    
    // Stop health monitoring
    stopHealthMonitoring(chatbotId);
    
    try {
      await fetch(`${process.env.NEXT_PUBLIC_ABSOLUTE_URL}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': process.env.AGENT_API_KEY
        },
        body: JSON.stringify({
          chatbotId,
          event: 'disconnected',
        }),
      });
      
      // Enhanced reconnection logic with exponential backoff
      console.log(`Attempting to reconnect client for ${chatbotId}...`);
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 5;
      
      while (reconnectAttempts < maxReconnectAttempts) {
        try {
          const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(`Reconnect attempt ${reconnectAttempts + 1}/${maxReconnectAttempts} after ${backoffDelay}ms delay`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          
          await client.initialize();
          console.log(`Successfully reconnected client for ${chatbotId}`);
          return; // Success, exit the function
        } catch (reconnectError) {
          reconnectAttempts++;
          console.error(`Reconnect attempt ${reconnectAttempts} failed for ${chatbotId}:`, reconnectError.message);
          
          if (reconnectAttempts >= maxReconnectAttempts) {
            console.error(`All reconnection attempts failed for ${chatbotId}. Cleaning up...`);
            clients.delete(chatbotId);
            qrCodes.delete(chatbotId);
            try {
              await client.destroy();
            } catch (destroyError) {
              console.error(`Error destroying client on disconnect for ${chatbotId}:`, destroyError.message);
            }
            
            // Schedule a fresh initialization after 5 minutes
            setTimeout(() => {
              console.log(`Attempting fresh initialization for ${chatbotId} after extended delay`);
              initializeClient().catch(error => {
                console.error(`Fresh initialization failed for ${chatbotId}:`, error.message);
              });
            }, 300000); // 5 minutes
          }
        }
      }
    } catch (error) {
      console.error(`Error notifying Next.js for ${chatbotId}:`, error.message, error.stack);
    }
  });

  client.on('auth_failure', async (msg) => {
    console.error(`❌ ${process.env.BRAND_NAME || 'Server'}: Authentication failure for ${chatbotId}:`, msg);
    clients.delete(chatbotId);
    qrCodes.delete(chatbotId);
    try {
      await client.destroy();
    } catch (destroyError) {
      console.error(`❌ ${process.env.BRAND_NAME || 'Server'}: Error destroying client on auth failure for ${chatbotId}:`, destroyError.message);
    }
    await clearSession(chatbotId);
  });

  const delayMs = 2000 * Math.pow(1.5, retryCount); // Reduced exponential backoff
  
  try {
    console.log(`🚀 ${process.env.BRAND_NAME || 'Server'}: Starting client initialization for ${chatbotId} (Attempt ${retryCount + 1}/${maxRetries})`);
    console.log(`📊 ${process.env.BRAND_NAME || 'Server'}: Memory usage before init: ${process.memoryUsage().heapUsed / 1024 / 1024} MB`);
    console.log(`💾 ${process.env.BRAND_NAME || 'Server'}: Using ${sessionStorageType} session storage`);
    console.log(`🔧 ${process.env.BRAND_NAME || 'Server'}: Using Chromium at ${process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/chromium'}`);
    
    if (retryCount > 0) {
      console.log(`⏳ ${process.env.BRAND_NAME || 'Server'}: Waiting ${delayMs}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    
    const initTimeoutMs = parseInt(process.env.INIT_TIMEOUT_MS || '480000', 10);
    const initializeTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Client initialization timed out after ${Math.round(initTimeoutMs/60000)} minutes`)), initTimeoutMs);
    });
    
    console.log(`🔄 ${process.env.BRAND_NAME || 'Server'}: Launching browser process...`);
    const initPromise = client.initialize();
    // Prevent unhandled rejection if initialize() resolves/rejects after the timeout wins the race
    initPromise.catch(() => {});
    await Promise.race([initPromise, initializeTimeout]);
    clients.set(chatbotId, client);
    console.log(`✅ ${process.env.BRAND_NAME || 'Server'}: Client initialized successfully for ${chatbotId}`);
    console.log(`📊 ${process.env.BRAND_NAME || 'Server'}: Memory usage after init: ${process.memoryUsage().heapUsed / 1024 / 1024} MB`);
    return { status: 'initialized' };
  } catch (error) {
    console.error(`❌ ${process.env.BRAND_NAME || 'Server'}: Error initializing client for ${chatbotId}:`, error.message);
    
    // Clean up failed client
    clients.delete(chatbotId);
    qrCodes.delete(chatbotId);
    try {
      await client.destroy();
    } catch (destroyError) {
      console.error(`❌ ${process.env.BRAND_NAME || 'Server'}: Error destroying failed client for ${chatbotId}:`, destroyError.message);
    }
    
    // Handle specific error types
    if (error.message.includes('Authentication failure') || error.message.includes('bad auth')) {
      if (retryCount === maxRetries - 1) {
        console.log(`🧹 ${process.env.BRAND_NAME || 'Server'}: Clearing session for ${chatbotId} due to authentication failure`);
        await clearSession(chatbotId);
      }
    } else if (error.message.includes('Execution context was destroyed') || error.message.includes('Protocol error')) {
      console.warn(`🔄 ${process.env.BRAND_NAME || 'Server'}: Puppeteer context destroyed, will retry with fresh context`);
      // Force garbage collection to clean up destroyed contexts
      if (global.gc) {
        global.gc();
      }
    } else if (error.message.includes('timeout')) {
      console.warn(`⏱️ ${process.env.BRAND_NAME || 'Server'}: Initialization timeout, extending wait time for retry`);
    }
    
    if (retryCount < maxRetries - 1) {
      const nextRetry = retryCount + 1;
      console.log(`🔄 ${process.env.BRAND_NAME || 'Server'}: Retrying initialization for ${chatbotId} (${nextRetry + 1}/${maxRetries}) in ${delayMs}ms`);
      return initializeClient(nextRetry, maxRetries);
    }
    
    console.error(`💥 ${process.env.BRAND_NAME || 'Server'}: All initialization attempts failed for ${chatbotId}`);
    throw error;
  }
}

// Brand configuration endpoint
app.get('/api/brand', (req, res) => {
  const brandName = process.env.BRAND_NAME || 'WhatsApp Client';
  const brandTagline = process.env.BRAND_TAGLINE || 'AI Assistant';
  
  res.json({
    name: brandName,
    tagline: brandTagline
  });
});

// Serve UI for QR code scanning
app.get('/connect/:phoneE164', (req, res) => {
  const { phoneE164 } = req.params;
  if (phoneE164 !== process.env.CLIENT_PHONE_E164) {
    return res.status(403).send('Invalid chatbot ID');
  }
  res.sendFile(path.join(__dirname, 'public', 'connect.html'));
});

// Initialize client on server start
initializeClient().catch((error) => {
  console.error('Client initialization failed, shutting down server:', error.message);
  process.exit(1);
});

app.post('/init', requireApiKey, async (req, res) => {
  console.log(`📱 ${process.env.BRAND_NAME || 'Server'}: Received /init request:`, req.body);
  try {
    const result = await initializeClient();
    console.log(`📱 ${process.env.BRAND_NAME || 'Server'}: /init response:`, result);
    res.status(200).json(result);
  } catch (error) {
    console.error(`❌ ${process.env.BRAND_NAME || 'Server'}: Error in /init endpoint:`, error.message, error.stack);
    res.status(500).json({ error: 'Failed to initialize client', details: error.message });
  }
});

app.get('/qr', requireApiKey, (req, res) => {
  console.log(`📱 ${process.env.BRAND_NAME || 'Server'}: Received /qr request`);
  const qrData = qrCodes.get(process.env.CLIENT_PHONE_E164);
  if (!qrData) {
    console.error(`❌ ${process.env.BRAND_NAME || 'Server'}: No QR code available`);
    return res.status(404).json({ error: 'No QR code available' });
  }
  res.json({ qrCode: qrData.base64 });
});

// New endpoint to serve QR code as image
app.get('/qr-image', requireApiKey, (req, res) => {
  console.log(`📱 ${process.env.BRAND_NAME || 'Server'}: Received /qr-image request`);
  const qrData = qrCodes.get(process.env.CLIENT_PHONE_E164);
  if (!qrData) {
    console.error(`❌ ${process.env.BRAND_NAME || 'Server'}: No QR code available`);
    return res.status(404).send('QR code not available');
  }
  
  // Extract base64 data from data URL
  const base64Data = qrData.base64.replace(/^data:image\/png;base64,/, '');
  const imgBuffer = Buffer.from(base64Data, 'base64');
  
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Length', imgBuffer.length);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(imgBuffer);
});

app.get('/status', requireApiKey, (req, res) => {
  console.log(`📱 ${process.env.BRAND_NAME || 'Server'}: Received /status request`);
  const client = clients.get(process.env.CLIENT_PHONE_E164);
  res.json({
    connected: client?.info?.wid?.user ? true : false,
    phoneNumber: client?.info?.wid?.user || null,
  });
});

// Enhanced health check endpoint
app.get('/health', requireApiKey, async (req, res) => {
  console.log(`📱 ${process.env.BRAND_NAME || 'Server'}: Received /health request`);
  const chatbotId = process.env.CLIENT_PHONE_E164;
  const client = clients.get(chatbotId);
  
  if (!client) {
    return res.status(503).json({
      status: 'unhealthy',
      reason: 'Client not initialized',
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  }
  
  try {
    const state = await client.getState().catch(() => null);
    const isHealthy = state && !['UNPAIRED', 'UNPAIRED_IDLE', 'CONFLICT', 'UNLAUNCHED'].includes(state);
    const phoneNumber = client?.info?.wid?.user || null;
    
    res.json({
      status: isHealthy ? 'healthy' : 'degraded',
      state: state,
      connected: !!phoneNumber,
      phoneNumber: phoneNumber,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      hasHealthMonitoring: sessionHealthChecks.has(chatbotId)
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      reason: error.message,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  }
});

// Lightweight healthcheck endpoint for Docker HEALTHCHECK
// Must remain PUBLIC (no API key) and very fast
app.get('/healthz', (req, res) => {
  res.status(200).send('ok');
});

// Expose logs endpoint for quick verification
app.get('/logs/messages', requireApiKey, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, MAX_LOG);
    const slice = messagesLog.slice(-limit);
    res.status(200).json({ count: slice.length, total: messagesLog.length, items: slice });
  } catch (e) {
    res.status(200).json({ count: messagesLog.length, total: messagesLog.length, items: messagesLog });
  }
});


app.post('/send-message', requireApiKey, async (req, res) => {
  console.log(`📱 ${process.env.BRAND_NAME || 'Server'}: Received /send-message request:`, req.body);
  const { to, body } = req.body;
  if (!to || !body) {
    console.error(`❌ ${process.env.BRAND_NAME || 'Server'}: Missing required fields in /send-message: ${JSON.stringify({ to, body })}`);
    return res.status(400).json({ error: 'Missing to or body', details: { to, body } });
  }
  if (!to.endsWith('@c.us')) {
    console.error(`❌ ${process.env.BRAND_NAME || 'Server'}: Invalid recipient for ${to}: must be personal chat (@c.us)`);
    return res.status(400).json({ error: 'Invalid recipient', details: 'Recipient must be a personal chat (@c.us)' });
  }

  const client = clients.get(process.env.CLIENT_PHONE_E164);
  if (!client) {
    console.error(`❌ ${process.env.BRAND_NAME || 'Server'}: Client not initialized`);
    return res.status(404).json({ error: 'Client not initialized' });
  }

  try {
    // Small delay before sending message
    await new Promise(resolve => setTimeout(resolve, 500));
    await client.sendMessage(to, body);
    console.log(`✅ ${process.env.BRAND_NAME || 'Server'}: Message sent to ${to}: ${body}`);
    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error(`❌ ${process.env.BRAND_NAME || 'Server'}: Error sending message:`, error.message, error.stack);
    return res.status(500).json({ error: 'Failed to send message', details: error.message });
  }
});

// Send WhatsApp message using E.164 phone number
app.post('/send-whatsapp', requireApiKey, async (req, res) => {
  console.log(`📱 ${process.env.BRAND_NAME || 'Server'}: Received /send-whatsapp request:`, req.body);
  const { phoneE164, message } = req.body || {};
  
  if (!phoneE164 || !/^\+\d{6,15}$/.test(phoneE164)) {
    return res.status(400).json({ error: 'Invalid phoneE164. Expected E.164 format e.g. +15551234567' });
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Invalid message' });
  }

  const client = clients.get(process.env.CLIENT_PHONE_E164);
  if (!client) {
    console.error(`❌ ${process.env.BRAND_NAME || 'Server'}: Client not initialized`);
    return res.status(404).json({ error: 'Client not initialized' });
  }

  try {
    // Check if client is ready
    const state = await client.getState().catch(() => null);
    const isClientReady = state && !['UNPAIRED', 'UNPAIRED_IDLE', 'CONFLICT', 'UNLAUNCHED'].includes(state);
    
    if (!isClientReady) {
      return res.status(503).json({ error: 'Client not ready' });
    }
    const result = await sendMessageDirectly(client, phoneE164, message);
    if (result.success) {
      console.log(`${process.env.BRAND_NAME || 'Server'}: Message sent immediately to ${phoneE164}: ${message}`);
      return res.status(200).json({ status: 'sent', to: phoneE164 });
    }
    console.warn(`${process.env.BRAND_NAME || 'Server'}: Failed to send message to ${phoneE164}: ${result.error}`);
    return res.status(500).json({ error: 'Failed to send', details: result.error });
  } catch (error) {
    console.error(`❌ ${process.env.BRAND_NAME || 'Server'}: Error processing WhatsApp message:`, error.message, error.stack);
    return res.status(500).json({ error: 'Failed to process WhatsApp message', details: error.message });
  }
});

// Send media (images, documents, audio, video, etc.) via WhatsApp
app.post('/send-media', requireApiKey, async (req, res) => {
  console.log(`📱 ${process.env.BRAND_NAME || 'Server'}: Received /send-media request:`, { body: { ...req.body, base64: req.body?.base64 ? '[omitted]' : undefined } });
  try {
    const { phoneE164, fileUrl, base64, mimeType, filename, caption } = req.body || {};

    // Validate phone number
    if (!phoneE164 || !/^\+\d{6,15}$/.test(phoneE164)) {
      return res.status(400).json({ error: 'Invalid phoneE164. Expected E.164 format e.g. +15551234567' });
    }

    // Validate media source
    if ((!fileUrl && !base64) || (fileUrl && base64)) {
      return res.status(400).json({ error: 'Provide either fileUrl or base64 (exclusively).' });
    }

    const client = clients.get(process.env.CLIENT_PHONE_E164);
    if (!client) {
      console.error('Client not initialized');
      return res.status(404).json({ error: 'Client not initialized' });
    }

    // Ensure client is ready
    let state = await client.getState().catch(() => null);
    if (!state || ['UNPAIRED', 'UNPAIRED_IDLE'].includes(state)) {
      console.warn('Client not ready/state, waiting briefly:', state);
      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('ready_timeout')), 15000);
          const onReady = () => { clearTimeout(timeout); resolve(); };
          client.once('ready', onReady);
        });
        state = await client.getState().catch(() => null);
      } catch (e) {
        console.error('Client still not ready after wait:', state);
        return res.status(503).json({ error: 'Client not ready', details: state || 'unknown' });
      }
    }

    // Validate number is on WhatsApp and get proper JID
    const number = phoneE164.replace('+', '');
    const wid = await client.getNumberId(number);
    if (!wid || !wid._serialized) {
      console.error(`Number ${phoneE164} is not on WhatsApp`);
      return res.status(404).json({ error: 'Number not on WhatsApp', to: phoneE164 });
    }

    // Build MessageMedia
    let media;
    if (fileUrl) {
      try {
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const dataBase64 = Buffer.from(response.data, 'binary').toString('base64');
        const ct = mimeType || response.headers['content-type'] || 'application/octet-stream';
        let inferredName = filename;
        if (!inferredName) {
          try {
            const url = new URL(fileUrl);
            inferredName = path.basename(url.pathname) || 'file';
          } catch {
            inferredName = filename || 'file';
          }
        }
        media = new MessageMedia(ct, dataBase64, inferredName);
      } catch (err) {
        console.error('Failed to download fileUrl:', err.message);
        return res.status(400).json({ error: 'Failed to download fileUrl', details: err.message });
      }
    } else {
      if (!mimeType) {
        return res.status(400).json({ error: 'mimeType is required when providing base64' });
      }
      const name = filename || `file_${Date.now()}`;
      media = new MessageMedia(mimeType, base64, name);
    }

    // Small delay before sending
    await new Promise(resolve => setTimeout(resolve, 300));
    await client.sendMessage(wid._serialized, media, caption ? { caption } : {});
    console.log(`✅ ${process.env.BRAND_NAME || 'Server'}: Media sent to ${wid._serialized} (from ${phoneE164})${caption ? ` with caption: ${caption}` : ''}`);
    return res.status(200).json({ status: 'success', to: phoneE164 });
  } catch (error) {
    console.error(`❌ ${process.env.BRAND_NAME || 'Server'}: Error sending media:`, error.message, error.stack);
    return res.status(500).json({ error: 'Failed to send media', details: error.message });
  }
});

app.post('/webhook-path', requireApiKey, async (req, res) => {
  console.log(`📱 ${process.env.BRAND_NAME || 'Server'}: Received /webhook-path request:`, req.body);
  const { event, phoneNumber } = req.body;
  if (event === 'connected') {
    console.log(`Webhook: Client connected, phone: ${phoneNumber}`);
    return res.status(200).json({ status: 'success' });
  }
  if (event === 'disconnected') {
    console.log('Webhook: Client disconnected');
    return res.status(200).json({ status: 'success' });
  }
  console.log('Webhook received but not processed:', req.body);
  return res.status(200).json({ status: 'success' });
});

app.post('/logout', requireApiKey, async (req, res) => {
  console.log(`🔓 ${process.env.BRAND_NAME || 'Server'}: Received /logout request`);
  const chatbotId = process.env.CLIENT_PHONE_E164;
  const client = clients.get(chatbotId);
  
  if (!client) {
    console.warn(`⚠️ ${process.env.BRAND_NAME || 'Server'}: No active client found for logout`);
    return res.status(404).json({ error: 'No active client found' });
  }
  
  try {
    console.log(`🔓 ${process.env.BRAND_NAME || 'Server'}: Logging out WhatsApp session for ${chatbotId}`);
    
    stopHealthMonitoring(chatbotId);
    
    await client.logout();
    console.log(`✅ ${process.env.BRAND_NAME || 'Server'}: Client logged out successfully`);
    
    await clearSession(chatbotId);
    console.log(`✅ ${process.env.BRAND_NAME || 'Server'}: Session data cleared`);
    
    try {
      await client.destroy();
      console.log(`✅ ${process.env.BRAND_NAME || 'Server'}: Client destroyed`);
    } catch (destroyError) {
      console.warn(`⚠️ ${process.env.BRAND_NAME || 'Server'}: Error destroying client:`, destroyError.message);
    }
    
    clients.delete(chatbotId);
    qrCodes.delete(chatbotId);
    console.log(`✅ ${process.env.BRAND_NAME || 'Server'}: Client removed from memory`);
    
    try {
      await fetch(`${process.env.NEXT_PUBLIC_ABSOLUTE_URL}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': process.env.AGENT_API_KEY
        },
        body: JSON.stringify({
          chatbotId,
          event: 'logged_out',
        }),
      });
    } catch (webhookError) {
      console.warn(`⚠️ ${process.env.BRAND_NAME || 'Server'}: Error notifying webhook:`, webhookError.message);
    }
    
    console.log(`🔓 ${process.env.BRAND_NAME || 'Server'}: Logout complete. Ready for new session initialization.`);
    res.status(200).json({ 
      status: 'logged_out', 
      message: 'Session destroyed successfully. You can now initialize a new session.' 
    });
  } catch (error) {
    console.error(`❌ ${process.env.BRAND_NAME || 'Server'}: Error during logout:`, error.message, error.stack);
    res.status(500).json({ error: 'Failed to logout', details: error.message });
  }
});

const PORT = process.env.PORT || 3700;
server.listen(PORT, () => {
  const brandName = process.env.BRAND_NAME || 'WhatsApp Server';
  console.log(`🚀 ${brandName} Server is running on port ${PORT}`);
  console.log(`🔗 Connect UI: http://localhost:${PORT}/connect/${process.env.CLIENT_PHONE_E164}`);
  console.log(`🔗 Brand API: http://localhost:${PORT}/api/brand`);
  console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/webhook-path`);
  console.log(`🔗 Send message endpoint: http://localhost:${PORT}/send-message`);
  console.log(`🔗 Send media endpoint: http://localhost:${PORT}/send-media`);
  console.log(`🔗 QR code endpoint: http://localhost:${PORT}/qr`);
  console.log(`🔗 Status endpoint: http://localhost:${PORT}/status`);
  console.log(`🔗 Health endpoint: http://localhost:${PORT}/health`);
  console.log(`🔗 Logout endpoint: http://localhost:${PORT}/logout`);
  console.log(`🔗 Socket.IO endpoint: http://localhost:${PORT}/socket.io`);
  console.log(`🔒 API Key authentication: ${process.env.API_KEY ? 'ENABLED' : 'DISABLED'}`);
  console.log(`🏷️ Brand: ${brandName} - ${process.env.BRAND_TAGLINE || 'AI Assistant'}`);
});