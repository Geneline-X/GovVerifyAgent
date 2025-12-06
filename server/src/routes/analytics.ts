import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { logger } from "../logger";

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/analytics/overview
 * Dashboard KPIs - Today's key metrics
 */
router.get("/overview", async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await prisma.dailyStatistics.findUnique({
      where: { date: today },
    });

    if (!stats) {
      return res.json({
        total_verifications: 0,
        total_threats: 0,
        active_users: 0,
        pending_verifications: 0,
        total_amount_lost: 0,
        avg_response_time_ms: 0,
      });
    }

    // Get pending verifications count
    const pendingCount = await prisma.verification.count({
      where: {
        status: "UNVERIFIED",
      },
    });

    res.json({
      total_verifications: stats.totalVerifications,
      total_threats: stats.totalThreats,
      active_users: stats.activeUsers,
      pending_verifications: pendingCount,
      total_amount_lost: stats.totalAmountLostDaily,
      avg_response_time_ms: stats.avgResponseTimeMs,
      date: stats.date,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching overview analytics");
    res.status(500).json({ error: "Failed to fetch overview analytics" });
  }
});

/**
 * GET /api/analytics/verifications/status
 * Verification status breakdown (pie chart data)
 */
router.get("/verifications/status", async (req: Request, res: Response) => {
  try {
    const statusBreakdown = await prisma.verification.groupBy({
      by: ["status"],
      _count: {
        id: true,
      },
    });

    const total = statusBreakdown.reduce((sum, item) => sum + item._count.id, 0);

    const data = statusBreakdown.map((item) => ({
      status: item.status,
      count: item._count.id,
      percentage: total > 0 ? Math.round((item._count.id / total) * 100 * 10) / 10 : 0,
    }));

    res.json({ data, total });
  } catch (error) {
    logger.error({ error }, "Error fetching verification status");
    res.status(500).json({ error: "Failed to fetch verification status" });
  }
});

/**
 * GET /api/analytics/verifications/trends
 * Verification trends over time (line chart)
 * Query params: ?days=30 (default: 7)
 */
router.get("/verifications/trends", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const trends = await prisma.dailyStatistics.findMany({
      where: {
        date: {
          gte: startDate,
        },
      },
      orderBy: {
        date: "asc",
      },
      select: {
        date: true,
        totalVerifications: true,
        verifiedTrue: true,
        verifiedFalse: true,
        verifiedPartial: true,
        unverified: true,
      },
    });

    res.json({ data: trends, days });
  } catch (error) {
    logger.error({ error }, "Error fetching verification trends");
    res.status(500).json({ error: "Failed to fetch verification trends" });
  }
});

/**
 * GET /api/analytics/verifications/categories
 * Top verification categories (bar chart)
 */
router.get("/verifications/categories", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const categories = await prisma.verification.groupBy({
      by: ["category"],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
      take: limit,
    });

    const data = categories.map((item) => ({
      category: item.category,
      count: item._count.id,
    }));

    res.json({ data });
  } catch (error) {
    logger.error({ error }, "Error fetching verification categories");
    res.status(500).json({ error: "Failed to fetch verification categories" });
  }
});

/**
 * GET /api/analytics/verifications/confidence
 * Confidence level distribution (donut chart)
 */
router.get("/verifications/confidence", async (req: Request, res: Response) => {
  try {
    const verifications = await prisma.verification.groupBy({
      by: ["confidence"],
      _count: {
        id: true,
      },
      where: {
        confidence: {
          not: null,
        },
      },
    });

    const total = verifications.reduce((sum, item) => sum + item._count.id, 0);

    const data = verifications.map((item) => ({
      level: item.confidence,
      count: item._count.id,
      percentage: total > 0 ? Math.round((item._count.id / total) * 100 * 10) / 10 : 0,
    }));

    res.json({ data, total });
  } catch (error) {
    logger.error({ error }, "Error fetching confidence levels");
    res.status(500).json({ error: "Failed to fetch confidence levels" });
  }
});

