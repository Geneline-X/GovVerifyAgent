import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { logger } from "../logger";

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/citizen-engagement/overview
 * Overview of citizen engagement metrics
 */
router.get("/overview", async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's stats
    const stats = await prisma.dailyStatistics.findUnique({
      where: { date: today },
    });

    // Get total users
    const totalUsers = await prisma.user.count();
    
    // Get active users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const activeUsersCount = await prisma.user.count({
      where: {
        lastActiveAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    // Get total activities
    const totalActivities = await prisma.activityLog.count();

    res.json({
      total_users: totalUsers,
      active_users_7_days: activeUsersCount,
      new_users_today: stats?.newUsers || 0,
      total_activities: totalActivities,
      engagement_rate: totalUsers > 0 ? Math.round((activeUsersCount / totalUsers) * 100 * 10) / 10 : 0,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching citizen engagement overview");
    res.status(500).json({ error: "Failed to fetch engagement overview" });
  }
});

/**
 * GET /api/citizen-engagement/daily-active-users
 * Daily active users trend (line chart)
 * Query params: ?days=30
 */
router.get("/daily-active-users", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const stats = await prisma.dailyStatistics.findMany({
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
        activeUsers: true,
        newUsers: true,
      },
    });

    res.json({ data: stats, days });
  } catch (error) {
    logger.error({ error }, "Error fetching daily active users");
    res.status(500).json({ error: "Failed to fetch daily active users" });
  }
});

/**
 * GET /api/citizen-engagement/user-roles
 * Distribution of user roles (pie chart)
 */
router.get("/user-roles", async (req: Request, res: Response) => {
  try {
    const roleDistribution = await prisma.user.groupBy({
      by: ["role"],
      _count: {
        id: true,
      },
    });

    const total = roleDistribution.reduce((sum, item) => sum + item._count.id, 0);

    const data = roleDistribution.map((item) => ({
      role: item.role,
      count: item._count.id,
      percentage: total > 0 ? Math.round((item._count.id / total) * 100 * 10) / 10 : 0,
    }));

    res.json({ data, total });
  } catch (error) {
    logger.error({ error }, "Error fetching user roles");
    res.status(500).json({ error: "Failed to fetch user roles" });
  }
});

/**
 * GET /api/citizen-engagement/top-users
 * Most active users (leaderboard)
 * Query params: ?limit=10
 */
router.get("/top-users", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    // Count activities per user
    const userActivities = await prisma.activityLog.groupBy({
      by: ["userPhone"],
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

    // Get user details
    const phoneNumbers = userActivities.map((ua) => ua.userPhone);
    const users = await prisma.user.findMany({
      where: {
        phoneE164: {
          in: phoneNumbers,
        },
      },
      select: {
        phoneE164: true,
        name: true,
        role: true,
      },
    });

    // Combine data
    const data = userActivities.map((ua) => {
      const user = users.find((u) => u.phoneE164 === ua.userPhone);
      return {
        phone: ua.userPhone,
        name: user?.name || "Unknown",
        role: user?.role || "CITIZEN",
        activity_count: ua._count.id,
      };
    });

    res.json({ data, limit });
  } catch (error) {
    logger.error({ error }, "Error fetching top users");
    res.status(500).json({ error: "Failed to fetch top users" });
  }
});

/**
 * GET /api/citizen-engagement/recent-activities
 * Recent user activities (table)
 * Query params: ?limit=50&offset=0
 */
router.get("/recent-activities", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const activities = await prisma.activityLog.findMany({
      take: limit,
      skip: offset,
      orderBy: {
        timestamp: "desc",
      },
      select: {
        id: true,
        action: true,
        userPhone: true,
        details: true,
        timestamp: true,
      },
    });

    const total = await prisma.activityLog.count();

    res.json({
      data: activities,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching recent activities");
    res.status(500).json({ error: "Failed to fetch recent activities" });
  }
});

/**
 * GET /api/citizen-engagement/activity-breakdown
 * Activity type breakdown (pie chart)
 */
router.get("/activity-breakdown", async (req: Request, res: Response) => {
  try {
    const breakdown = await prisma.activityLog.groupBy({
      by: ["action"],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
    });

    const total = breakdown.reduce((sum, item) => sum + item._count.id, 0);

    const data = breakdown.map((item) => ({
      action: item.action,
      count: item._count.id,
      percentage: total > 0 ? Math.round((item._count.id / total) * 100 * 10) / 10 : 0,
    }));

    res.json({ data, total });
  } catch (error) {
    logger.error({ error }, "Error fetching activity breakdown");
    res.status(500).json({ error: "Failed to fetch activity breakdown" });
  }
});

/**
 * GET /api/citizen-engagement/user-feedback
 * User feedback statistics
 */
router.get("/user-feedback", async (req: Request, res: Response) => {
  try {
    const totalFeedback = await prisma.userFeedback.count();
    
    const positiveFeedback = await prisma.userFeedback.count({
      where: {
        isCorrect: true,
      },
    });

    const negativeFeedback = await prisma.userFeedback.count({
      where: {
        isCorrect: false,
      },
    });

    const withComments = await prisma.userFeedback.count({
      where: {
        comment: {
          not: null,
        },
      },
    });

    res.json({
      total_feedback: totalFeedback,
      positive_feedback: positiveFeedback,
      negative_feedback: negativeFeedback,
      with_comments: withComments,
      satisfaction_rate: totalFeedback > 0 ? Math.round((positiveFeedback / totalFeedback) * 100 * 10) / 10 : 0,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching user feedback");
    res.status(500).json({ error: "Failed to fetch user feedback" });
  }
});

export default router;
