# Render Deployment Checklist

Use this checklist to ensure a successful deployment to Render.

## Pre-Deployment

### 1. MongoDB Setup
- [ ] Created MongoDB Atlas account
- [ ] Created a new cluster (M0 free tier is sufficient)
- [ ] Created database user with read/write permissions
- [ ] Added IP whitelist (0.0.0.0/0 for Render or specific Render IPs)
- [ ] Obtained connection string (mongodb+srv://...)
- [ ] Tested connection string locally

### 2. Repository Setup
- [ ] Pushed all code to GitHub/GitLab
- [ ] Verified render.yaml exists in repository root
- [ ] Verified Dockerfile exists and is correct
- [ ] Verified .dockerignore is present
- [ ] All necessary files are committed (public/, routes/, etc.)

### 3. Environment Variables Ready
- [ ] CLIENT_PHONE_E164 (your WhatsApp number in E.164 format)
- [ ] MONGODB_URI (MongoDB connection string)
- [ ] NEXT_PUBLIC_ABSOLUTE_URL (webhook destination URL)
- [ ] API_KEY (secure random key, 32+ characters)
- [ ] BRAND_NAME (optional, default: AIDeX)
- [ ] BRAND_TAGLINE (optional, default: WhatsApp AI Assistant)

## Deployment Steps

### 1. Create Render Service
- [ ] Logged into Render dashboard (https://dashboard.render.com)
- [ ] Selected "New" > "Blueprint" or "Web Service"
- [ ] Connected GitHub/GitLab repository
- [ ] Selected correct branch (main/master)

### 2. Configure Service
- [ ] Service name: whatsapp-server
- [ ] Runtime: Docker
- [ ] Region: Selected (choose closest to users)
- [ ] Instance type: Starter or higher (recommended)
- [ ] Auto-deploy: Enabled

### 3. Add Environment Variables
- [ ] Added all required environment variables from .env.render.example
- [ ] Verified PORT is set to 10000
- [ ] Verified NODE_ENV is set to production
- [ ] Verified Puppeteer paths are correct
- [ ] Double-checked MONGODB_URI format

### 4. Deploy
- [ ] Clicked "Create Web Service" or "Apply Blueprint"
- [ ] Waited for build to complete (5-10 minutes)
- [ ] Checked build logs for errors
- [ ] Verified deployment succeeded

## Post-Deployment Verification

### 1. Service Health
- [ ] Service is running (green status in dashboard)
- [ ] Logs show: "Server is running on port 10000"
- [ ] Logs show: "Client initialized successfully"
- [ ] No critical errors in logs

### 2. Endpoint Tests
```bash
# Get your service URL from Render dashboard
SERVICE_URL=https://your-service.onrender.com
API_KEY=your-api-key

# Test health (no auth)
curl $SERVICE_URL/healthz

# Test status (with auth)
curl -H "x-api-key: $API_KEY" $SERVICE_URL/status

# Test health endpoint (with auth)
curl -H "x-api-key: $API_KEY" $SERVICE_URL/health
```

- [ ] /healthz returns "ok"
- [ ] /status returns JSON with connected status
- [ ] /health returns detailed health information

### 3. WhatsApp Connection
```bash
# Open in browser (replace with your CLIENT_PHONE_E164)
https://your-service.onrender.com/connect/+15551234567
```

- [ ] Connect page loads successfully
- [ ] QR code appears automatically
- [ ] Can scan QR code with WhatsApp mobile app
- [ ] After scan, status changes to connected
- [ ] Session persists after page refresh

### 4. Message Sending Test
```bash
# Test message sending
curl -X POST $SERVICE_URL/send-whatsapp \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "phoneE164": "+15551234567",
    "message": "Test message from Render deployment"
  }'
```

- [ ] API returns 200 status
- [ ] Message received on WhatsApp
- [ ] Logs show message was sent successfully

### 5. Session Persistence Test
- [ ] Manually trigger service restart in Render
- [ ] Wait for service to come back online
- [ ] Check /status endpoint - should show connected: true
- [ ] No need to scan QR code again
- [ ] Can send messages immediately after restart

## Monitoring Setup

### 1. Configure Alerts
- [ ] Enabled Render email alerts for service failures
- [ ] Set up health check monitoring
- [ ] Configured alert thresholds if available

### 2. Log Monitoring
- [ ] Bookmarked Render logs page
- [ ] Tested real-time log streaming
- [ ] Configured log retention if needed

### 3. Performance Monitoring
- [ ] Monitor memory usage via /health endpoint
- [ ] Check CPU usage in Render dashboard
- [ ] Monitor response times

## Security Verification

### 1. API Key Security
- [ ] API_KEY is strong (32+ random characters)
- [ ] API_KEY is not committed to git
- [ ] API_KEY is only in Render environment variables

### 2. MongoDB Security
- [ ] MongoDB connection string uses authentication
- [ ] MongoDB user has minimal required permissions
- [ ] IP whitelist configured (if possible)

### 3. Network Security
- [ ] HTTPS enforced (Render provides this automatically)
- [ ] No sensitive data in logs
- [ ] Environment variables properly secured

## Troubleshooting

If deployment fails, check:
- [ ] Build logs in Render dashboard
- [ ] All environment variables are set correctly
- [ ] MongoDB connection string is valid
- [ ] Dockerfile builds successfully locally
- [ ] No syntax errors in render.yaml

If service starts but crashes:
- [ ] Check runtime logs for errors
- [ ] Verify MongoDB connection works
- [ ] Ensure CLIENT_PHONE_E164 is in correct format
- [ ] Check memory usage (may need larger instance)

If QR code doesn't appear:
- [ ] Verify Chromium installation in logs
- [ ] Check PORT environment variable matches Render
- [ ] Ensure initialization completed successfully
- [ ] Try accessing /qr endpoint with API key

If messages don't send:
- [ ] Verify client is connected (/status endpoint)
- [ ] Check phone number format (E.164)
- [ ] Review logs for send errors
- [ ] Ensure target number is on WhatsApp

## Optimization

### Performance
- [ ] Monitor memory usage over time
- [ ] Adjust NODE_OPTIONS if needed
- [ ] Consider upgrading instance type if needed

### Cost
- [ ] Review Render usage dashboard
- [ ] Optimize instance size based on actual usage
- [ ] Monitor MongoDB Atlas usage

### Reliability
- [ ] Test automatic reconnection
- [ ] Verify health checks are passing
- [ ] Monitor uptime metrics

## Documentation

- [ ] Updated team documentation with service URLs
- [ ] Documented API endpoints for team
- [ ] Shared API_KEY securely with authorized team members
- [ ] Created runbook for common issues

## Success Criteria

Your deployment is successful when:
- Service is running and accessible
- Health checks are passing
- QR code can be scanned and WhatsApp connects
- Messages can be sent and received
- Session persists across restarts
- No critical errors in logs
- API endpoints respond correctly
- MongoDB connection is stable

## Next Steps

After successful deployment:
1. Test all API endpoints thoroughly
2. Set up monitoring and alerts
3. Document service URLs and API keys
4. Train team on usage
5. Monitor for first 24-48 hours
6. Create backup/disaster recovery plan

## Support Resources

- Render Documentation: https://render.com/docs
- Render Status: https://status.render.com
- MongoDB Atlas Docs: https://docs.atlas.mongodb.com
- WhatsApp Web.js: https://wwebjs.dev
- Service Logs: Check Render dashboard

## Rollback Plan

If deployment has issues:
1. Check previous deployment in Render dashboard
2. Click "Rollback" to previous working version
3. Review logs to identify issue
4. Fix issue in code
5. Redeploy when ready

---

Last Updated: 2025-10-22
