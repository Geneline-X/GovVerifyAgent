# Crowdsource Agent Server

An intelligent WhatsApp-based civic crowdsourcing platform that allows citizens to report community problems and upvote them to signal priority to local councils and district authorities in Sierra Leone.

## Features

- **OpenAI-Powered Intent Classification**: Uses GPT-4 with structured outputs to intelligently classify messages as:
  - New problem reports (with automatic title, location, category extraction)
  - Upvotes for existing problems
  - Help requests

- **Prisma + PostgreSQL**: Clean database layer for problems and upvotes that can be queried by web dashboards

- **WhatsApp Integration**: Receives webhooks from WhatsApp gateway and sends replies back

## Architecture

```
WhatsApp Gateway (Node.js) 
    ↓ webhook POST
Agent Server (this)
    ↓ OpenAI API (intent classification)
    ↓ Prisma (DB operations)
PostgreSQL
    ↑ queries
Web Dashboard (Next.js)
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/crowsource_db
WHATSAPP_SERVER_URL=http://localhost:3700
WHATSAPP_API_KEY=your-whatsapp-gateway-api-key
AGENT_API_KEY=your-agent-api-key
OPENAI_API_KEY=sk-your-openai-api-key
PORT=3800
```

### 3. Run Prisma Migrations

```bash
npm run prisma:generate
npm run prisma:migrate
```

This will:
- Generate the Prisma Client
- Create `problems` and `problem_upvotes` tables in your database

### 4. Start the Server

Development:
```bash
npm run dev
```

Production:
```bash
npm run build
npm start
```

## Database Schema

### `problems` Table
- `id` - Auto-incrementing primary key
- `reporterPhone` - Phone number of reporter (E.164 format)
- `rawMessage` - Original WhatsApp message
- `title` - Extracted problem title
- `locationText` - Extracted location (optional)
- `createdAt` - Timestamp
- `updatedAt` - Timestamp
- `upvoteCount` - Number of upvotes

### `problem_upvotes` Table
- `problemId` - Foreign key to problems
- `voterPhone` - Phone number of voter (E.164 format)
- `createdAt` - Timestamp
- Primary key: `(problemId, voterPhone)` - ensures one vote per person per problem

## API Endpoints

### `POST /webhook/whatsapp` (protected by `AGENT_API_KEY`)

Receives webhooks from WhatsApp gateway.

Request body:
```json
{
  "chatbotId": "string",
  "event": "message",
  "message": "Broken water pipe in Ojodu",
  "from": "2348012345678@c.us",
  "phoneE164": "+2348012345678"
}
```

### `GET /healthz` (public)

Health check endpoint.

## WhatsApp Gateway Integration

Your existing WhatsApp server should POST incoming messages to this agent:

```javascript
const agentUrl = process.env.AGENT_URL; // http://localhost:3800/webhook/whatsapp
const agentApiKey = process.env.AGENT_API_KEY;

await fetch(agentUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': agentApiKey,
  },
  body: JSON.stringify(webhookPayload),
});
```

The agent will:
1. Use OpenAI to classify intent and extract structured data
2. Store problems/upvotes in Postgres
3. Send reply back via your WhatsApp gateway's `/send-message` endpoint

## Web Dashboard Integration

Your Next.js app can query the same Postgres database using Prisma:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get top problems by upvotes
const topProblems = await prisma.problem.findMany({
  orderBy: { upvoteCount: 'desc' },
  take: 10,
  include: {
    upvotes: true,
  },
});

// Get recent problems
const recentProblems = await prisma.problem.findMany({
  orderBy: { createdAt: 'desc' },
  take: 20,
});

// Get problems by location
const problemsByLocation = await prisma.problem.findMany({
  where: {
    locationText: {
      contains: 'Ojodu',
      mode: 'insensitive',
    },
  },
});
```

## User Flows

### Reporting a Problem

**User sends:** `Broken water pipe near Ojodu market for 3 days`

**Agent:**
1. OpenAI extracts:
   - Title: "Broken water pipe"
   - Location: "Ojodu market"
   - Category: "utilities"
2. Creates problem in DB
3. Replies with problem number

**Response:** 
```
Your community problem has been recorded.

Problem number: 42
Title: Broken water pipe
Location: Ojodu market
Category: utilities

Share this number with neighbors so they can upvote by sending the number.
```

### Upvoting a Problem

**User sends:** `42` or `upvote 42`

**Agent:**
1. OpenAI recognizes upvote intent and extracts problem ID
2. Creates upvote record (or detects duplicate)
3. Increments upvote count

**Response:**
```
Your upvote has been recorded for problem 42: Broken water pipe. Total upvotes: 15.
```

## Development Tools

### Prisma Studio

Visual database browser:
```bash
npm run prisma:studio
```

### Database Migrations

Create a new migration:
```bash
npm run prisma:migrate
```

Deploy migrations (production):
```bash
npm run prisma:deploy
```

## Google Coding Standards

This codebase follows Google TypeScript Style Guide:
- Strict typing (no `any`)
- Camel case for variables/functions
- Constants in UPPER_SNAKE_CASE
- Proper error handling
- No boilerplate code
- Modern ES2020+ features
