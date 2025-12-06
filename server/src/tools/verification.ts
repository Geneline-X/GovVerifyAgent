import { logger } from "../logger";
import { config } from "../config";
import type { ToolDefinition, ToolHandler } from "./types";
import axios from "axios";
import type { PrismaClient } from "@prisma/client";

// ==================== HELPER FUNCTIONS FOR REAL-TIME STATS ====================

/**
 * Update daily statistics when verification events occur
 */
async function updateDailyStatisticsForVerification(
  prisma: PrismaClient,
  status: string,
  responseTimeMs?: number
): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get or create today's stats
    let stats = await prisma.dailyStatistics.findUnique({
      where: { date: today },
    });

    if (!stats) {
      stats = await prisma.dailyStatistics.create({
        data: {
          date: today,
          totalVerifications: 0,
          verifiedTrue: 0,
          verifiedFalse: 0,
          verifiedPartial: 0,
          unverified: 0,
          totalThreats: 0,
          urgentThreats: 0,
          totalAmountLostDaily: 0,
          activeUsers: 0,
          newUsers: 0,
        },
      });
    }

    // Build update data
    const updateData: any = {
      totalVerifications: { increment: 1 },
    };

    if (status === "VERIFIED") {
      updateData.verifiedTrue = { increment: 1 };
    } else if (status === "FALSE") {
      updateData.verifiedFalse = { increment: 1 };
    } else if (status === "PARTIALLY_TRUE") {
      updateData.verifiedPartial = { increment: 1 };
    } else if (status === "UNVERIFIED") {
      updateData.unverified = { increment: 1 };
    }

    // Update average response time
    if (responseTimeMs) {
      const currentAvg = stats.avgResponseTimeMs || 0;
      const currentCount = stats.totalVerifications;
      const newAvg =
        currentCount > 0
          ? Math.round((currentAvg * currentCount + responseTimeMs) / (currentCount + 1))
          : responseTimeMs;
      updateData.avgResponseTimeMs = newAvg;
    }

    await prisma.dailyStatistics.update({
      where: { date: today },
      data: updateData,
    });
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to update daily statistics for verification");
  }
}

/**
 * Update daily statistics when threat reports are created
 */
async function updateDailyStatisticsForThreat(
  prisma: PrismaClient,
  isUrgent: boolean,
  amountLost?: number
): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get or create today's stats
    let stats = await prisma.dailyStatistics.findUnique({
      where: { date: today },
    });

    if (!stats) {
      stats = await prisma.dailyStatistics.create({
        data: {
          date: today,
          totalVerifications: 0,
          verifiedTrue: 0,
          verifiedFalse: 0,
          verifiedPartial: 0,
          unverified: 0,
          totalThreats: 0,
          urgentThreats: 0,
          totalAmountLostDaily: 0,
          activeUsers: 0,
          newUsers: 0,
        },
      });
    }

    const updateData: any = {
      totalThreats: { increment: 1 },
    };

    if (isUrgent) {
      updateData.urgentThreats = { increment: 1 };
    }

    if (amountLost && amountLost > 0) {
      updateData.totalAmountLostDaily = { increment: amountLost };
    }

    await prisma.dailyStatistics.update({
      where: { date: today },
      data: updateData,
    });
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to update daily statistics for threat");
  }
}

// ==================== VERIFY INFORMATION ====================

export const verifyInformationTool: ToolDefinition = {
  type: "function",
  function: {
    name: "verify_information",
    description:
      "ALWAYS use this tool to verify claims or answer factual questions about Sierra Leone government, policies, health (especially kush/drugs), security, finances, or any official information. Use whenever user asks 'Is this true?', 'I want to verify...', 'Can you check...', 'When did...', 'What year...', 'How much...', or asks any factual question. This queries official government sources via GenelineX RAG system. DO NOT answer factual questions from memory - ALWAYS call this tool first.",
    parameters: {
      type: "object",
      properties: {
        claim: {
          type: "string",
          description: "The claim or information to verify (e.g., 'Government is banning okada bikes')",
        },
        category: {
          type: "string",
          enum: [
            "Government Policy",
            "Health",
            "Security",
            "Financial",
            "Legal",
            "Administrative",
            "Other",
          ],
          description: "The category of information being verified",
        },
      },
      required: ["claim", "category"],
    },
  },
};

