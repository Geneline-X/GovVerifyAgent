# Render Deployment Guide for GenelineX Government Verification System

## 🚀 Why Render for This Project?

Render is **BETTER** than Vercel for this Express/Node.js backend because:
- ✅ **No serverless limitations** - Full Node.js environment
- ✅ **Persistent file system** - File uploads work perfectly
- ✅ **WebSocket support** - Real-time features work
- ✅ **No execution time limits** - Long-running processes OK
- ✅ **Background workers** - Can run scheduled jobs
- ✅ **Built-in PostgreSQL** - Free managed database
- ✅ **Always-on instances** - No cold starts

---

## 📋 Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com) (Free tier available!)
2. **GitHub/GitLab Account**: Connect your repository
3. **Database**: Use Render PostgreSQL (free) or external provider

---

## 🎯 Quick Deployment (5 Minutes)

### Step 1: Push Your Code to GitHub

```bash
# Initialize git if not already
git init
git add .
git commit -m "Initial commit"

# Create GitHub repo and push
git remote add origin https://github.com/yourusername/your-repo.git
git branch -M main
git push -u origin main
```

### Step 2: Create PostgreSQL Database on Render

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name**: `geneline-x-db`
   - **Database**: `geneline_x`
   - **User**: `geneline_x_user`
   - **Region**: Choose closest to your users (e.g., Oregon, Frankfurt, Singapore)
   - **Plan**: **Free** (great for development/testing)
4. Click **"Create Database"**
5. **SAVE** the connection details (you'll need them!)

### Step 3: Create Web Service

1. Click **"New +"** → **"Web Service"**
2. **Connect Repository**: Select your GitHub repo
3. **Configure Service**:

```yaml
Name: geneline-x-api
Region: Oregon (US West) # or closest to you
Branch: main
Runtime: Node
Build Command: npm install && npm run build
Start Command: npm start
```

4. **Select Plan**: 
   - **Free** (512 MB RAM, spins down after 15 min inactivity)
   - **Starter** ($7/mo, 512 MB RAM, always on) - Recommended
   - **Standard** ($25/mo, 2 GB RAM, auto-scaling)

### Step 4: Add Environment Variables

Click **"Environment"** tab and add these variables:

```env
# Database (from Step 2)
DATABASE_URL=postgresql://user:password@hostname:5432/database

# API Configuration
AGENT_API_KEY=your-secure-api-key-here
NODE_ENV=production
PORT=3000

# WhatsApp Configuration
WHATSAPP_VERIFY_TOKEN=your-verify-token

# OpenAI (if using)
OPENAI_API_KEY=sk-your-openai-key

# AWS S3 (if using file uploads)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name

# RAG Configuration (if using)
GENELINE_X_RAG_API_URL=https://your-rag-api.com
GENELINE_X_RAG_API_KEY=your-rag-key
GENELINE_X_CHATBOT_ID=your-chatbot-id
```

**Important**: Copy the `DATABASE_URL` from your PostgreSQL database in Render!

### Step 5: Deploy!

1. Click **"Create Web Service"**
2. Render will automatically:
   - Install dependencies
   - Build your TypeScript code
   - Generate Prisma client
   - Start your server
3. Watch the logs - first deployment takes 2-5 minutes

### Step 6: Run Database Migrations

Once deployed, open the **Shell** tab and run:

```bash
npx prisma migrate deploy
```

Or use Render's Build Command:
```bash
npm install && npx prisma generate && npx prisma migrate deploy && npm run build
```

---

## 📝 Project Configuration Files

### 1. Update package.json

Add or update these scripts:

```json
{
  "scripts": {
    "build": "tsc -p .",
    "start": "node dist/index.js",
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "postinstall": "prisma generate",
    "render-build": "npm install && npx prisma generate && npx prisma migrate deploy && npm run build"
  }
}
```

### 2. Create render.yaml (Optional but Recommended)

This allows "Infrastructure as Code" - automatic configuration:

```yaml
databases:
  - name: geneline-x-db
    databaseName: geneline_x
    user: geneline_x_user
    plan: free
    region: oregon

services:
  - type: web
    name: geneline-x-api
    runtime: node
    region: oregon
    plan: free
    branch: main
    buildCommand: npm install && npx prisma generate && npx prisma migrate deploy && npm run build
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: geneline-x-db
          property: connectionString
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      - key: AGENT_API_KEY
        generateValue: true
      # Add other env vars manually in Render dashboard
```

### 3. Update .gitignore

Make sure these are ignored:

```gitignore
node_modules
.env
.env.local
.env.production
dist
uploads
*.log
.DS_Store
.vscode
.idea
```

### 4. Create .dockerignore (Optional)

```dockerignore
node_modules
npm-debug.log
dist
.env
.git
.vscode
uploads
*.log
```

---

## 🔧 Important Code Changes

### 1. Update CORS Origins

Edit `src/index.ts`:

```typescript
app.use(cors({
  origin: [
    'http://localhost:3001',
    'http://localhost:3000',
    'https://your-frontend.vercel.app',
    'https://your-frontend.onrender.com',
    'https://your-custom-domain.com'
  ],
  credentials: true
}));
```

### 2. Port Configuration

Make sure your server uses Render's PORT:

```typescript
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`);
});
```

### 3. File Uploads (Already Works!)

Your existing file upload setup will work on Render:

```typescript
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
```

**Note**: Files persist on Render's persistent disk (included in all paid plans). Free tier has ephemeral storage (files deleted on restart).

For production, use:
- AWS S3
- Cloudinary
- Render Disk (paid plans)

---

## 🎯 Deployment Methods

### Method 1: Automatic Deployment (Recommended)

**Setup once, deploy forever!**

1. Connect GitHub repo to Render
2. Every push to `main` automatically deploys
3. Pull requests create preview environments (paid plans)

```bash
# Just push to deploy!
git add .
git commit -m "Update feature"
git push origin main
# Render automatically deploys!
```

### Method 2: Manual Deployment

1. Go to your service in Render dashboard
2. Click **"Manual Deploy"** → **"Deploy latest commit"**
3. Or select specific branch/commit

### Method 3: Render CLI (Advanced)

```bash
# Install Render CLI
npm install -g @render-com/cli

