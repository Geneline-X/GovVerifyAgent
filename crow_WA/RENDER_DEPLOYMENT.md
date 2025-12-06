# Render Deployment Guide

This guide walks you through deploying the WhatsApp Server to Render as a Web Service.

## Prerequisites

1. Render account (sign up at https://render.com)
2. MongoDB Atlas account for session persistence (sign up at https://www.mongodb.com/cloud/atlas)
3. GitHub/GitLab repository with this codebase

## Quick Deploy

### Option 1: Deploy via Blueprint (Recommended)

1. Push your code to GitHub/GitLab
2. Go to Render Dashboard: https://dashboard.render.com
3. Click "New" > "Blueprint"
4. Connect your repository
5. Render will automatically detect the `render.yaml` file
6. Configure the required environment variables:
   - `CLIENT_PHONE_E164`: Your WhatsApp client phone number in E.164 format (e.g., +15551234567)
   - `MONGODB_URI`: Your MongoDB connection string
   - `NEXT_PUBLIC_ABSOLUTE_URL`: Your Next.js application URL for webhooks
   - `API_KEY`: Will be auto-generated or set your own secure key
7. Click "Apply" to create the service

### Option 2: Manual Deploy via Dashboard

1. Go to Render Dashboard
2. Click "New" > "Web Service"
3. Connect your repository
4. Configure service:
   - **Name**: whatsapp-server
   - **Runtime**: Docker
   - **Region**: Choose closest to your users
   - **Branch**: main
   - **Dockerfile Path**: ./Dockerfile
   - **Docker Context**: .
5. Add environment variables (see below)
6. Click "Create Web Service"

## Required Environment Variables

Configure these in the Render Dashboard under "Environment":

```
CLIENT_PHONE_E164=+15551234567
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/whatsapp-sessions
NEXT_PUBLIC_ABSOLUTE_URL=https://your-nextjs-app.com
API_KEY=your-secure-api-key-here
BRAND_NAME=AIDeX
BRAND_TAGLINE=WhatsApp AI Assistant
PORT=10000
NODE_ENV=production
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
CHROME_BIN=/usr/bin/chromium
NODE_OPTIONS=--max-old-space-size=2048
```

## MongoDB Setup

1. Create a MongoDB Atlas cluster (free tier works fine)
2. Create a database user with read/write permissions
3. Whitelist Render's IP addresses (or use 0.0.0.0/0 for all IPs)
4. Get your connection string from Atlas
5. Replace username, password, and cluster details in MONGODB_URI

## Service Configuration

### Recommended Plan
- **Starter Plan** or higher for persistent storage and better performance
- Free tier may work but has limitations (service sleeps after inactivity)

### Health Check
- The service includes a `/healthz` endpoint for Render health checks
- Health check path: `/healthz` (no authentication required)
- Expected response: `200 OK` with body "ok"

### Scaling
- Single instance recommended (WhatsApp sessions are stateful)
- Vertical scaling (more RAM/CPU) preferred over horizontal scaling

## Post-Deployment Steps

### 1. Verify Service is Running
Check logs in Render dashboard for:
```
Server is running on port 10000
Client initialized successfully
```

### 2. Initialize WhatsApp Connection
Access your service URL:
```
https://your-service.onrender.com/connect/+15551234567
```
Replace `+15551234567` with your CLIENT_PHONE_E164.

### 3. Scan QR Code
1. Open the connect page in your browser
2. QR code will appear automatically
3. Open WhatsApp on your phone
4. Go to Settings > Linked Devices > Link a Device
5. Scan the QR code

### 4. Test API Endpoints

Test health check:
```bash
curl https://your-service.onrender.com/healthz
```

Test status (requires API key):
```bash
curl -H "x-api-key: your-api-key" \
  https://your-service.onrender.com/status
```

Send test message:
```bash
curl -X POST https://your-service.onrender.com/send-whatsapp \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "phoneE164": "+15551234567",
    "message": "Hello from Render!"
  }'
```

## Monitoring

### View Logs
1. Go to Render Dashboard
2. Select your service
3. Click "Logs" tab
4. Monitor for errors or warnings

### Health Checks
Monitor the health endpoint:
```bash
curl -H "x-api-key: your-api-key" \
  https://your-service.onrender.com/health
```

Response includes:
- Connection status
- Session state
- Memory usage
- Uptime

## Troubleshooting

### Service Won't Start
1. Check logs for errors
2. Verify all environment variables are set
3. Ensure MongoDB connection string is correct
4. Check Docker build logs

### QR Code Not Appearing
1. Check service logs for initialization errors
2. Verify Chromium is installed (check Dockerfile)
3. Ensure PORT environment variable matches Render's PORT (10000)
4. Try accessing: `GET /qr` endpoint with API key

### Messages Not Sending
1. Verify client is connected: `GET /status`
2. Check health: `GET /health`
3. Review logs for errors
4. Ensure phone numbers are in E.164 format

### Session Not Persisting
1. Verify MONGODB_URI is correct
2. Check MongoDB Atlas network access settings
3. Ensure database user has proper permissions
4. Review logs for MongoDB connection errors

### Memory Issues
1. Increase instance size in Render dashboard
2. Adjust NODE_OPTIONS for more memory
3. Monitor memory usage via `/health` endpoint

## Security Best Practices

1. Use strong, randomly generated API_KEY
2. Keep environment variables in Render dashboard (never commit to git)
3. Use MongoDB connection string with authentication
4. Enable MongoDB IP whitelisting when possible
5. Regularly rotate API keys
6. Monitor logs for unauthorized access attempts

## Updating the Service

### Automatic Updates
- Push changes to your connected git branch
- Render will automatically detect changes and redeploy
- Monitor deployment logs to ensure success

### Manual Redeploy
1. Go to Render Dashboard
2. Select your service
3. Click "Manual Deploy" > "Deploy latest commit"

### Zero-Downtime Updates
- Render performs rolling deploys automatically
- WhatsApp sessions persist via MongoDB
- Sessions automatically restore after deployment

## Cost Optimization

1. Use Starter plan ($7/month) for production workloads
2. Free tier works for testing but service sleeps after 15 minutes of inactivity
3. MongoDB Atlas free tier (M0) sufficient for most use cases
4. Monitor usage in Render dashboard to optimize resources

## Additional Resources

- Render Documentation: https://render.com/docs
- WhatsApp Web.js Docs: https://wwebjs.dev
- MongoDB Atlas: https://www.mongodb.com/docs/atlas/
- Support: Check service logs and Render community forums

## API Documentation

### Available Endpoints

#### POST /init
Initialize WhatsApp client (API key required)

#### GET /qr
Get QR code for authentication (API key required)

#### GET /status
Get client connection status (API key required)

#### GET /health
Detailed health check (API key required)

#### GET /healthz
Simple health check (no authentication)

#### POST /send-whatsapp
Send WhatsApp message (API key required)

#### POST /send-media
Send media files (API key required)

#### POST /logout
Logout and clear session (API key required)

#### GET /connect/:phoneE164
Web UI for QR code scanning

## Support

For issues specific to this deployment:
1. Check Render service logs
2. Review MongoDB connection
3. Verify environment variables
4. Check Render status page: https://status.render.com

For WhatsApp Web.js issues:
- GitHub: https://github.com/pedroslopez/whatsapp-web.js
- Discord: https://discord.gg/wyKybbF
