import { logger } from "../logger";
import { locationValidator } from "../location-validator";
import type { ToolDefinition, ToolHandler } from "./types";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

type NationalCategory =
  | "Water & Sanitation"
  | "Electricity"
  | "Road Transport"
  | "Health"
  | "Security"
  | "Education"
  | "Waste Management"
  | "Housing"
  | "Environment"
  | "Administrative / Government Service Delay";

interface CategoryDefinition {
  name: NationalCategory;
  ministry: string;
  keywords: string[];
}

const NATIONAL_TAXONOMY: CategoryDefinition[] = [
  {
    name: "Water & Sanitation",
    ministry: "Ministry of Water Resources / Local Water & Sanitation Department",
    keywords: [
      "water",
      "pipe",
      "tap",
      "borehole",
      "well",
      "sewage",
      "toilet",
      "sanitation",
      "drain",
      "drainage",
      "flood",
      "leak",
    ],
  },
  {
    name: "Electricity",
    ministry: "Ministry of Power / Local Electricity Distribution Company",
    keywords: [
      "electric",
      "electricity",
      "power",
      "transformer",
      "cable",
      "wire",
      "light",
      "blackout",
      "outage",
      "pole",
    ],
  },
  {
    name: "Road Transport",
    ministry: "Ministry of Works & Transport / Roads and Highways Department",
    keywords: [
      "road",
      "street",
      "highway",
      "bridge",
      "pothole",
      "traffic",
      "junction",
      "roundabout",
      "speed bump",
      "sidewalk",
      "crosswalk",
    ],
  },
  {
    name: "Health",
    ministry: "Ministry of Health / Local Health Directorate",
    keywords: [
      "hospital",
      "clinic",
      "health",
      "nurse",
      "doctor",
      "medicine",
      "drug",
      "vaccine",
      "ambulance",
      "infection",
    ],
  },
  {
    name: "Security",
    ministry: "Ministry of Interior / Police Service / Local Security Office",
    keywords: [
      "theft",
      "robbery",
      "armed",
      "attack",
      "violence",
      "assault",
      "rape",
      "kidnap",
      "gang",
      "crime",
      "security",
      "fight",
    ],
  },
  {
    name: "Education",
    ministry: "Ministry of Education / Local School Management",
    keywords: [
      "school",
      "teacher",
      "student",
      "pupil",
      "classroom",
      "exam",
      "university",
      "college",
      "education",
    ],
  },
  {
    name: "Waste Management",
    ministry: "Municipal Waste Management Department / Sanitation Authority",
    keywords: [
      "waste",
      "garbage",
      "trash",
      "refuse",
      "dump",
      "dumping",
      "landfill",
      "bin",
      "rubbish",
      "litter",
    ],
  },
  {
    name: "Housing",
    ministry: "Ministry of Housing & Urban Development / Local Housing Authority",
    keywords: [
      "house",
      "housing",
      "apartment",
      "rent",
      "evict",
      "eviction",
      "tenant",
      "landlord",
      "building",
      "collapse",
      "structure",
    ],
  },
  {
    name: "Environment",
    ministry: "Ministry of Environment / Environmental Protection Agency",
    keywords: [
      "pollution",
      "smoke",
      "noise",
      "air",
      "environment",
      "tree",
      "forest",
      "erosion",
      "river",
      "stream",
      "oil spill",
    ],
  },
  {
    name: "Administrative / Government Service Delay",
    ministry: "Relevant Ministry or District Office Handling the Delayed Service",
    keywords: [
      "delay",
      "document",
      "permit",
      "license",
      "licence",
      "certificate",
      "registration",
      "passport",
      "id card",
      "queue",
      "office",
      "bureaucracy",
    ],
  },
];

async function saveImageFromBase64(base64Data: string, mimeType: string): Promise<{ url: string; mimeType: string; size: number }> {
  try {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });
    
    // Generate unique filename
    const extension = mimeType.split('/')[1] || 'bin';
    const filename = `${uuidv4()}.${extension}`;
    const filePath = path.join(uploadsDir, filename);
    
    // Convert base64 to buffer and save
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(filePath, buffer);
    
    // Return the full URL pointing to the server
    const serverUrl = process.env.SERVER_URL || 'http://localhost:3800';
    return {
      url: `${serverUrl}/uploads/${filename}`,
      mimeType,
      size: buffer.length
    };
  } catch (error) {
    logger.error({ error }, "Error saving image from base64");
    throw error;
  }
}

