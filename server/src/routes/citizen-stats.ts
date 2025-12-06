import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { logger } from "../logger";

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/citizen-stats/overview
 * Overall citizen query statistics
 */
router.get("/overview", async (req: Request, res: Response) => {
  try {
    // Total queries (verifications + information requests)
    const totalVerifications = await prisma.verification.count();
    const totalInfoRequests = await prisma.informationRequest.count();
    const totalQueries = totalVerifications + totalInfoRequests;

    // Answered queries
    const answeredVerifications = await prisma.verification.count({
      where: {
        status: {
          not: "PENDING",
        },
      },
    });
    const answeredInfoRequests = await prisma.informationRequest.count({
      where: {
        wasAnswered: true,
      },
    });
    const totalAnswered = answeredVerifications + answeredInfoRequests;

    // Response rate
    const responseRate = totalQueries > 0 ? Math.round((totalAnswered / totalQueries) * 100 * 10) / 10 : 0;

    // Average response time
    const avgResponseTime = await prisma.verification.aggregate({
      _avg: {
        responseTimeMs: true,
      },
      where: {
        responseTimeMs: {
          not: null,
        },
      },
    });

    // Total unique citizens
    const uniqueCitizens = await prisma.user.count({
      where: {
        role: "CITIZEN",
      },
    });

    res.json({
      total_queries: totalQueries,
      total_verifications: totalVerifications,
      total_info_requests: totalInfoRequests,
      total_answered: totalAnswered,
      response_rate: responseRate,
      avg_response_time_ms: avgResponseTime._avg.responseTimeMs || 0,
      unique_citizens: uniqueCitizens,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching citizen stats overview");
    res.status(500).json({ error: "Failed to fetch citizen stats overview" });
  }
});

/**
 * GET /api/citizen-stats/top-queries
 * Most common query topics/categories
 * Query params: ?limit=10
 */
router.get("/top-queries", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    // Group verifications by category
    const verificationsByCategory = await prisma.verification.groupBy({
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

    // Group information requests by topic
    const topTopics = await prisma.informationRequest.groupBy({
      by: ["topic"],
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

    res.json({
      by_category: verificationsByCategory.map((item) => ({
        category: item.category,
        count: item._count.id,
      })),
      by_topic: topTopics.map((item) => ({
        topic: item.topic,
        count: item._count.id,
      })),
    });
  } catch (error) {
    logger.error({ error }, "Error fetching top queries");
    res.status(500).json({ error: "Failed to fetch top queries" });
  }
});

/**
 * GET /api/citizen-stats/query-trends
 * Query volume trends over time
 * Query params: ?days=30
 */
router.get("/query-trends", async (req: Request, res: Response) => {
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
        totalVerifications: true,
        activeUsers: true,
      },
    });

    res.json({ data: trends, days });
  } catch (error) {
    logger.error({ error }, "Error fetching query trends");
    res.status(500).json({ error: "Failed to fetch query trends" });
  }
});

/**
 * GET /api/citizen-stats/popular-topics
 * Most popular information request topics
 * Query params: ?limit=20
 */
router.get("/popular-topics", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;

    const topics = await prisma.informationRequest.groupBy({
      by: ["topic"],
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

    const data = topics.map((item) => ({
      topic: item.topic,
      count: item._count.id,
    }));

    res.json({ data, limit });
  } catch (error) {
    logger.error({ error }, "Error fetching popular topics");
    res.status(500).json({ error: "Failed to fetch popular topics" });
  }
});

/**
 * GET /api/citizen-stats/ministry-distribution
 * Query distribution by ministry
 */