export const verifyInformationHandler: ToolHandler = async (args, context) => {
  const { claim, category } = args;
  const startTime = Date.now(); // Track response time

  try {
    logger.info({ claim, category, phone: context.currentUserPhone }, "Verifying information via GenelineX RAG");

    // Map category string to enum value
    const categoryMap: Record<string, string> = {
      "Government Policy": "GOVERNMENT_POLICY",
      "Health": "HEALTH",
      "Security": "SECURITY",
      "Financial": "FINANCIAL",
      "Legal": "LEGAL",
      "Administrative": "ADMINISTRATIVE",
      "Other": "OTHER",
    };
    
    const categoryEnum = categoryMap[category] || "OTHER";

    // Query GenelineX RAG API with the claim
    let ragResponse: string;
    let sources: any[] = [];

    try {
      logger.info({ claim, indexName: config.genelineX.indexName }, "Calling GenelineX Embeddings Search API");

      const response = await axios.post(
        config.genelineX.apiUrl,
        {
          indexName: config.genelineX.indexName,
          namespace: config.genelineX.namespace,
          query: claim,
          topK: config.genelineX.topK,
        },
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${config.genelineX.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      // Extract matches from the embeddings search response
      const matches = response.data?.matches || [];
      
      if (matches.length > 0) {
        // Build a comprehensive response from the top matches
        const topMatches = matches.slice(0, 3); // Use top 3 most relevant matches
        
        // Combine the text from matches
        const combinedText = topMatches
          .map((match: any, idx: number) => {
            const metadata = match.metadata || {};
            return `[Source ${idx + 1}] ${metadata.text || "No text available"}`;
          })
          .join("\n\n");
        
        ragResponse = `Based on official government documents:\n\n${combinedText}`;
        
        // Extract sources for database storage
        sources = topMatches.map((match: any) => {
          const metadata = match.metadata || {};
          return {
            filename: metadata.filename || "Unknown",
            sourceUrl: metadata.sourceUrl || null,
            score: match.score || 0,
            chunkIndex: metadata.chunkIndex,
          };
        });
        
        logger.info(
          {
            matchCount: matches.length,
            topScore: matches[0]?.score || 0,
            sourcesExtracted: sources.length,
          },
          "GenelineX Embeddings Search response received"
        );
      } else {
        ragResponse = "No relevant information found in government documents for this query.";
        logger.info("No matches found in embeddings search");
      }
    } catch (ragError: any) {
      logger.error({ error: ragError.message, claim }, "GenelineX Embeddings Search API call failed");

      // Fallback response if RAG fails
      ragResponse = "Unable to verify this information against official sources at this time. Please check official government channels or contact relevant ministries directly.";
    }

    // Store verification request in database with PENDING status
    // GPT will analyze the RAG response and determine the actual status
    const verification = await context.prisma.verification.create({
      data: {
        claim,
        category: categoryEnum as any,
        requesterPhone: context.currentUserPhone,
        status: "PENDING",
        result: ragResponse,
        requestedAt: new Date(),
        verifiedBy: "GenelineX RAG System",
        ragResponse,
        ragChatbotId: config.genelineX.indexName,
        ragProcessedAt: new Date(),
        sources: sources.length > 0 ? sources : undefined,
        responseTimeMs: Date.now() - startTime, // Store actual response time
      },
    });

    logger.info({ verificationId: verification.id }, "Verification request stored, awaiting GPT judgment");

    // ✅ REAL-TIME STATS: Update daily statistics for new verification
    await updateDailyStatisticsForVerification(
      context.prisma,
      "PENDING",
      Date.now() - startTime
    );

    // Return RAG response to GPT for analysis
    // GPT will read this response and decide if claim is VERIFIED, FALSE, PARTIALLY_TRUE, or UNVERIFIED
    return {
      success: true,
      verificationId: verification.id,
      ragResponse,
      claim,
      category,
      instruction: "Analyze the RAG response above. Based on the information provided, determine if the claim is VERIFIED (true), FALSE (misinformation), PARTIALLY_TRUE (mixed), or UNVERIFIED (insufficient info). Then respond to the user with your judgment and explanation.",
    };
  } catch (error: any) {
    logger.error({ error, claim }, "Error verifying information");
    return {
      success: false,
      error: error.message,
      message: "Unable to verify this information at this time. Please try again later.",
    };
  }
};

// ==================== UPDATE VERIFICATION STATUS ====================

export const updateVerificationStatusTool: ToolDefinition = {
  type: "function",
  function: {
    name: "update_verification_status",
    description:
      "Update a verification record with your judgment after analyzing the RAG response. Call this after you've determined if a claim is verified, false, partially true, or unverified.",
    parameters: {
      type: "object",
      properties: {
        verificationId: {
          type: "number",
          description: "The ID of the verification record to update",
        },
        status: {
          type: "string",
          enum: ["VERIFIED", "FALSE", "PARTIALLY_TRUE", "UNVERIFIED"],
          description: "Your judgment on the verification status",
        },
        confidence: {
          type: "string",
          enum: ["HIGH", "MEDIUM", "LOW"],
          description: "Your confidence level in this judgment",
        },
        explanation: {
          type: "string",
          description: "Brief explanation of why you made this judgment",
        },
      },
      required: ["verificationId", "status", "confidence", "explanation"],
    },
  },
};

export const updateVerificationStatusHandler: ToolHandler = async (args, context) => {
  const { verificationId, status, confidence, explanation } = args;

  try {
    logger.info({ verificationId, status, confidence }, "Updating verification status with GPT judgment");

    // Update the verification record
    await context.prisma.verification.update({
      where: { id: verificationId },
      data: {
        status,
        confidence: confidence as any,
        verifiedAt: new Date(),
        verifiedBy: "GPT-4 Analysis",
      },
    });

    logger.info({ verificationId, status }, "Verification status updated");

    return {
      success: true,
      verificationId,
      status,
      confidence,
      explanation,
      message: "Verification judgment recorded",
    };
  } catch (error: any) {
    logger.error({ error, verificationId }, "Error updating verification status");
    return {
      success: false,
      error: error.message,
    };
  }
};

// ==================== REPORT CYBER THREAT ====================

export const reportCyberThreatTool: ToolDefinition = {
  type: "function",
  function: {
    name: "report_cyber_threat",
    description:
      "Log a cyber threat, scam, or fraud report. Use this when a user describes being targeted by or witnessing a digital crime.",
    parameters: {
      type: "object",
      properties: {
        threatType: {
          type: "string",
          enum: [
            "Romance Scam",
            "Investment Fraud",
            "Impersonation",
            "Phishing",
            "Mobile Money Fraud",
            "Job Scam",
            "Lottery/Prize Scam",
            "Blackmail/Sextortion",
            "Other",
          ],
          description: "The type of cyber threat",
        },
        description: {
          type: "string",
          description: "Detailed description of what happened",
        },
        platform: {
          type: "string",
          description: "Platform where the threat occurred (e.g., Facebook, WhatsApp, SMS)",
        },
        amountLost: {
          type: "number",
          description: "Amount of money lost (in Leones), if any",
        },
        perpetratorContact: {
          type: "string",
          description: "Phone number, email, or social media handle of the perpetrator (if known)",
        },
        dateOccurred: {
          type: "string",
          description: "When the incident occurred (e.g., 'today', 'last week', '2024-12-01')",
        },
        isUrgent: {
          type: "boolean",
          description: "Whether this is an ongoing threat requiring immediate attention",
        },
      },
      required: ["threatType", "description", "platform"],
    },
  },
};

export const reportCyberThreatHandler: ToolHandler = async (args, context) => {
  const { threatType, description, platform, amountLost, perpetratorContact, dateOccurred, isUrgent } = args;

  try {
    logger.info(
      {
        threatType,
        platform,
        amountLost,
        isUrgent,
        phone: context.currentUserPhone,
      },
      "Reporting cyber threat"
    );

    // Map threat type string to enum value
    const threatTypeMap: Record<string, string> = {
      "Romance Scam": "ROMANCE_SCAM",
      "Investment Fraud": "INVESTMENT_FRAUD",
      "Impersonation": "IMPERSONATION",
      "Phishing": "PHISHING",
      "Mobile Money Fraud": "MOBILE_MONEY_FRAUD",
      "Job Scam": "JOB_SCAM",
      "Lottery/Prize Scam": "LOTTERY_PRIZE_SCAM",
      "Blackmail/Sextortion": "BLACKMAIL_SEXTORTION",
      "Other": "OTHER",
    };
    
    const threatTypeEnum = threatTypeMap[threatType] || "OTHER";

    // Generate temporary reference number (will update after getting ID)
    const tempRefNumber = `TH-${new Date().getFullYear()}-PENDING`;

    // Store threat report in database
    const report = await context.prisma.cyberThreatReport.create({
      data: {
        threatType: threatTypeEnum as any,
        description,
        platform,
        amountLost: amountLost || null,
        perpetratorContact: perpetratorContact || null,
        dateOccurred: dateOccurred || null,
        isUrgent: isUrgent || false,
        reporterPhone: context.currentUserPhone,
        status: isUrgent ? "URGENT" : "PENDING",
        reportedAt: new Date(),
        referenceNumber: tempRefNumber,
        // Store media evidence if provided
        evidenceUrls: context.currentMediaContext?.hasMedia
          ? `evidence_${Date.now()}_${context.currentUserPhone}`
          : null as any,
      },
    });

    // Generate actual reference number with ID
    const refNumber = `TH-${new Date().getFullYear()}-${report.id.toString().padStart(5, "0")}`;

    // Update with actual reference number
    await context.prisma.cyberThreatReport.update({
      where: { id: report.id },
      data: { referenceNumber: refNumber },
    });

    logger.info({ refNumber, reportId: report.id }, "Cyber threat report created");

    // ✅ REAL-TIME STATS: Update daily statistics for new threat report
    await updateDailyStatisticsForThreat(
      context.prisma,
      isUrgent,
      amountLost
    );

    return {
      success: true,
      reportId: report.id,
      referenceNumber: refNumber,
      status: isUrgent ? "URGENT - Priority Investigation" : "Logged - Under Review",
      message: isUrgent
        ? "Your urgent threat report has been logged and prioritized for immediate investigation."
        : "Your threat report has been logged. An investigator may contact you for more details.",
      reportedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    logger.error({ error, threatType }, "Error reporting cyber threat");
    return {
      success: false,
      error: error.message,
      message: "Unable to submit your report at this time. Please try again.",
    };
  }
};

// ==================== GET OFFICIAL INFORMATION ====================

export const getOfficialInfoTool: ToolDefinition = {
  type: "function",
  function: {
    name: "get_official_info",
    description:
      "Retrieve official government information on a specific topic (e.g., passport fees, office hours, requirements).",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "The topic to get official information about (e.g., 'passport fees', 'birth certificate requirements')",
        },
        ministry: {
          type: "string",
          description: "The relevant ministry or department (optional)",
        },
      },
      required: ["topic"],
    },
  },
};