# Login
render login

# Deploy
render deploy
```

---

## ✅ Post-Deployment Checklist

- [ ] Service is running (check dashboard)
- [ ] Database connected successfully
- [ ] Prisma migrations ran
- [ ] Health check passes: `https://your-app.onrender.com/health`
- [ ] Dashboard accessible: `https://your-app.onrender.com/dashboard`
- [ ] API endpoints work
- [ ] Environment variables set correctly
- [ ] CORS configured for frontend
- [ ] Logs show no errors
- [ ] Custom domain configured (optional)

---

## 🔍 Testing Your Deployment

### 1. Health Check

```bash
curl https://your-app.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "gov-verify-agent",
  "activeConversations": 0
}
```

### 2. Dashboard Overview

```bash
curl https://your-app.onrender.com/api/dashboard/overview
```

### 3. Test with Frontend

Update your frontend `.env`:
```env
NEXT_PUBLIC_API_URL=https://your-app.onrender.com
```

---

## 📊 Monitoring & Logs

### View Logs

**In Dashboard**:
1. Go to your service
2. Click **"Logs"** tab
3. See real-time logs

**Using CLI**:
```bash
render logs -s your-service-name
```

### Metrics

Render provides:
- **CPU Usage**
- **Memory Usage**
- **Request Count**
- **Response Times**
- **Error Rates**

View in: Dashboard → Your Service → Metrics

### Alerts

Setup alerts for:
- Service down
- High error rate
- High memory usage
- Deployment failures

---

## 🐛 Troubleshooting

### Issue: "Cannot find module '@prisma/client'"

**Solution**: Add postinstall script to package.json
```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

### Issue: "Database connection error"

**Solution**:
1. Check DATABASE_URL is correct
2. Verify database is running in Render
3. Make sure format is: `postgresql://user:pass@host:5432/db`
4. Check database allows connections

**Get Internal Database URL** (faster):
```
DATABASE_URL=postgresql://user:pass@dpg-xxxxx:5432/db
```

### Issue: "Build failed"

**Solution**:
1. Check build logs for errors
2. Ensure all dependencies in package.json
3. Test build locally: `npm run build`
4. Check TypeScript errors

### Issue: "App keeps spinning down (Free tier)"

