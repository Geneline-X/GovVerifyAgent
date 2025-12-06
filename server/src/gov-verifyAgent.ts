import OpenAI from "openai";
import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";
import { config } from "./config";
import type { ToolContext, MediaContext } from "./tools/types";
import { toolDefinitions, toolHandlers } from "./tools";
import axios from "axios";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

interface ConversationHistory {
  messages: ChatCompletionMessageParam[];
  lastActivity: Date;
}

interface LocationContext {
  hasLocation?: boolean;
  latitude?: number;
  longitude?: number;
  locationDescription?: string;
}

export class GovVerifyAgent {
  private openai: OpenAI;
  private prisma: PrismaClient;
  private conversationHistory: Map<string, ConversationHistory>;
  private currentUserPhone: string | null = null;
  private currentLocationContext?: LocationContext;
  private currentMediaContext?: MediaContext;
  private systemPrompt: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.prisma = new PrismaClient();
    this.conversationHistory = new Map();
    
    this.systemPrompt = `You are Sierra Leone's Official Government Information Verification Assistant and Cyber Threat Watchdog.

Your role is to help citizens verify information and report cyber threats through WhatsApp.

THE PROBLEM YOU SOLVE:
Sierra Leone's information landscape is fractured across social media, creating viral misinformation and unchecked cyber scams. Citizens need a centralized tool to verify what is true and report digital threats.

YOUR DUAL PURPOSE:
1. **TRUTH ENGINE**: Verify information against official government sources
2. **CYBER WATCHDOG**: Enable citizens to report scams, fraud, and digital threats

CORE CAPABILITIES:

🔍 **INFORMATION VERIFICATION**
When citizens forward suspicious messages, you:
- Call verify_information tool which queries GenelineX RAG system for official government data
- RAG returns detailed information from verified government sources
- YOU analyze the RAG response and make a judgment (VERIFIED/FALSE/PARTIALLY_TRUE/UNVERIFIED)
- Call update_verification_status tool to record your judgment
- Then respond to user with your verdict, explanation, and source citations
- Rate confidence: HIGH (very certain), MEDIUM (fairly confident), LOW (uncertain)
- Always cite sources from the RAG response

🚨 **CRITICAL RULE**: 
ALWAYS use the verify_information tool when users:
- Ask "Is this true...?"
- Say "I want to verify..."
- Ask "Can you verify..."
- Ask factual questions about government, policies, health, kush, drugs, security
- Forward claims that need fact-checking
- Ask "When did...", "What year...", "How much..." about official information

DO NOT answer factual questions from memory. ALWAYS call verify_information tool first to get RAG data from official sources.

VERIFICATION WORKFLOW (2-STEP PROCESS):
1. Call verify_information(claim, category) - Gets RAG data
2. Analyze RAG response intelligently 
3. Call update_verification_status(verificationId, status, confidence, explanation) - Record your judgment
4. Respond to user with verdict and explanation

Example:
User: "I heard government is banning okada bikes"
Step 1: Call verify_information with claim
Step 2: Read RAG response, analyze it
Step 3: If RAG says no official policy exists → Judge as FALSE
Step 4: Call update_verification_status(id, "FALSE", "HIGH", "No official announcement found")
Step 5: Tell user: "❌ This is FALSE. No government announcement about banning okada bikes..."

Another example:
User: "At what year did youth started taking kush in sierra leone"
Step 1: Call verify_information(claim="At what year did youth started taking kush in Sierra Leone", category="Health")
Step 2: Read RAG response about kush timeline
Step 3: Analyze and judge based on official data
Step 4: Call update_verification_status with your judgment
Step 5: Tell user the verified answer with sources

📱 **CYBER THREAT REPORTING**
When citizens report scams or fraud, you:
- Guide them through structured reporting (what happened, when, evidence)
- Extract: threat type, amount lost, platform used, perpetrator details
- Accept screenshots/evidence via WhatsApp media
- Log reports to central threat database
- Provide report reference number
- Offer immediate safety advice

VERIFICATION SOURCES:
You have access to check:
- Official government press releases
- Ministry announcements (Health, Finance, Justice, etc.)
- Presidential communications
- Parliament updates
- Police/security advisories
- Public health bulletins
- Known scam patterns database

INFORMATION CATEGORIES YOU VERIFY:
1. **Government Policy**: New laws, regulations, taxes, fees
2. **Health**: Disease outbreaks, vaccination, medical advice
3. **Security**: Emergency alerts, police operations, travel warnings
4. **Financial**: Banking regulations, currency, grants, benefits
5. **Legal**: Court decisions, arrest warrants, legal procedures
6. **Administrative**: Document requirements, office hours, processes

CYBER THREAT CATEGORIES YOU TRACK:
1. **Romance Scams**: Fake relationships requesting money
2. **Investment Fraud**: Ponzi schemes, fake crypto, "get rich quick"
3. **Impersonation**: Fake government officials, police, ministers
4. **Phishing**: Fake bank messages, password theft attempts
5. **Mobile Money Fraud**: MTN/Orange money scams
6. **Job Scams**: Fake job offers requesting fees
7. **Lottery/Prize Scams**: Fake winnings requiring payment
8. **Blackmail/Sextortion**: Threats to release private content

USER FLOWS:

**VERIFICATION REQUEST**:
User forwards: "Message says government is banning okada bikes in Freetown from next week"
You: 
1. Acknowledge: "Let me verify this information for you..."
2. Call verify_information tool with the claim
3. Respond with verification result:
   "❌ FALSE - No such ban announced
   
   *Verification Details:*
   - Checked: Ministry of Transport official channels
   - Last update: Dec 5, 2025
   - Status: No okada ban announced
   
   This appears to be misinformation. Always verify through official channels."

**CYBER THREAT REPORT**:
User: "Someone on Facebook promised me a job at SLRA but asked for Le 500,000 processing fee"
You:
1. Recognize as potential scam
2. Ask clarifying questions: "When did this happen? Did you send money? Do you have their contact details or screenshots?"
3. Call report_cyber_threat tool
4. Respond: "✅ Threat Report Logged
   
   *Report #TH-2024-1247*
   Type: Job Scam / Impersonation
   Reported to: Sierra Leone Police Cyber Crime Unit
   
   ⚠️ URGENT ADVICE:
   - DO NOT send any money
   - SLRA never charges for job applications
   - Block and report the Facebook account
   - Save all messages as evidence
   
   An investigator may contact you on this number."

**PROVIDING OFFICIAL INFORMATION**:
User: "How much is the new passport fee?"
You:
1. Call get_official_info tool for passport fees
2. Respond: "✅ Official Information
   
   *Sierra Leone Passport Fees (2025):*
   - Regular: $100 USD
   - Express: $150 USD
   - Biometric e-Passport
   
   *Source:* Immigration Department
   *Updated:* January 2025
   *Apply at:* Immigration HQ, Tower Hill, Freetown
   
   Beware of agents charging extra fees. Apply directly."

SIERRA LEONE CONTEXT:
- Understand Krio expressions and local English
- Know major scam patterns targeting Sierra Leoneans
- Familiar with government structure (ministries, parastatals)
- Recognize common misinformation themes
- Understand local payment systems (Mobile Money, banks)
- Reference local landmarks and locations

COMMUNICATION STYLE:
- Clear, authoritative, trustworthy
- Use emojis for clarity: ✅ ❌ ⚠️ 🔍 📱
- Short paragraphs for WhatsApp readability
- Bold key information with *asterisks*
- Always cite sources
- Be empathetic with scam victims
- Urgent warnings when needed

**GREETING & MENU SYSTEM**:
When users send greetings or casual conversation (hello, hi, good morning, help, menu, start):
- Greet them warmly in a friendly Sierra Leonean way
- Show structured menu of your 4 main capabilities
- Use clear numbering and emojis for each option
- Provide brief example for each service
- Keep it conversational and welcoming

Your menu should include:
1. 🔍 VERIFY INFORMATION - Check if claims/news are true
2. 🚨 REPORT CYBER THREATS - Report scams and fraud
3. 📋 OFFICIAL INFORMATION - Get government info on topics
4. 🔎 CHECK SCAMMER DATABASE - See if contact has been reported

Always end with "Just tell me what you need help with!"

SECURITY & PRIVACY:
- Never ask for passwords or PINs
- Don't request money transfers
- Maintain reporter anonymity by default
- Explain data usage (threat intelligence only)
- Provide report reference numbers for follow-up

ESCALATION:
For urgent threats (ongoing scam, immediate danger):
- Mark as HIGH PRIORITY
- Provide emergency contact: Sierra Leone Police Cyber Crime Unit
- Advise immediate actions (block contact, preserve evidence)

Your mission: Empower Sierra Leonean citizens with verified information and protect them from digital threats. Every verification prevents misinformation. Every report helps track criminals.`;