export const getOfficialInfoHandler: ToolHandler = async (args, context) => {
  const { topic, ministry } = args;

  try {
    logger.info({ topic, ministry, phone: context.currentUserPhone }, "Retrieving official information");

    // TODO: Implement actual lookup from government information database
    // This would query a curated database of official information

    // Log the information request
    await context.prisma.informationRequest.create({
      data: {
        topic,
        ministry: ministry || null,
        requesterPhone: context.currentUserPhone,
        requestedAt: new Date(),
      },
    });

    return {
      success: true,
      topic,
      information: "Official information lookup in progress...",
      source: ministry || "Government of Sierra Leone",
      lastUpdated: new Date().toISOString(),
      message: "Please check back or contact the relevant ministry directly for the most current information.",
    };
  } catch (error: any) {
    logger.error({ error, topic }, "Error retrieving official information");
    return {
      success: false,
      error: error.message,
      message: "Unable to retrieve this information at this time.",
    };
  }
};

// ==================== CHECK THREAT PATTERNS ====================

export const checkThreatPatternsTool: ToolDefinition = {
  type: "function",
  function: {
    name: "check_threat_patterns",
    description:
      "Check if a phone number, account, or contact has been reported in previous scam/threat reports. Use for pattern analysis.",
    parameters: {
      type: "object",
      properties: {
        contactInfo: {
          type: "string",
          description: "Phone number, email, or social media handle to check",
        },
      },
      required: ["contactInfo"],
    },
  },
};

export const checkThreatPatternsHandler: ToolHandler = async (args, context) => {
  const { contactInfo } = args;

  try {
    logger.info({ contactInfo, phone: context.currentUserPhone }, "Checking threat patterns");

    // Search for previous reports involving this contact
    const previousReports = await context.prisma.cyberThreatReport.findMany({
      where: {
        perpetratorContact: {
          contains: contactInfo,
        },
      },
      select: {
        id: true,
        threatType: true,
        reportedAt: true,
        referenceNumber: true,
      },
      orderBy: {
        reportedAt: "desc",
      },
      take: 10,
    });

    const isKnownThreat = previousReports.length > 0;

    return {
      success: true,
      isKnownThreat,
      reportCount: previousReports.length,
      reports: previousReports,
      message: isKnownThreat
        ? `⚠️ WARNING: This contact has been reported ${previousReports.length} time(s) for cyber threats.`
        : "No previous reports found for this contact.",
    };
  } catch (error: any) {
    logger.error({ error, contactInfo }, "Error checking threat patterns");
    return {
      success: false,
      error: error.message,
      message: "Unable to check threat patterns at this time.",
    };
  }
};