**Solution**:
- Upgrade to Starter plan ($7/mo) for always-on
- Or use a cron job to ping your app every 14 minutes:
  - [cron-job.org](https://cron-job.org)
  - [UptimeRobot](https://uptimerobot.com)

### Issue: "Slow first request (Free tier)"

**Reason**: Free tier spins down after 15 min inactivity
**Solution**: Upgrade to paid plan or use keep-alive service

### Issue: "File uploads not persisting"

**Reason**: Free tier has ephemeral storage
**Solution**:
1. Upgrade to paid plan with persistent disk
2. Or use external storage (S3, Cloudinary)

---

## 🔐 Security Best Practices

### 1. Environment Variables

- ✅ Store all secrets in Render environment variables
- ✅ Never commit .env files
- ✅ Use strong, unique API keys
- ✅ Rotate keys regularly

### 2. Database Security

- ✅ Use SSL for database connections (Render does this automatically)
- ✅ Restrict database access to your services only
- ✅ Regular backups (Render does daily backups)

### 3. CORS Configuration

```typescript
// Only allow specific origins in production
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ['https://your-frontend.vercel.app']
  : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
```

### 4. Rate Limiting

Add rate limiting to prevent abuse:

```bash
npm install express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

## 💰 Pricing Comparison

| Plan | Price | RAM | Features |
|------|-------|-----|----------|
| **Free** | $0 | 512 MB | Spins down after 15 min, 750 hours/month |
| **Starter** | $7/mo | 512 MB | Always on, persistent disk |
| **Standard** | $25/mo | 2 GB | Auto-scaling, more resources |
| **Pro** | $85/mo | 4 GB | Team features, priority support |

**Recommendation**: Start with **Starter** ($7/mo) for production.

---

## 🎨 Custom Domain Setup

### 1. Add Domain in Render

1. Go to your service
2. Click **"Settings"** → **"Custom Domain"**
3. Add your domain: `api.yourdomain.com`

### 2. Configure DNS

Add CNAME record in your DNS provider:

```
Type: CNAME
Name: api
Value: your-app.onrender.com
TTL: 3600
```

### 3. SSL Certificate

Render automatically provisions SSL certificate (Let's Encrypt) - **FREE!**

### 4. Update CORS

```typescript
app.use(cors({
  origin: ['https://api.yourdomain.com'],
  credentials: true
}));
```

---

## 🚀 Advanced Features

### 1. Background Workers

Create a separate worker service:

```yaml
# render.yaml
services:
  - type: web
    name: geneline-x-api
    # ... web service config

  - type: worker
    name: geneline-x-worker
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: node dist/worker.js
```

### 2. Cron Jobs

```yaml
services:
  - type: cron
    name: daily-stats
    schedule: "0 0 * * *"  # Daily at midnight
    buildCommand: npm install && npm run build
    startCommand: node dist/cron/daily-stats.js
```

### 3. Redis Cache

Add Redis for caching:

```yaml
databases:
  - name: geneline-x-redis
    ipAllowList: []
    plan: free
```

### 4. Health Checks

Render pings `/health` endpoint automatically. Make sure it's fast:

```typescript
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});
```

### 5. Preview Environments (Paid plans)

Automatic preview deployments for pull requests!

---

## 📈 Scaling Your Application

### Horizontal Scaling

Increase number of instances:
1. Go to Settings → Scaling
2. Set min/max instances
3. Auto-scales based on traffic

### Vertical Scaling

Upgrade to larger plan for more resources:
- More RAM
- More CPU
- Faster response times

### Database Scaling

Upgrade PostgreSQL plan:
- **Free**: 256 MB, 1 month retention
- **Starter**: 1 GB, 90 days retention
- **Standard**: 10 GB, continuous backup

---

## 🔄 CI/CD Pipeline

### Automatic Deployments

```yaml
# .github/workflows/deploy.yml
name: Deploy to Render

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Trigger Render Deploy
        run: |
          curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK }}
```

Get deploy hook URL from Render:
1. Settings → Deploy Hook
2. Copy URL
3. Add to GitHub Secrets

---

## 📚 Useful Render Commands

```bash
# View logs
render logs -s geneline-x-api

# Restart service
render restart -s geneline-x-api

# Open shell
render shell -s geneline-x-api

# Run migrations
render shell -s geneline-x-api -c "npx prisma migrate deploy"

# Check service status
render services list
```

---

## 🎯 Migration from Local to Render

### 1. Export Local Database

```bash
pg_dump your_local_db > backup.sql
```

### 2. Import to Render

```bash
# Get database URL from Render
psql $DATABASE_URL < backup.sql
```

Or use Prisma:
```bash
# Pull schema from local
npx prisma db pull

# Push to Render
DATABASE_URL="render_db_url" npx prisma db push
```

---

## 🆚 Render vs Vercel Comparison

| Feature | Render | Vercel |
|---------|--------|--------|
| **Backend** | ✅ Excellent | ⚠️ Serverless only |
| **Execution Time** | ✅ Unlimited | ❌ 10-60s limit |
| **File Storage** | ✅ Persistent disk | ❌ Ephemeral only |
| **WebSockets** | ✅ Full support | ❌ Limited |
| **Free Tier** | ✅ 750 hrs/mo | ✅ Unlimited |
| **Database** | ✅ Built-in | ✅ Built-in |
| **Auto-scaling** | ✅ Yes | ✅ Yes |
| **Price** | 💰 $7/mo starter | 💰 $20/mo pro |

**Verdict**: Use **Render for Backend**, **Vercel for Frontend**

---

## ✅ Final Setup Summary

```bash
# 1. Create Render account
# 2. Create PostgreSQL database
# 3. Create Web Service
# 4. Add environment variables
# 5. Deploy!

# Your API will be live at:
https://geneline-x-api.onrender.com

# Test it:
curl https://geneline-x-api.onrender.com/health
curl https://geneline-x-api.onrender.com/api/dashboard/overview
```

---

## 🎉 You're All Set!

Your GenelineX Government Verification System is now live on Render!

**Your API**: `https://your-app.onrender.com`

**Next Steps**:
1. Test all API endpoints
2. Connect your frontend
3. Monitor logs and metrics
4. Setup custom domain
5. Configure backups
6. Add monitoring alerts

Need help? Check [Render docs](https://render.com/docs) or their excellent support team!

---

## 📞 Support Resources

- [Render Documentation](https://render.com/docs)
- [Render Community Forum](https://community.render.com)
- [Render Status Page](https://status.render.com)
- [Support Email](mailto:support@render.com)

Happy deploying! 🚀