/**
 * GET /api/analytics/verifications/recent
 * Recent verifications (table data)
 * Query params: ?limit=20&offset=0
 */
router.get("/verifications/recent", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const verifications = await prisma.verification.findMany({
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
        verifiedAt: true,
        requesterPhone: true,
      },
    });

    const total = await prisma.verification.count();

    res.json({
      data: verifications,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching recent verifications");
    res.status(500).json({ error: "Failed to fetch recent verifications" });
  }
});

/**
 * GET /api/analytics/threats/types
 * Top threat types (bar chart)
 */
router.get("/threats/types", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const threats = await prisma.cyberThreatReport.groupBy({
      by: ["threatType"],
      _count: {
        id: true,
      },
      _sum: {
        amountLost: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
      take: limit,
    });

    const data = threats.map((item) => ({
      threat_type: item.threatType,
      count: item._count?.id || 0,
      total_amount_lost: item._sum?.amountLost || 0,
    }));

    res.json({ data });
  } catch (error) {
    logger.error({ error }, "Error fetching threat types");
    res.status(500).json({ error: "Failed to fetch threat types" });
  }
});

/**
 * GET /api/analytics/threats/trends
 * Threat trends over time (area chart)
 * Query params: ?days=30
 */
router.get("/threats/trends", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const trends = await prisma.dailyStatistics.findMany({
      where: {
        date: {
          gte: startDate,
        },
      },
      orderBy: {
        date: "asc",
      },
      select: {
        date: true,
        totalThreats: true,
        urgentThreats: true,
        totalAmountLostDaily: true,
      },
    });

    res.json({ data: trends, days });
  } catch (error) {
    logger.error({ error }, "Error fetching threat trends");
    res.status(500).json({ error: "Failed to fetch threat trends" });
  }
});

/**
 * GET /api/analytics/threats/financial-impact
 * Financial impact over time (line + bar combo)
 */
router.get("/threats/financial-impact", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const impact = await prisma.cyberThreatReport.findMany({
      where: {
        reportedAt: {
          gte: startDate,
        },
        amountLost: {
          not: null,
        },
      },
      select: {
        reportedAt: true,
        amountLost: true,
        threatType: true,
      },
      orderBy: {
        reportedAt: "asc",
      },
    });

    // Group by date
    const dailyImpact = impact.reduce((acc, item) => {
      const date = item.reportedAt.toISOString().split("T")[0];
      if (!acc[date]) {
        acc[date] = { date, total: 0, count: 0 };
      }
      acc[date].total += item.amountLost || 0;
      acc[date].count += 1;
      return acc;
    }, {} as Record<string, { date: string; total: number; count: number }>);

    const data = Object.values(dailyImpact);

    res.json({ data, days });
  } catch (error) {
    logger.error({ error }, "Error fetching financial impact");
    res.status(500).json({ error: "Failed to fetch financial impact" });
  }
});

/**
 * GET /api/analytics/threats/urgent
 * Urgent threats requiring immediate attention
 */
router.get("/threats/urgent", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const urgentThreats = await prisma.cyberThreatReport.findMany({
      where: {
        status: "URGENT",
      },
      take: limit,
      orderBy: {
        reportedAt: "desc",
      },
      select: {
        id: true,
        referenceNumber: true,
        threatType: true,
        description: true,
        amountLost: true,
        reportedAt: true,
        status: true,
      },
    });

    res.json({ data: urgentThreats, count: urgentThreats.length });
  } catch (error) {
    logger.error({ error }, "Error fetching urgent threats");
    res.status(500).json({ error: "Failed to fetch urgent threats" });
  }
});

/**
 * GET /api/analytics/threats/status-breakdown
 * Threat status funnel (funnel chart)
 */
router.get("/threats/status-breakdown", async (req: Request, res: Response) => {
  try {
    const statusBreakdown = await prisma.cyberThreatReport.groupBy({
      by: ["status"],
      _count: {
        id: true,
      },
    });

    const data = statusBreakdown.map((item) => ({
      status: item.status,
      count: item._count.id,
    }));

    res.json({ data });
  } catch (error) {
    logger.error({ error }, "Error fetching threat status breakdown");
    res.status(500).json({ error: "Failed to fetch threat status breakdown" });
  }
});

