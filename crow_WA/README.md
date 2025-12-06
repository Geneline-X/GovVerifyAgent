# WhatsApp Server

A production-grade WhatsApp Web API server with Docker and Render cloud deployment support.

## Features

### Core Features
- WhatsApp Web API integration
- QR code authentication
- Session persistence with MongoDB using CLIENT_PHONE_E164
- Health monitoring and auto-reconnection
- Message deduplication
- Media file support (images, documents, audio, video)
- Docker containerization
- Render cloud deployment ready

## Quick Start

### Deploy to Render (Recommended for Production)
1. Fork/clone this repository
2. Create a MongoDB Atlas account and database
3. Push to GitHub/GitLab
4. Deploy to Render using the included `render.yaml` blueprint

See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for detailed deployment instructions.

### Local Development with Docker
```bash
docker-compose up -d
```

### Local Development with Node.js
```bash
npm install
npm start
```

 

## API Endpoints

### Message Sending
- `POST /send-whatsapp` - Send WhatsApp message
- `POST /send-media` - Send media files via WhatsApp
- `POST /send-message` - Send direct message (legacy endpoint)

 

### Client Management
- `POST /init` - Initialize WhatsApp client
- `GET /qr` - Get QR code for authentication
- `GET /status` - Get client connection status
- `GET /health` - Detailed health check
- `POST /logout` - Logout and clear session

 

 

## Request Examples

### Send Message
```bash
curl -X POST http://localhost:3700/send-whatsapp \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "phoneE164": "+1234567890",
    "message": "Hello from WhatsApp server!"
  }'
```

**Response when sent immediately:**
```json
{
  "status": "sent",
  "to": "+1234567890"
}
```

## Environment Variables

```env
# Required
CLIENT_PHONE_E164=+1234567890
API_KEY=your-secure-api-key
MONGODB_URI=mongodb://localhost:27017/whatsapp

# Multiple Sessions Support
# Each CLIENT_PHONE_E164 creates separate session in MongoDB


```

 

## Error Handling

### Client Not Ready
- If the client is not ready, the server returns HTTP 503.

### Send Failures
- The server returns HTTP 500 with error details.
- Check server logs for the exact failure reason.

 

 

{{ ... }}

### Messages Not Being Sent
1. Check client status: `GET /status`
2. Verify client health: `GET /health`
3. Check server logs for errors
