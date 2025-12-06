const axios = require('axios');
const crypto = require('crypto');

class AIServiceWebhook {
  constructor() {
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:4000';
    // Use consistent server ID based on phone number and port to avoid random IDs
    this.serverId = process.env.SERVER_ID || `server-${process.env.CLIENT_PHONE_E164}-${process.env.PORT || 3700}`;
    this.isRegistered = false;
    this.heartbeatInterval = null;
  }

  async initializeOnUserConfig() {
    // Only initialize when user configures AI settings
    if (!this.isRegistered) {
      try {
        await this.registerServer();
        this.startHeartbeat();
        console.log(`🤖 AI Service integration initialized for server: ${this.serverId}`);
      } catch (error) {
        console.error('Failed to initialize AI Service:', error);
        throw error;
      }
    }
  }

  async registerServer() {
    try {
      const response = await axios.post(`${this.aiServiceUrl}/api/webhooks/register`, {
        serverId: this.serverId,
        serverUrl: process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3700}`,
        apiKey: process.env.API_KEY,
        sessionId: process.env.CLIENT_PHONE_E164,
        phoneNumber: process.env.CLIENT_PHONE_E164
      });

      this.isRegistered = true;
      console.log(`📡 Server registered with AI Service: ${response.data.serverId}`);
    } catch (error) {
      console.error('Server registration failed:', error.message);
      throw error;
    }
  }

  startHeartbeat() {
    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(async () => {
      try {
        await axios.post(`${this.aiServiceUrl}/api/webhooks/heartbeat`, {
          sessionId: process.env.CLIENT_PHONE_E164,
          phoneNumber: process.env.CLIENT_PHONE_E164,
          status: 'connected' // You can make this dynamic based on actual status
        }, {
          headers: {
            'x-server-id': this.serverId,
            'x-api-key': process.env.API_KEY
          }
        });
      } catch (error) {
        console.error('Heartbeat failed:', error.message);
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  disconnect() {
    this.stopHeartbeat();
    this.isRegistered = false;
  }

  async sendConfigToAIService(config) {
    if (!this.isRegistered) {
      console.log('AI Service not registered, cannot send config');
      return;
    }

    try {
      await axios.post(`${this.aiServiceUrl}/api/ai-config/${config.sessionId}`, config, {
        headers: {
          'x-server-id': this.serverId,
          'x-api-key': process.env.API_KEY,
          'Content-Type': 'application/json'
        }
      });

      console.log(`🤖 AI configuration sent to AI Service for session: ${config.sessionId}`);
    } catch (error) {
      console.error('Failed to send config to AI Service:', error.message);
      throw error;
    }
  }

  async sendMessageToAI(message) {
    if (!this.isRegistered) {
      console.log('AI Service not registered, skipping message');
      return;
    }

    try {
      await axios.post(`${this.aiServiceUrl}/api/webhooks/message`, {
        sessionId: process.env.CLIENT_PHONE_E164,
        message: {
          id: message.id._serialized || message.id,
          from: message.from,
          body: message.body,
          timestamp: message.timestamp,
          type: 'incoming'
        }
      }, {
        headers: {
          'x-server-id': this.serverId,
          'x-api-key': process.env.API_KEY
        }
      });

      console.log(`📨 Message sent to AI Service: ${message.from} -> ${message.body.substring(0, 50)}...`);
    } catch (error) {
      console.error('Failed to send message to AI Service:', error.message);
    }
  }
}

module.exports = new AIServiceWebhook();
