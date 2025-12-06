const express = require('express');
const router = express.Router();
const aiServiceWebhook = require('../webhooks/aiService');

// Middleware to validate API requests
const validateRequest = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};

// Configure AI auto-reply (triggers AI service registration)
router.post('/configure', validateRequest, async (req, res) => {
  try {
    const { 
      enabled, 
      aiApiUrl, 
      aiApiKey, 
      chatbotId, 
      email, 
      autoReplyDelay, 
      onlyReplyToUnknown 
    } = req.body;

    // Validate required fields
    if (!aiApiKey || !chatbotId || !email) {
      return res.status(400).json({ 
        error: 'Missing required fields: aiApiKey, chatbotId, email' 
      });
    }

    // Initialize AI service connection when user configures AI settings
    if (enabled) {
      try {
        await aiServiceWebhook.initializeOnUserConfig();
        console.log('🤖 AI Service initialized due to user configuration');
        
        // Send configuration to AI service
        await aiServiceWebhook.sendConfigToAIService({
          enabled,
          aiApiUrl: aiApiUrl || 'https://message.geneline-x.net/api/v1/message',
          aiApiKey,
          chatbotId,
          email,
          autoReplyDelay: autoReplyDelay || 3,
          onlyReplyToUnknown: onlyReplyToUnknown !== false,
          userId: email,
          sessionId: process.env.CLIENT_PHONE_E164
        });
        
      } catch (error) {
        console.error('Failed to initialize AI service:', error);
        return res.status(500).json({ 
          error: 'Failed to connect to AI service',
          details: error.message 
        });
      }
    } else {
      // Disconnect from AI service if disabled
      aiServiceWebhook.disconnect();
      console.log('🤖 AI Service disconnected due to user configuration');
    }
    
    res.json({
      success: true,
      message: enabled ? 'AI auto-reply enabled and service connected' : 'AI auto-reply disabled',
      aiServiceRegistered: enabled && aiServiceWebhook.isRegistered
    });

  } catch (error) {
    console.error('Error configuring AI:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get AI configuration status
router.get('/status', validateRequest, (req, res) => {
  res.json({
    aiServiceRegistered: aiServiceWebhook.isRegistered,
    serverId: aiServiceWebhook.serverId,
    aiServiceUrl: aiServiceWebhook.aiServiceUrl
  });
});

// Test AI configuration
router.post('/test', validateRequest, async (req, res) => {
  try {
    const { aiApiUrl, aiApiKey, chatbotId, email } = req.body;

    if (!aiApiKey || !chatbotId || !email) {
      return res.status(400).json({ 
        error: 'Missing required fields for testing: aiApiKey, chatbotId, email' 
      });
    }

    // Test the AI service directly
    const axios = require('axios');
    const testMessage = 'Hello, this is a test message.';
    
    const response = await axios.post(
      `${aiApiUrl || 'https://message.geneline-x.net/api/v1/message'}?api_key=${aiApiKey}`,
      {
        chatbotId,
        email,
        message: testMessage,
      },
      {
        headers: {
          'accept': 'text/plain',
          'Content-Type': 'application/json',
        },
        timeout: 15000
      }
    );

    res.json({
      success: true,
      message: 'AI service connection successful',
      testResponse: response.data
    });
  } catch (error) {
    console.error('AI service test failed:', error);
    res.status(400).json({
      success: false,
      error: 'AI service connection failed',
      details: error.message
    });
  }
});

// Disable AI auto-reply
router.post('/disable', validateRequest, (req, res) => {
  try {
    aiServiceWebhook.disconnect();
    console.log('🤖 AI Service disconnected by user request');
    
    res.json({
      success: true,
      message: 'AI auto-reply disabled and service disconnected'
    });
  } catch (error) {
    console.error('Error disabling AI:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