function classifyProblemIntoNationalTaxonomy(
  title: string,
  description: string
): { category: NationalCategory; ministry: string } {
  const text = `${title} ${description}`.toLowerCase();

  let bestMatch: CategoryDefinition | null = null;
  let bestScore = 0;

  for (const def of NATIONAL_TAXONOMY) {
    let score = 0;
    for (const kw of def.keywords) {
      if (text.includes(kw)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = def;
    }
  }

  if (!bestMatch) {
    return {
      category: "Administrative / Government Service Delay",
      ministry: "Relevant Ministry or District Office Handling the Reported Issue",
    };
  }

  return { category: bestMatch.name, ministry: bestMatch.ministry };
}

export const reportProblemTool: ToolDefinition = {
  type: "function",
  function: {
    name: "report_problem",
    description:
      "Report a new community problem. Extract title and location from user's description. Use when citizen describes an infrastructure, sanitation, utilities, or safety issue.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Brief title summarizing the problem (e.g., 'Broken water pipe', 'Uncollected garbage')",
        },
        location: {
          type: "string",
          description: "Location where the problem exists (neighborhood, street, landmark). Optional if not mentioned.",
        },
        category: {
          type: "string",
          enum: ["infrastructure", "sanitation", "utilities", "safety", "other"],
          description: "Category of the problem",
        },
        description: {
          type: "string",
          description: "Full description of the problem from the user",
        },
      },
      required: ["title", "description"],
    },
  },
};

export const reportProblemHandler: ToolHandler = async (args, context) => {
  const { title, location, category, description } = args;
  const { prisma, currentUserPhone, currentLocationContext, currentMediaContext } = context;

  try {
    logger.info(
      { phone: currentUserPhone, title, location, hasLocationShare: !!currentLocationContext?.hasLocation },
      "Creating new problem report"
    );

    let latitude: number | null = null;
    let longitude: number | null = null;
    let locationText: string | null = location || null;
    let locationVerified = false;
    let locationSource: string | null = null;
    let validationDetails = "";

    // Priority 1: WhatsApp location share (most reliable)
    if (currentLocationContext?.hasLocation && currentLocationContext.latitude && currentLocationContext.longitude) {
      latitude = currentLocationContext.latitude;
      longitude = currentLocationContext.longitude;
      locationSource = "whatsapp_share";

      // Validate and get location name
      const validation = await locationValidator.validateCoordinates(latitude, longitude);
      locationVerified = validation.confidence === "high";
      
      if (validation.normalizedName) {
        locationText = locationText || validation.normalizedName;
      }
      
      if (currentLocationContext.locationDescription) {
        locationText = currentLocationContext.locationDescription;
      }

      validationDetails = validation.details || `Location verified with ${validation.confidence} confidence`;
      logger.info(
        { latitude, longitude, locationText, confidence: validation.confidence },
        "Location from WhatsApp share validated"
      );
    }
    // Priority 2: Text-based location (validate if real place)
    else if (location) {
      locationSource = "text_extracted";
      const validation = await locationValidator.validateTextLocation(location);
      locationVerified = validation.confidence === "high";
      locationText = validation.normalizedName || location;
      validationDetails = validation.details || `Text location verified with ${validation.confidence} confidence`;
      
      logger.info(
        { location, confidence: validation.confidence, verified: locationVerified },
        "Text location validated"
      );
    }

    const classification = classifyProblemIntoNationalTaxonomy(title, description);

    // Handle image if present
    let imageData = null;
    if (currentMediaContext?.hasMedia && currentMediaContext.data) {
      try {
        logger.info(
          { phone: currentUserPhone, mimeType: currentMediaContext.mimeType },
          "Saving image for problem report"
        );
        imageData = await saveImageFromBase64(currentMediaContext.data, currentMediaContext.mimeType);
      } catch (error) {
        logger.error({ error, phone: currentUserPhone }, "Failed to save image for problem");
        // Continue without image - don't fail the whole problem report
      }
    }

    const problem = await prisma.problem.create({
      data: {
        reporterPhone: currentUserPhone,
        rawMessage: description,
        title,
        locationText,
        latitude,
        longitude,
        locationVerified,
        locationSource,
        nationalCategory: classification.category,
        recommendedOffice: classification.ministry,
        ...(imageData && {
          images: {
            create: [{
              url: imageData.url,
              mimeType: imageData.mimeType,
              size: imageData.size
            }]
          }
        })
      },
      include: {
        images: true
      }
    });

    logger.info({ problemId: problem.id, phone: currentUserPhone, locationVerified }, "Problem reported successfully");

    let message = `Problem reported successfully! Problem number: ${problem.id}.`;
    
    if (locationText) {
      message += `\n📍 Location: ${locationText}`;
      if (locationVerified) {
        message += " ✓";
      } else if (validationDetails) {
        message += ` (${validationDetails})`;
      }
    }
    message += `\n\nCategory: ${classification.category}`;
    message += `\nRecommended office: ${classification.ministry}`;

    message += "\n\nShare this number with neighbors so they can upvote.";

    return {
      success: true,
      problemId: problem.id,
      title: problem.title,
      location: problem.locationText,
      nationalCategory: classification.category,
      recommendedOffice: classification.ministry,
      coordinates: latitude && longitude ? { latitude, longitude } : undefined,
      locationVerified,
      message,
    };
  } catch (error: any) {
    logger.error({ error: error.message, phone: currentUserPhone }, "Failed to report problem");
    return {
      success: false,
      error: error.message,
      message: "Failed to report problem. Please try again.",
    };
  }
};

