import { logger } from "../logger";
import { config } from "../config";
import type { ToolDefinition, ToolHandler } from "./types";
import axios from "axios";

// ==================== VERIFY INFORMATION ====================

export const verifyInformationTool: ToolDefinition = {
  type: "function",
  function: {
    name: "verify_information",
    description:
      "Verify a claim or piece of information against official government sources. Use this when a user asks if something is true or forwards a suspicious message.",
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

  try {
    logger.info({ claim, category, phone: context.currentUserPhone }, "Verifying information via GenelineX RAG");

    // Query GenelineX RAG API with the claim
    let ragResponse: string;
    let confidence: string;
    let sources: string[] = [];
    let status: "VERIFIED" | "PARTIALLY_TRUE" | "FALSE" | "UNVERIFIED";

    try {
      logger.info({ claim, chatbotId: config.genelineX.chatbotId }, "Calling GenelineX RAG API");

      const response = await axios.post(
        config.genelineX.apiUrl,
        {
          chatbotId: config.genelineX.chatbotId,
          email: context.currentUserPhone || "anonymous@govverify.sl",
          message: `Verify this claim: "${claim}"\n\nCategory: ${category}\n\nPlease provide: 1) Is this true or false? 2) Official sources 3) Any relevant details.`,
        },
        {
          headers: {
            accept: "text/plain",
            Authorization: `Bearer ${config.genelineX.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      ragResponse = typeof response.data === "string" ? response.data : JSON.stringify(response.data);

      logger.info(
        {
          responseLength: ragResponse.length,
          responsePreview: ragResponse.substring(0, 200),
        },
        "GenelineX RAG response received"
      );

      // Analyze the response to determine verification status
      const responseLower = ragResponse.toLowerCase();

      if (
        responseLower.includes("verified") ||
        responseLower.includes("confirmed") ||
        responseLower.includes("true") ||
        responseLower.includes("accurate")
      ) {
        status = "VERIFIED";
        confidence = "HIGH";
      } else if (
        responseLower.includes("false") ||
        responseLower.includes("incorrect") ||
        responseLower.includes("not true") ||
        responseLower.includes("misinformation")
      ) {
        status = "FALSE";
        confidence = "HIGH";
      } else if (responseLower.includes("partially") || responseLower.includes("some truth")) {
        status = "PARTIALLY_TRUE";
        confidence = "MEDIUM";
      } else {
        status = "UNVERIFIED";
        confidence = "LOW";
      }

      // Extract sources if mentioned (simple heuristic)
      const sourceMatches = ragResponse.match(
        /(ministry|department|official|government|source|announced|press release)[^.!?]*[.!?]/gi
      );
      if (sourceMatches && sourceMatches.length > 0) {
        sources = sourceMatches.slice(0, 3); // Keep top 3 source mentions
      }
    } catch (ragError: any) {
      logger.error({ error: ragError.message, claim }, "GenelineX RAG API call failed");

      // Fallback response if RAG fails
      ragResponse = "Unable to verify this information against official sources at this time. Please check official government channels or contact relevant ministries directly.";
      status = "UNVERIFIED";
      confidence = "LOW";
    }

    // Store verification request in database
    const verification = await context.prisma.verification.create({
      data: {
        claim,
        category,
        requesterPhone: context.currentUserPhone,
        status,
        result: ragResponse,
        confidence: confidence as any,
        sources: sources.length > 0 ? JSON.stringify(sources) : null as any,
        requestedAt: new Date(),
        verifiedAt: new Date(), // Always set since we got a response from RAG
        verifiedBy: "GenelineX RAG System",
      },
    });

    logger.info({ verificationId: verification.id, status, confidence }, "Verification completed");

    // Format status emoji
    const statusEmoji = {
      VERIFIED: "✅",
      FALSE: "❌",
      PARTIALLY_TRUE: "⚠️",
      UNVERIFIED: "❓",
      PENDING: "⏳",
    };

    return {
      success: true,
      verificationId: verification.id,
      status,
      statusEmoji: statusEmoji[status],
      result: ragResponse,
      confidence,
      sources,
      checkedAt: new Date().toISOString(),
      message: `Verification complete. Status: ${status}`,
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

    // Generate temporary reference number (will update after getting ID)
    const tempRefNumber = `TH-${new Date().getFullYear()}-PENDING`;

    // Store threat report in database
    const report = await context.prisma.cyberThreatReport.create({
      data: {
        threatType,
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