router.get("/ministry-distribution", async (req: Request, res: Response) => {
  try {
    const distribution = await prisma.informationRequest.groupBy({
      by: ["ministry"],
      _count: {
        id: true,
      },
      where: {
        ministry: {
          not: null,
        },
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
    });

    const total = distribution.reduce((sum, item) => sum + item._count.id, 0);

    const data = distribution.map((item) => ({
      ministry: item.ministry,
      count: item._count.id,
      percentage: total > 0 ? Math.round((item._count.id / total) * 100 * 10) / 10 : 0,
    }));

    res.json({ data, total });
  } catch (error) {
    logger.error({ error }, "Error fetching ministry distribution");
    res.status(500).json({ error: "Failed to fetch ministry distribution" });
  }
});

/**
 * GET /api/citizen-stats/response-quality
 * Quality metrics for responses
 */
router.get("/response-quality", async (req: Request, res: Response) => {
  try {
    // Verifications by confidence level
    const byConfidence = await prisma.verification.groupBy({
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

    // Feedback statistics
    const totalFeedback = await prisma.userFeedback.count();
    const positiveFeedback = await prisma.userFeedback.count({
      where: {
        isCorrect: true,
      },
    });

    // Satisfaction rate
    const satisfactionRate = totalFeedback > 0 ? Math.round((positiveFeedback / totalFeedback) * 100 * 10) / 10 : 0;

    res.json({
      by_confidence: byConfidence.map((item) => ({
        confidence: item.confidence,
        count: item._count.id,
      })),
      total_feedback: totalFeedback,
      positive_feedback: positiveFeedback,
      satisfaction_rate: satisfactionRate,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching response quality");
    res.status(500).json({ error: "Failed to fetch response quality" });
  }
});

/**
 * GET /api/citizen-stats/unanswered-queries
 * Queries that haven't been answered yet
 * Query params: ?limit=20&offset=0
 */
router.get("/unanswered-queries", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Pending verifications
    const pendingVerifications = await prisma.verification.findMany({
      where: {
        status: "PENDING",
      },
      take: Math.floor(limit / 2),
      skip: offset,
      orderBy: {
        requestedAt: "asc",
      },
      select: {
        id: true,
        claim: true,
        category: true,
        requestedAt: true,
        requesterPhone: true,
      },
    });

    // Unanswered information requests
    const unansweredRequests = await prisma.informationRequest.findMany({
      where: {
        wasAnswered: false,
      },
      take: Math.floor(limit / 2),
      skip: offset,
      orderBy: {
        requestedAt: "asc",
      },
      select: {
        id: true,
        topic: true,
        category: true,
        requestedAt: true,
        requesterPhone: true,
      },
    });

    const pendingCount = await prisma.verification.count({
      where: { status: "PENDING" },
    });
    const unansweredCount = await prisma.informationRequest.count({
      where: { wasAnswered: false },
    });

    res.json({
      pending_verifications: pendingVerifications,
      unanswered_requests: unansweredRequests,
      pending_count: pendingCount,
      unanswered_count: unansweredCount,
      total_unanswered: pendingCount + unansweredCount,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching unanswered queries");
    res.status(500).json({ error: "Failed to fetch unanswered queries" });
  }
});

/**
 * GET /api/citizen-stats/peak-hours
 * Query volume by hour of day
 */
router.get("/peak-hours", async (req: Request, res: Response) => {
  try {
    const activities = await prisma.activityLog.findMany({
      select: {
        timestamp: true,
      },
    });

    // Group by hour
    const hourlyDistribution = activities.reduce((acc, activity) => {
      const hour = new Date(activity.timestamp).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Convert to array
    const data = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: hourlyDistribution[hour] || 0,
    }));

    res.json({ data });
  } catch (error) {
    logger.error({ error }, "Error fetching peak hours");
    res.status(500).json({ error: "Failed to fetch peak hours" });
  }
});

/**
 * GET /api/citizen-stats/user-retention
 * User retention metrics
 * Query params: ?days=30
 */
router.get("/user-retention", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // New users in period
    const newUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
    });

    // Returning users (active in last 7 days, created before 30 days ago)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const returningUsers = await prisma.user.count({
      where: {
        createdAt: {
          lt: startDate,
        },
        lastActiveAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    // Total users
    const totalUsers = await prisma.user.count();

    res.json({
      new_users: newUsers,
      returning_users: returningUsers,
      total_users: totalUsers,
      retention_rate: newUsers > 0 ? Math.round((returningUsers / totalUsers) * 100 * 10) / 10 : 0,
      period_days: days,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching user retention");
    res.status(500).json({ error: "Failed to fetch user retention" });
  }
});

export default router;