export const upvoteProblemTool: ToolDefinition = {
  type: "function",
  function: {
    name: "upvote_problem",
    description:
      "Upvote an existing problem by problem ID. Use when user sends a number or says 'upvote [number]' or 'vote for problem [number]'.",
    parameters: {
      type: "object",
      properties: {
        problemId: {
          type: "number",
          description: "The problem ID number to upvote",
        },
      },
      required: ["problemId"],
    },
  },
};

export const upvoteProblemHandler: ToolHandler = async (args, context) => {
  const { problemId } = args;
  const { prisma, currentUserPhone } = context;

  try {
    logger.info({ phone: currentUserPhone, problemId }, "Upvoting problem");

    const result = await prisma.$transaction(async (tx: any) => {
      const existing = await tx.problemUpvote.findUnique({
        where: {
          problemId_voterPhone: {
            problemId,
            voterPhone: currentUserPhone,
          },
        },
      });

      if (existing) {
        const problem = await tx.problem.findUnique({ where: { id: problemId } });
        return { problem, alreadyVoted: true };
      }

      await tx.problemUpvote.create({
        data: {
          problemId,
          voterPhone: currentUserPhone,
        },
      });

      const problem = await tx.problem.update({
        where: { id: problemId },
        data: {
          upvoteCount: { increment: 1 },
        },
      });

      return { problem, alreadyVoted: false };
    });

    if (!result.problem) {
      return {
        success: false,
        message: `Problem ${problemId} not found. Please check the number and try again.`,
      };
    }

    if (result.alreadyVoted) {
      return {
        success: true,
        alreadyVoted: true,
        problemId: result.problem.id,
        title: result.problem.title,
        upvoteCount: result.problem.upvoteCount,
        message: `You already upvoted problem ${result.problem.id}: ${result.problem.title}. Current upvotes: ${result.problem.upvoteCount}.`,
      };
    }

    logger.info({ problemId, upvoteCount: result.problem.upvoteCount }, "Upvote recorded");

    return {
      success: true,
      alreadyVoted: false,
      problemId: result.problem.id,
      title: result.problem.title,
      upvoteCount: result.problem.upvoteCount,
      message: `Your upvote has been recorded for problem ${result.problem.id}: ${result.problem.title}. Total upvotes: ${result.problem.upvoteCount}.`,
    };
  } catch (error: any) {
    logger.error({ error: error.message, problemId }, "Failed to upvote problem");
    return {
      success: false,
      error: error.message,
      message: "Failed to record your upvote. Please try again.",
    };
  }
};

export const listTopProblemsTool: ToolDefinition = {
  type: "function",
  function: {
    name: "list_top_problems",
    description:
      "List the top problems by upvote count. Use when user asks to see trending problems, top issues, or what others are reporting.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of problems to return (default 10, max 20)",
          default: 10,
        },
        location: {
          type: "string",
          description: "Optional: filter by location (neighborhood, district)",
        },
      },
      required: [],
    },
  },
};

