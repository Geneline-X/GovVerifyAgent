const express = require('express');
const router = express.Router();
const aiServiceWebhook = require('../webhooks/aiService');

// Configure AI auto-reply settings
router.post('/configure', async (req, res) => {
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

    // Initialize AI service integration when user configures it
    if (enabled && !aiServiceWebhook.isRegistered) {
      await aiServiceWebhook.initializeOnUserConfig();
    }

    // Send the AI configuration to the centralized AI service
    if (enabled) {
      const aiServiceResponse = await fetch(`${aiServiceWebhook.aiServiceUrl}/api/ai-config/${process.env.CLIENT_PHONE_E164}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-server-id': aiServiceWebhook.serverId,
          'x-api-key': process.env.API_KEY
        },
        body: JSON.stringify({
          enabled,
          aiApiUrl,
          aiApiKey,
          chatbotId,
          email,
          autoReplyDelay,
          onlyReplyToUnknown,
          userId: process.env.CLIENT_PHONE_E164
        })
      });

      if (!aiServiceResponse.ok) {
        throw new Error(`Failed to configure AI service: ${aiServiceResponse.statusText}`);
      }
    }

    // If disabled, disconnect from AI service
    if (!enabled && aiServiceWebhook.isRegistered) {
      aiServiceWebhook.disconnect();
      console.log('🤖 AI Service disconnected due to user configuration');
    }

    res.json({
      message: 'AI configuration updated successfully',
      enabled,
      registered: aiServiceWebhook.isRegistered
    });

  } catch (error) {
    console.error('Error configuring AI:', error);
    res.status(500).json({
      error: 'Failed to configure AI service',
      details: error.message
    });
  }
});

// Get AI configuration status
router.get('/status', (req, res) => {
  res.json({
    registered: aiServiceWebhook.isRegistered,
    serverId: aiServiceWebhook.serverId
  });
});

module.exports = router;
