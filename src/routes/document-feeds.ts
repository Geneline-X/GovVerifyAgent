import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { logger } from "../logger";

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/feeds/verifications
 * Recent verification feed
 * Query params: ?limit=20&offset=0&status=VERIFIED&category=HEALTH
 */
router.get("/verifications", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;
    const category = req.query.category as string;

    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;

    const verifications = await prisma.verification.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: {
        verifiedAt: "desc",
      },
      select: {
        id: true,
        claim: true,
        status: true,
        category: true,
        confidence: true,
        result: true,
        verifiedAt: true,
        requesterPhone: true,
        sources: true,
      },
    });

    const total = await prisma.verification.count({ where });

    res.json({
      data: verifications,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching verification feed");
    res.status(500).json({ error: "Failed to fetch verification feed" });
  }
});

/**
 * GET /api/feeds/threats
 * Recent cyber threat reports feed
 * Query params: ?limit=20&offset=0&threatType=ROMANCE_SCAM&status=URGENT
 */
router.get("/threats", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const threatType = req.query.threatType as string;
    const status = req.query.status as string;

    const where: any = {};
    if (threatType) where.threatType = threatType;
    if (status) where.status = status;

    const threats = await prisma.cyberThreatReport.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: {
        reportedAt: "desc",
      },
      select: {
        id: true,
        referenceNumber: true,
        threatType: true,
        description: true,
        platform: true,
        amountLost: true,
        status: true,
        isUrgent: true,
        reportedAt: true,
        reporterPhone: true,
      },
    });

    const total = await prisma.cyberThreatReport.count({ where });

    res.json({
      data: threats,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching threat feed");
    res.status(500).json({ error: "Failed to fetch threat feed" });
  }
});

/**
 * GET /api/feeds/official-information
 * Official government information feed
 * Query params: ?limit=20&offset=0&category=HEALTH&isPinned=true
 */
router.get("/official-information", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const category = req.query.category as string;
    const isPinned = req.query.isPinned === "true";

    const where: any = { isActive: true };
    if (category) where.category = category;
    if (isPinned) where.isPinned = true;

    const information = await prisma.officialInformation.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: [
        { isPinned: "desc" },
        { publishedDate: "desc" },
      ],
      select: {
        id: true,
        title: true,
        category: true,
        content: true,
        sourceMinistry: true,
        sourceUrl: true,
        publishedDate: true,
        expiryDate: true,
        isPinned: true,
        viewCount: true,
      },
    });

    const total = await prisma.officialInformation.count({ where });

    res.json({
      data: information,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching official information feed");
    res.status(500).json({ error: "Failed to fetch official information feed" });
  }
});

/**
 * GET /api/feeds/public-awareness
 * Public awareness campaigns feed
 * Query params: ?limit=20&offset=0&isActive=true&priority=HIGH
 */
router.get("/public-awareness", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const isActive = req.query.isActive !== "false";
    const priority = req.query.priority as string;

    const where: any = { isActive };
    if (priority) where.priority = priority;

    const campaigns = await prisma.publicAwareness.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: [
        { priority: "desc" },
        { publishedAt: "desc" },
      ],
      select: {
        id: true,
        title: true,
        type: true,
        content: true,
        threatType: true,
        targetAudience: true,
        priority: true,
        publishedAt: true,
        expiresAt: true,
        viewCount: true,
        shareCount: true,
      },
    });

    const total = await prisma.publicAwareness.count({ where });

    res.json({
      data: campaigns,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching public awareness feed");
    res.status(500).json({ error: "Failed to fetch public awareness feed" });
  }
});

/**
 * GET /api/feeds/information-requests
 * Recent information requests feed
 * Query params: ?limit=20&offset=0&wasAnswered=true
 */
router.get("/information-requests", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const wasAnswered = req.query.wasAnswered;

    const where: any = {};
    if (wasAnswered !== undefined) {
      where.wasAnswered = wasAnswered === "true";
    }

    const requests = await prisma.informationRequest.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: {
        requestedAt: "desc",
      },
      select: {
        id: true,
        topic: true,
        category: true,
        ministry: true,
        requesterPhone: true,
        requestedAt: true,
        wasAnswered: true,
        responseText: true,
      },
    });

    const total = await prisma.informationRequest.count({ where });

    res.json({
      data: requests,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching information requests feed");
    res.status(500).json({ error: "Failed to fetch information requests feed" });
  }
});

/**
 * GET /api/feeds/user-feedback
 * Recent user feedback
 * Query params: ?limit=20&offset=0&isCorrect=true
 */
router.get("/user-feedback", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const isCorrect = req.query.isCorrect;

    const where: any = {};
    if (isCorrect !== undefined) {
      where.isCorrect = isCorrect === "true";
    }

    const feedback = await prisma.userFeedback.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: {
        submittedAt: "desc",
      },
      select: {
        id: true,
        verificationId: true,
        userPhone: true,
        isCorrect: true,
        comment: true,
        submittedAt: true,
        verification: {
          select: {
            claim: true,
            status: true,
          },
        },
      },
    });

    const total = await prisma.userFeedback.count({ where });

    res.json({
      data: feedback,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching user feedback feed");
    res.status(500).json({ error: "Failed to fetch user feedback feed" });
  }
});

/**
 * GET /api/feeds/combined
 * Combined feed of all activities (mixed timeline)
 * Query params: ?limit=50&offset=0
 */
router.get("/combined", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    // Get recent verifications
    const verifications = await prisma.verification.findMany({
      take: Math.floor(limit / 3),
      orderBy: { verifiedAt: "desc" },
      select: {
        id: true,
        claim: true,
        status: true,
        category: true,
        verifiedAt: true,
      },
    });

    // Get recent threats
    const threats = await prisma.cyberThreatReport.findMany({
      take: Math.floor(limit / 3),
      orderBy: { reportedAt: "desc" },
      select: {
        id: true,
        referenceNumber: true,
        threatType: true,
        description: true,
        reportedAt: true,
        status: true,
      },
    });

    // Get recent awareness campaigns
    const campaigns = await prisma.publicAwareness.findMany({
      where: { isActive: true },
      take: Math.floor(limit / 3),
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        priority: true,
        publishedAt: true,
      },
    });

    // Combine and sort by timestamp
    const combined = [
      ...verifications.map((v) => ({
        type: "verification",
        id: v.id,
        title: v.claim.substring(0, 100),
        status: v.status,
        category: v.category,
        timestamp: v.verifiedAt,
      })),
      ...threats.map((t) => ({
        type: "threat",
        id: t.id,
        title: t.description.substring(0, 100),
        status: t.status,
        threatType: t.threatType,
        referenceNumber: t.referenceNumber,
        timestamp: t.reportedAt,
      })),
      ...campaigns.map((c) => ({
        type: "awareness",
        id: c.id,
        title: c.title,
        campaignType: c.type,
        priority: c.priority,
        timestamp: c.publishedAt,
      })),
    ].sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });

    res.json({
      data: combined.slice(0, limit),
      count: combined.length,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching combined feed");
    res.status(500).json({ error: "Failed to fetch combined feed" });
  }
});

export default router;