export const listTopProblemsHandler: ToolHandler = async (args, context) => {
  const { limit = 10, location } = args;
  const { prisma } = context;

  try {
    const actualLimit = Math.min(Math.max(limit, 1), 20);

    logger.info({ limit: actualLimit, location }, "Fetching top problems");

    const where = location
      ? {
          locationText: {
            contains: location,
            mode: "insensitive" as const,
          },
        }
      : {};

    const problems = await prisma.problem.findMany({
      where,
      orderBy: { upvoteCount: "desc" },
      take: actualLimit,
      select: {
        id: true,
        title: true,
        locationText: true,
        upvoteCount: true,
        createdAt: true,
      },
    });

    if (problems.length === 0) {
      return {
        success: true,
        problems: [],
        message: location
          ? `No problems found in ${location}.`
          : "No problems have been reported yet. Be the first to report an issue!",
      };
    }

    return {
      success: true,
      problems,
      count: problems.length,
      message: `Found ${problems.length} problem${problems.length > 1 ? "s" : ""}`,
    };
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to list problems");
    return {
      success: false,
      error: error.message,
      message: "Failed to fetch problems. Please try again.",
    };
  }
};

export const getProblemDetailsTool: ToolDefinition = {
  type: "function",
  function: {
    name: "get_problem_details",
    description: "Get detailed information about a specific problem by its ID number.",
    parameters: {
      type: "object",
      properties: {
        problemId: {
          type: "number",
          description: "The problem ID to get details for",
        },
      },
      required: ["problemId"],
    },
  },
};

export const getProblemDetailsHandler: ToolHandler = async (args, context) => {
  const { problemId } = args;
  const { prisma } = context;

  try {
    logger.info({ problemId }, "Fetching problem details");

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      include: {
        upvotes: {
          select: {
            voterPhone: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        },
      },
    });

    if (!problem) {
      return {
        success: false,
        message: `Problem ${problemId} not found.`,
      };
    }

    return {
      success: true,
      problem: {
        id: problem.id,
        title: problem.title,
        location: problem.locationText,
        description: problem.rawMessage,
        upvoteCount: problem.upvoteCount,
        reportedAt: problem.createdAt,
        reporterPhone: problem.reporterPhone,
        recentUpvotes: problem.upvotes,
      },
      message: `Problem ${problem.id}: ${problem.title}`,
    };
  } catch (error: any) {
    logger.error({ error: error.message, problemId }, "Failed to fetch problem details");
    return {
      success: false,
      error: error.message,
      message: "Failed to fetch problem details. Please try again.",
    };
  }
};

export const updateProblemLocationTool: ToolDefinition = {
  type: "function",
  function: {
    name: "update_problem_location",
    description:
      "Update the location of an existing problem report. Use this when a user shares their location after reporting a problem without location.",
    parameters: {
      type: "object",
      properties: {
        problemId: {
          type: "number",
          description: "The problem ID to update with location",
        },
      },
      required: ["problemId"],
    },
  },
};

export const updateProblemLocationHandler: ToolHandler = async (args, context) => {
  const { problemId } = args;
  const { prisma, currentUserPhone, currentLocationContext } = context;

  try {
    logger.info({ phone: currentUserPhone, problemId }, "Updating problem location");

    const problem = await prisma.problem.findUnique({ where: { id: problemId } });

    if (!problem) {
      return {
        success: false,
        message: `Problem ${problemId} not found.`,
      };
    }

    if (problem.reporterPhone !== currentUserPhone) {
      return {
        success: false,
        message: "You can only update your own problem reports.",
      };
    }

    let latitude: number | null = null;
    let longitude: number | null = null;
    let locationText = problem.locationText;
    let locationVerified = false;
    let locationSource: string | null = null;

    if (currentLocationContext?.hasLocation && currentLocationContext.latitude && currentLocationContext.longitude) {
      latitude = currentLocationContext.latitude;
      longitude = currentLocationContext.longitude;
      locationSource = "whatsapp_share";

      const validation = await locationValidator.validateCoordinates(latitude, longitude);
      locationVerified = validation.confidence === "high";

      if (validation.normalizedName) {
        locationText = validation.normalizedName;
      }

      if (currentLocationContext.locationDescription) {
        locationText = currentLocationContext.locationDescription;
      }

      logger.info(
        { latitude, longitude, locationText, confidence: validation.confidence },
        "Location validated for update"
      );
    } else {
      return {
        success: false,
        message: "No location data available to update.",
      };
    }

    const updatedProblem = await prisma.problem.update({
      where: { id: problemId },
      data: {
        latitude,
        longitude,
        locationText,
        locationVerified,
        locationSource,
      },
    });

    logger.info({ problemId, locationVerified }, "Problem location updated successfully");

    let message = `Location updated for problem ${problemId}: ${updatedProblem.title}`;
    if (locationText) {
      message += `\n📍 Location: ${locationText}`;
      if (locationVerified) {
        message += " ✓";
      }
    }

    return {
      success: true,
      problemId: updatedProblem.id,
      title: updatedProblem.title,
      location: updatedProblem.locationText,
      coordinates: { latitude, longitude },
      locationVerified,
      message,
    };
  } catch (error: any) {
    logger.error({ error: error.message, problemId }, "Failed to update problem location");
    return {
      success: false,
      error: error.message,
      message: "Failed to update location. Please try again.",
    };
  }
};

