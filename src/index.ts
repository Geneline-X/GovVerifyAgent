import express, { Request, Response, NextFunction } from "express";
import { logger } from "./logger";
import { config } from "./config";
import { GovVerifyAgent } from "./gov-verifyAgent";
import cors from "cors";
import path from "path";

// Import routes
import analyticsRoutes from "./routes/analytics";
import citizenEngagementRoutes from "./routes/citizen-engagement";
import documentFeedsRoutes from "./routes/document-feeds";
import citizenStatsRoutes from "./routes/citizen-stats";

const app = express();
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  credentials: true
}));

let agent: GovVerifyAgent;

// Helper to detect if string is base64 or binary data
function isBinaryOrBase64(str: string): boolean {
  if (!str || str.length < 50) return false;
  
  // Check if it looks like base64 (starts with common JPEG/image headers)
  if (str.startsWith('/9j/') || str.startsWith('iVBORw') || str.startsWith('R0lGOD')) {
    return true;
  }
  
  // Check if mostly non-printable characters
  const nonPrintable = str.split('').filter(c => {
    const code = c.charCodeAt(0);
    return code < 32 || code > 126;
  }).length;
  
  return nonPrintable / str.length > 0.3;
}

// Initialize agent
(async () => {
  try {
    agent = new GovVerifyAgent();
    await agent.initialize();
    logger.info("Government Verification Agent initialized successfully");
  } catch (error) {
    logger.error({ error }, "Failed to initialize agent");
    process.exit(1);
  }
})();

// API key middleware
function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKeyHeader = req.headers["x-api-key"] as string | undefined;
  const apiKeyQuery = typeof req.query.api_key === "string" ? (req.query.api_key as string) : undefined;
  const expected = config.agent.apiKey;

  if (!apiKeyHeader && !apiKeyQuery) {
    return res.status(401).json({ error: "Unauthorized: API key is required" }) as any;
  }

  if (apiKeyHeader !== expected && apiKeyQuery !== expected) {
    return res.status(401).json({ error: "Unauthorized: Invalid API key" }) as any;
  }

  next();
}

// Serve uploaded files
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// API Routes
app.use("/api/analytics", analyticsRoutes);
app.use("/api/citizen-engagement", citizenEngagementRoutes);
app.use("/api/feeds", documentFeedsRoutes);
app.use("/api/citizen-stats", citizenStatsRoutes);

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "gov-verify-agent",
    activeConversations: agent ? agent.getActiveConversationsCount() : 0,
  });
});

app.get("/healthz", (req: Request, res: Response) => {
  res.status(200).send("ok");
});

// Clear conversation history for a user
app.delete("/api/v1/conversation/:phone", requireApiKey, (req: Request, res: Response) => {
  const phone = req.params.phone;

  if (!agent) {
    return res.status(503).json({ error: "Agent not initialized" }) as any;
  }

  const cleared = agent.clearUserConversation(phone);

  if (cleared) {
    return res.json({
      success: true,
      message: `Conversation history cleared for ${phone}`,
    }) as any;
  } else {
    return res.status(404).json({
      success: false,
      message: `No conversation found for ${phone}`,
    }) as any;
  }
});

// WhatsApp webhook verification (GET)
app.get("/webhook/whatsapp", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  logger.info({ mode, token, challenge }, "Webhook verification request");

  if (mode === "subscribe" && token === config.whatsapp.verifyToken) {
    logger.info("Webhook verified successfully");
    res.status(200).send(challenge);
  } else {
    logger.warn("Webhook verification failed");
    res.sendStatus(403);
  }
});

// External WhatsApp client webhook (POST)
app.post("/webhook/whatsapp", requireApiKey, async (req: Request, res: Response) => {
  try {
    const { event, message, from, phoneE164, messageType, location, media } = req.body;

    logger.info({ event, from, phoneE164, message }, "Received WhatsApp message");

    // Handle different events
    if (event === "connected") {
      return res.json({ status: "success", message: "Client connected" }) as any;
    }

    if (event === "disconnected") {
      return res.json({ status: "success", message: "Client disconnected" }) as any;
    }

    if (event === "message") {
      // Extract phone number from JID if needed
      let phone = phoneE164;
      if (!phone && from && from.includes("@c.us")) {
        const phoneNumber = from.split("@")[0];
        phone = `+${phoneNumber}`;
      }

      if (!phone) {
        return res.status(400).json({ error: "Phone number required" }) as any;
      }

      // Handle location shares from WhatsApp
      let locationContext;
      if (messageType === "location" && location) {
        logger.info(
          {
            phone,
            latitude: location.latitude,
            longitude: location.longitude,
            description: location.description,
          },
          "Location share received"
        );

        // Filter out binary/base64 data from description
        const cleanDescription = (location.description && !isBinaryOrBase64(location.description)) 
          ? location.description 
          : (location.address && !isBinaryOrBase64(location.address))
            ? location.address
            : null;

        locationContext = {
          hasLocation: true,
          latitude: location.latitude,
          longitude: location.longitude,
          locationDescription: cleanDescription,
        };

        // Auto-trigger problem report flow with location
        const locationMessage =
          message ||
          `I'm sharing my location to report a problem.`;
        const response = await agent.processMessage(locationMessage, phone, locationContext);

        return res.json({
          answer: response,
          status: "success",
        }) as any;
      }

      // Handle text-only messages
      if (!message || !message.trim()) {
        return res.json({
          answer:
            "Welcome! You can report community problems or upvote existing ones by sending the problem number.\n\nYou can also share your WhatsApp location when reporting a problem.",
          status: "success",
        }) as any;
      }

      // Handle media attachments
      let mediaContext;
      if (media && media.data) {
        logger.info(
          {
            phone,
            mimeType: media.mimetype,
            size: media.size,
            filename: media.filename
          },
          "Media attachment received"
        );
        mediaContext = {
          hasMedia: true,
          mimeType: media.mimetype,
          data: media.data,
          filename: media.filename,
          size: media.size
        };
      }

      // Process message with OpenAI Agent
      const response = await agent.processMessage(message, phone, locationContext, mediaContext);

      return res.json({
        answer: response,
        status: "success",
      }) as any;
    }

    return res.json({ status: "unknown_event" }) as any;
  } catch (error: any) {
    logger.error({ error }, "Error processing webhook");
    return res.status(500).json({
      answer: "Sorry, I encountered an error. Please try again.",
      status: "error",
    }) as any;
  }
});

// Start server
app.listen(config.port, () => {
  logger.info({ port: config.port }, `${config.brandName} server started`);
  logger.info(`Health check: http://localhost:${config.port}/health`);
  logger.info(`External WhatsApp: POST http://localhost:${config.port}/webhook/whatsapp`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});