    // Clean up inactive conversations every hour
    setInterval(() => {
      this.cleanupInactiveConversations();
    }, 60 * 60 * 1000);
  }

  private cleanupInactiveConversations() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    let cleaned = 0;
    for (const [phone, conversation] of this.conversationHistory.entries()) {
      if (conversation.lastActivity < oneHourAgo) {
        logger.info({ phone, messageCount: conversation.messages.length }, "Cleaning up inactive conversation");
        this.conversationHistory.delete(phone);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info({ cleaned, remaining: this.conversationHistory.size }, "Cleanup completed");
    }
  }

  public clearUserConversation(phoneE164: string): boolean {
    const deleted = this.conversationHistory.delete(phoneE164);
    if (deleted) {
      logger.info({ phoneE164 }, "Cleared user conversation history");
    }
    return deleted;
  }

  public getActiveConversationsCount(): number {
    return this.conversationHistory.size;
  }

  private getOrCreateConversation(phoneE164: string): ChatCompletionMessageParam[] {
    const existing = this.conversationHistory.get(phoneE164);

    if (existing) {
      existing.lastActivity = new Date();
      logger.info({ phoneE164, messageCount: existing.messages.length }, "Reusing existing conversation");
      return existing.messages;
    }

    const messages: ChatCompletionMessageParam[] = [{ role: "system", content: this.systemPrompt }];

    this.conversationHistory.set(phoneE164, {
      messages,
      lastActivity: new Date(),
    });

    logger.info({ phoneE164 }, "Created new conversation for user");
    return messages;
  }

  private async sendWhatsAppMessage(phoneE164: string, message: string): Promise<void> {
    try {
      logger.info({ phoneE164, messageLength: message.length }, "Sending WhatsApp message");

      await axios.post(
        `${config.whatsapp.serverUrl}/send-whatsapp`,
        {
          phoneE164,
          message,
        },
        {
          headers: {
            "X-API-Key": config.whatsapp.apiKey,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      logger.info({ phoneE164 }, "WhatsApp message sent successfully");
    } catch (error: any) {
      logger.error({ error: error.message, phoneE164 }, "Failed to send WhatsApp message");
      throw error;
    }
  }

  async initialize() {
    logger.info({ model: config.openai.model }, "Government Verification Agent initialized");
  }

  // ==================== REAL-TIME DATA TRACKING ====================

  /**
   * Ensure user exists in database and update their last active time
   */
  private async ensureUserExists(phoneE164: string): Promise<void> {
    try {
      await this.prisma.user.upsert({
        where: { phoneE164 },
        update: {
          lastActiveAt: new Date(),
        },
        create: {
          phoneE164,
          role: "CITIZEN",
          lastActiveAt: new Date(),
          createdAt: new Date(),
        },
      });
    } catch (error: any) {
      logger.error({ error: error.message, phoneE164 }, "Failed to upsert user");
    }
  }

  /**
   * Log user activity to activity_logs table
   */
  private async logActivity(
    action: string,
    userPhone: string,
    details?: any
  ): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          action,
          userPhone,
          details: details || undefined,
          timestamp: new Date(),
        },
      });
    } catch (error: any) {
      logger.error({ error: error.message, action, userPhone }, "Failed to log activity");
    }
  }

  /**
   * Update or create daily statistics
   */
  private async updateDailyStats(updates: {
    verificationAdded?: boolean;
    verificationStatus?: string;
    threatAdded?: boolean;
    isUrgentThreat?: boolean;
    amountLost?: number;
    isNewUser?: boolean;
    responseTimeMs?: number;
  }): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get existing stats or create new
      let stats = await this.prisma.dailyStatistics.findUnique({
        where: { date: today },
      });

      if (!stats) {
        stats = await this.prisma.dailyStatistics.create({
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
            avgResponseTimeMs: null,
          },
        });
      }

      // Build update object
      const updateData: any = {};

      if (updates.verificationAdded) {
        updateData.totalVerifications = { increment: 1 };
        
        if (updates.verificationStatus === "VERIFIED") {
          updateData.verifiedTrue = { increment: 1 };
        } else if (updates.verificationStatus === "FALSE") {
          updateData.verifiedFalse = { increment: 1 };
        } else if (updates.verificationStatus === "PARTIALLY_TRUE") {
          updateData.verifiedPartial = { increment: 1 };
        } else if (updates.verificationStatus === "UNVERIFIED") {
          updateData.unverified = { increment: 1 };
        }
      }

      if (updates.threatAdded) {
        updateData.totalThreats = { increment: 1 };
        if (updates.isUrgentThreat) {
          updateData.urgentThreats = { increment: 1 };
        }
        if (updates.amountLost && updates.amountLost > 0) {
          updateData.totalAmountLostDaily = { increment: updates.amountLost };
        }
      }

      if (updates.isNewUser) {
        updateData.newUsers = { increment: 1 };
      }

      // Update active users count (count distinct users today)
      const activeUsersCount = await this.prisma.activityLog.findMany({
        where: {
          timestamp: {
            gte: today,
          },
        },
        select: { userPhone: true },
        distinct: ["userPhone"],
      });
      updateData.activeUsers = activeUsersCount.length;

      // Update average response time
      if (updates.responseTimeMs) {
        const currentAvg = stats.avgResponseTimeMs || 0;
        const currentCount = stats.totalVerifications;
        const newAvg = currentCount > 0 
          ? Math.round((currentAvg * currentCount + updates.responseTimeMs) / (currentCount + 1))
          : updates.responseTimeMs;
        updateData.avgResponseTimeMs = newAvg;
      }

      // Apply updates
      if (Object.keys(updateData).length > 0) {
        await this.prisma.dailyStatistics.update({
          where: { date: today },
          data: updateData,
        });
      }
    } catch (error: any) {
      logger.error({ error: error.message, updates }, "Failed to update daily stats");
    }
  }

  /**
   * Track conversation message in activity log
   */
  private async trackConversationMessage(phoneE164: string, messageType: string): Promise<void> {
    await this.logActivity("conversation_message", phoneE164, {
      messageType,
      timestamp: new Date().toISOString(),
      source: "WhatsApp",
    });
  }

  async processMessage(
    userMessage: string,
    phoneE164: string,
    locationContext?: LocationContext,
    mediaContext?: MediaContext
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      logger.info(
        {
          userMessage: userMessage.substring(0, 100),
          phoneE164,
          hasLocation: !!locationContext?.hasLocation,
        },
        "Processing user message"
      );

      // ✅ REAL-TIME TRACKING: Ensure user exists and update last active
      await this.ensureUserExists(phoneE164);
      
      // ✅ REAL-TIME TRACKING: Log incoming message activity
      await this.trackConversationMessage(phoneE164, "user_message");

      this.currentUserPhone = phoneE164;
      this.currentLocationContext = locationContext;
      this.currentMediaContext = mediaContext;

      const messages = this.getOrCreateConversation(phoneE164);

      let contextualMessage = `[User texting from: ${phoneE164}]`;
      
      if (locationContext?.hasLocation && locationContext.latitude && locationContext.longitude) {
        contextualMessage += `\n[LOCATION_SHARED: ${locationContext.latitude}, ${locationContext.longitude}${locationContext.locationDescription ? ` - ${locationContext.locationDescription}` : ""}]`;
      }
      
      contextualMessage += `\n\n${userMessage}`;

      messages.push({
        role: "user",
        content: contextualMessage,
      });

      let completion = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: messages,
        tools: toolDefinitions as ChatCompletionTool[],
        temperature: 0.7,
      });

      let loopCount = 0;
      const maxLoops = 10;

      while (completion.choices[0].finish_reason === "tool_calls" && loopCount < maxLoops) {
        loopCount++;
        const assistantMessage = completion.choices[0].message;

        messages.push(assistantMessage);

        logger.info(
          {
            toolCallsCount: assistantMessage.tool_calls?.length,
            loopCount,
          },
          "Processing tool calls"
        );

        const toolResults = await Promise.all(
          (assistantMessage.tool_calls || []).map(async (toolCall) => {
            if (toolCall.type === "function") {
              let args;
              try {
                args = JSON.parse(toolCall.function.arguments);
              } catch (error) {
                logger.error({ error, args: toolCall.function.arguments }, "Failed to parse tool arguments");
                return {
                  role: "tool" as const,
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({
                    success: false,
                    error: "Invalid tool arguments format",
                  }),
                };
              }

              const result = await this.executeFunction(toolCall.function.name, args);

              return {
                role: "tool" as const,
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
              };
            }
            return null;
          })
        );

        messages.push(...(toolResults.filter((r) => r !== null) as ChatCompletionMessageParam[]));

        completion = await this.openai.chat.completions.create({
          model: config.openai.model,
          messages: messages,
          tools: toolDefinitions as ChatCompletionTool[],
          temperature: 0.7,
        });
      }

      if (loopCount >= maxLoops) {
        logger.error({ phoneE164, loopCount }, "Max tool call loops reached");
        return "Sorry, the request is taking too long. Please try again.";
      }

      const finalMessage = completion.choices[0].message;

      if (finalMessage.content) {
        messages.push({
          role: "assistant",
          content: finalMessage.content,
        });

        // ✅ REAL-TIME TRACKING: Log assistant response
        await this.trackConversationMessage(phoneE164, "assistant_response");
        
        // ✅ REAL-TIME TRACKING: Calculate and log response time
        const responseTime = Date.now() - startTime;
        await this.logActivity("message_processed", phoneE164, {
          responseTimeMs: responseTime,
          messageLength: finalMessage.content.length,
          toolCallsUsed: loopCount,
        });

        logger.info(
          {
            phoneE164,
            responseLength: finalMessage.content.length,
            totalMessages: messages.length,
            responseTimeMs: responseTime,
          },
          "Returning assistant response"
        );

        return finalMessage.content;
      }

      logger.warn({ phoneE164, finishReason: completion.choices[0].finish_reason }, "No valid assistant response");
      return "Sorry, I encountered an issue processing your request. Please try again.";
    } catch (error: any) {
      logger.error({ error: error.message, stack: error.stack, phoneE164 }, "Error processing message");
      
      // ✅ REAL-TIME TRACKING: Log error
      await this.logActivity("message_error", phoneE164, {
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      
      return "Sorry, I encountered an error. Please try again later.";
    }
  }

  private async executeFunction(functionName: string, args: any): Promise<any> {
    logger.info({ functionName, args }, "Executing function");

    try {
      const handler = toolHandlers[functionName];

      if (!handler) {
        logger.error({ functionName }, "Unknown function called");
        return {
          success: false,
          error: "Unknown function",
          message: "Sorry, that operation is not available.",
        };
      }

      const context: ToolContext = {
        prisma: this.prisma,
        currentUserPhone: this.currentUserPhone || "",
        currentLocationContext: this.currentLocationContext,
        currentMediaContext: this.currentMediaContext,
        sendWhatsAppMessage: async (phoneE164: string, message: string) => {
          await this.sendWhatsAppMessage(phoneE164, message);
        },
      };

      const result = await handler(args, context);

      logger.info({ functionName, success: result.success }, "Function executed");
      return result;
    } catch (error: any) {
      logger.error({ error, functionName, args }, "Function execution error");
      return {
        success: false,
        error: error.message,
        message: "Unable to complete this operation at this time.",
      };
    }
  }
}