export const getUserRecentProblemsTool: ToolDefinition = {
  type: "function",
  function: {
    name: "get_user_recent_problems",
    description:
      "Get the most recent problems reported by the current user. Use this to check if user has recently reported problems before creating duplicates.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of recent problems to return (default 3, max 10)",
          default: 3,
        },
      },
      required: [],
    },
  },
};

export const getUserRecentProblemsHandler: ToolHandler = async (args, context) => {
  const { limit = 3 } = args;
  const { prisma, currentUserPhone } = context;

  try {
    const actualLimit = Math.min(Math.max(limit, 1), 10);

    logger.info({ phone: currentUserPhone, limit: actualLimit }, "Fetching user recent problems");

    const problems = await prisma.problem.findMany({
      where: {
        reporterPhone: currentUserPhone,
      },
      orderBy: { createdAt: "desc" },
      take: actualLimit,
      select: {
        id: true,
        title: true,
        locationText: true,
        latitude: true,
        longitude: true,
        locationVerified: true,
        upvoteCount: true,
        createdAt: true,
      },
    });

    if (problems.length === 0) {
      return {
        success: true,
        problems: [],
        message: "You haven't reported any problems yet.",
      };
    }

    return {
      success: true,
      problems,
      count: problems.length,
      message: `Found ${problems.length} recent problem${problems.length > 1 ? "s" : ""}`,
    };
  } catch (error: any) {
    logger.error({ error: error.message, phone: currentUserPhone }, "Failed to fetch user recent problems");
    return {
      success: false,
      error: error.message,
      message: "Failed to fetch your recent problems.",
    };
  }
};

export const updateProblemDescriptionTool: ToolDefinition = {
  type: "function",
  function: {
    name: "update_problem_description",
    description:
      "Update the location description or title of an existing problem. Use this when a user wants to add more details or correct their problem report.",
    parameters: {
      type: "object",
      properties: {
        problemId: {
          type: "number",
          description: "The problem ID to update",
        },
        locationText: {
          type: "string",
          description: "User-provided location description (e.g., 'near the big tree', 'in front of mosque')",
        },
        title: {
          type: "string",
          description: "Updated problem title (optional)",
        },
      },
      required: ["problemId"],
    },
  },
};

export const updateProblemDescriptionHandler: ToolHandler = async (args, context) => {
  const { problemId, locationText, title } = args;
  const { prisma, currentUserPhone } = context;

  try {
    logger.info({ phone: currentUserPhone, problemId, locationText, title }, "Updating problem description");

    const problem = await prisma.problem.findUnique({ where: { id: problemId } });

    if (!problem) {
      return {
        success: false,
        message: `Problem ${problemId} not found.`,
      };
    }

    if (problem.reporterPhone !== currentUserPhone) {
      return {
        success: false,
        message: "You can only update your own problem reports.",
      };
    }

    const updateData: any = {};
    if (locationText) updateData.locationText = locationText;
    if (title) updateData.title = title;

    if (Object.keys(updateData).length === 0) {
      return {
        success: false,
        message: "No updates provided.",
      };
    }

    const updatedProblem = await prisma.problem.update({
      where: { id: problemId },
      data: updateData,
    });

    logger.info({ problemId }, "Problem description updated successfully");

    let message = `Problem ${problemId} updated successfully!`;
    if (title) message += `\n*Title:* ${updatedProblem.title}`;
    if (locationText) message += `\n📍 *Location:* ${updatedProblem.locationText}`;

    return {
      success: true,
      problemId: updatedProblem.id,
      title: updatedProblem.title,
      location: updatedProblem.locationText,
      message,
    };
  } catch (error: any) {
    logger.error({ error: error.message, problemId }, "Failed to update problem description");
    return {
      success: false,
      error: error.message,
      message: "Failed to update problem. Please try again.",
    };
  }
};