/**
 * GET /api/analytics/patterns
 * Active threat patterns
 */
router.get("/patterns", async (req: Request, res: Response) => {
  try {
    const patterns = await prisma.threatPattern.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        reportCount: "desc",
      },
      select: {
        id: true,
        patternName: true,
        threatType: true,
        reportCount: true,
        totalAmountLost: true,
        firstReported: true,
        lastReported: true,
        description: true,
      },
    });

    res.json({ data: patterns, count: patterns.length });
  } catch (error) {
    logger.error({ error }, "Error fetching threat patterns");
    res.status(500).json({ error: "Failed to fetch threat patterns" });
  }
});

/**
 * GET /api/analytics/patterns/:id
 * Detailed pattern information
 */
router.get("/patterns/:id", async (req: Request, res: Response) => {
  try {
    const pattern = await prisma.threatPattern.findUnique({
      where: {
        id: parseInt(req.params.id),
      },
    });

    if (!pattern) {
      return res.status(404).json({ error: "Pattern not found" });
    }

    res.json(pattern);
  } catch (error) {
    logger.error({ error }, "Error fetching pattern details");
    res.status(500).json({ error: "Failed to fetch pattern details" });
  }
});

/**
 * GET /api/analytics/daily-stats
 * Daily statistics for a date range
 * Query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get("/daily-stats", async (req: Request, res: Response) => {
  try {
    const from = req.query.from ? new Date(req.query.from as string) : new Date();
    const to = req.query.to ? new Date(req.query.to as string) : new Date();

    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    const stats = await prisma.dailyStatistics.findMany({
      where: {
        date: {
          gte: from,
          lte: to,
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    res.json({ data: stats, from, to });
  } catch (error) {
    logger.error({ error }, "Error fetching daily statistics");
    res.status(500).json({ error: "Failed to fetch daily statistics" });
  }
});

/**
 * GET /api/analytics/data-gaps
 * Information requests that couldn't be answered (data gaps)
 * Query params: ?limit=20&offset=0&priority=HIGH
 * 
 * 🎯 SELLING POINT: Shows what information citizens need but isn't available
 */
router.get("/data-gaps", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const priority = req.query.priority as string;

    const where: any = {
      isDataGap: true,
      wasAnswered: false,
    };

    if (priority) {
      where.priority = priority;
    }

    const dataGaps = await prisma.informationRequest.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: [
        { requestCount: "desc" }, // Most requested first
        { requestedAt: "desc" },
      ],
      select: {
        id: true,
        topic: true,
        category: true,
        requestCount: true,
        priority: true,
        requestedAt: true,
        requesterPhone: true,
      },
    });

    const total = await prisma.informationRequest.count({ where });

    // Get most common categories for data gaps
    const categoryBreakdown = await prisma.informationRequest.groupBy({
      by: ["category"],
      where: {
        isDataGap: true,
        wasAnswered: false,
        category: { not: null },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
    });

    res.json({
      data: dataGaps,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      categoryBreakdown: categoryBreakdown.map((item) => ({
        category: item.category,
        count: item._count.id,
      })),
      summary: {
        total_data_gaps: total,
        high_priority: await prisma.informationRequest.count({
          where: { isDataGap: true, wasAnswered: false, priority: "HIGH" },
        }),
      },
    });
  } catch (error) {
    logger.error({ error }, "Error fetching data gaps");
    res.status(500).json({ error: "Failed to fetch data gaps" });
  }
});

/**
 * GET /api/analytics/data-gaps/trending
 * Most requested topics that have no answers
 * Shows what information citizens need most urgently
 * 
 * 🎯 SELLING POINT: Helps government prioritize what content to create
 */
router.get("/data-gaps/trending", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const days = parseInt(req.query.days as string) || 7;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trendingGaps = await prisma.informationRequest.findMany({
      where: {
        isDataGap: true,
        wasAnswered: false,
        requestedAt: {
          gte: startDate,
        },
      },
      take: limit,
      orderBy: [
        { requestCount: "desc" },
        { priority: "desc" },
      ],
      select: {
        id: true,
        topic: true,
        category: true,
        requestCount: true,
        priority: true,
        requestedAt: true,
        requesterPhone: true, // 👤 User who asked the question
      },
    });

    res.json({
      data: trendingGaps,
      period_days: days,
      summary: `Top ${limit} most requested topics without answers in the last ${days} days`,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching trending data gaps");
    res.status(500).json({ error: "Failed to fetch trending data gaps" });
  }
});

/**
 * GET /api/analytics/data-gaps/:id/users
 * Get all users who requested a specific data gap topic
 * Shows which citizens need this information
 * 
 * 👤 User Tracking: Know exactly who asked for missing information
 */
router.get("/data-gaps/:id/users", async (req: Request, res: Response) => {
  try {
    const gapId = parseInt(req.params.id);

    // Get the data gap details
    const dataGap = await prisma.informationRequest.findUnique({
      where: { id: gapId },
      select: {
        id: true,
        topic: true,
        category: true,
        requestCount: true,
        priority: true,
        isDataGap: true,
        wasAnswered: true,
        requestedAt: true,
        requesterPhone: true,
      },
    });

    if (!dataGap) {
      return res.status(404).json({ error: "Data gap not found" });
    }

    // Get all users who asked about this topic
    const relatedRequests = await prisma.informationRequest.findMany({
      where: {
        topic: dataGap.topic,
        category: dataGap.category,
      },
      select: {
        id: true,
        requesterPhone: true,
        requestedAt: true,
        priority: true,
      },
      orderBy: {
        requestedAt: "desc",
      },
    });

    // Count unique users
    const uniqueUsers = new Set(relatedRequests.map(r => r.requesterPhone));

    res.json({
      dataGap: {
        ...dataGap,
        totalRequests: relatedRequests.length,
        uniqueUsers: uniqueUsers.size,
      },
      requests: relatedRequests,
      summary: {
        topic: dataGap.topic,
        total_requests: relatedRequests.length,
        unique_users: uniqueUsers.size,
        first_requested: relatedRequests[relatedRequests.length - 1]?.requestedAt,
        last_requested: relatedRequests[0]?.requestedAt,
      },
    });
  } catch (error) {
    logger.error({ error }, "Error fetching data gap users");
    res.status(500).json({ error: "Failed to fetch data gap users" });
  }
});

/**
 * GET /api/analytics/data-gaps/by-user/:phone
 * Get all data gaps requested by a specific user
 * Track what a particular citizen has been asking about
 * 
 * 👤 User Profile: See all unanswered questions from a specific citizen
 */
router.get("/data-gaps/by-user/:phone", async (req: Request, res: Response) => {
  try {
    const phone = req.params.phone;

    const userDataGaps = await prisma.informationRequest.findMany({
      where: {
        requesterPhone: phone,
        isDataGap: true,
        wasAnswered: false,
      },
      orderBy: {
        requestedAt: "desc",
      },
      select: {
        id: true,
        topic: true,
        category: true,
        ministry: true,
        priority: true,
        requestedAt: true,
        requestCount: true,
      },
    });

    const totalRequests = userDataGaps.length;
    const categories = [...new Set(userDataGaps.map(g => g.category).filter(Boolean))];

    res.json({
      phone,
      data_gaps: userDataGaps,
      summary: {
        total_unanswered_requests: totalRequests,
        categories_interested: categories,
        first_request: userDataGaps[userDataGaps.length - 1]?.requestedAt,
        last_request: userDataGaps[0]?.requestedAt,
      },
    });
  } catch (error) {
    logger.error({ error }, "Error fetching user data gaps");
    res.status(500).json({ error: "Failed to fetch user data gaps" });
  }
});

export default router;
