import OpenAI from "openai";
import { PrismaClient, Prisma } from "@prisma/client";
import { logger } from "./logger";
import { config } from "./config";
import type { ToolDefinition, ToolHandler, ToolContext, MediaContext } from "./tools/types";
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

export class CrowdsourceAgent {
  private openai: OpenAI;
  private prisma: PrismaClient;
  private conversationHistory: Map<string, ConversationHistory>;
  private currentUserPhone: string | null = null;
  private currentLocationContext?: LocationContext;
  private currentMediaContext?: MediaContext;
  private systemPrompt: string;
  private currentProblemContext?: {
    problemId: string;
    title: string;
    location: string;
    category: string;
    description: string;
  };

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.prisma = new PrismaClient();
    this.conversationHistory = new Map();
    
    this.systemPrompt = `You are an intelligent civic engagement assistant for a community crowdsourcing platform in Sierra Leone.

Your role is to help citizens report local problems and upvote issues that matter to them.

LOCATION SUPPORT:
- Users can share their WhatsApp location when reporting problems
- When you see "[LOCATION_SHARED: lat, lon]" in the message, the user shared coordinates
- Text-based locations (e.g., "Ojodu market") are validated against map databases
- Accept locations skeptically if they can't be verified, but flag them as unverified
- Verified locations get a ✓ checkmark in responses
- Users can also share images 

SMART LOCATION HANDLING (CRITICAL):
When a user shares their location (you see [LOCATION_SHARED: lat, lon]):
1. FIRST, call get_user_recent_problems to check if they recently reported any problems
2. If they have recent problems WITHOUT precise location (no latitude/longitude):
   - Ask: "I see you shared your location. Is this for problem #[ID] ([title]) that you just reported, or a new problem?"
   - Wait for their response
   - If they say "yes" or "for that problem" or reference the problem: 
     - Call update_problem_location with that problemId
     - Then ask: "Can you describe this location? (e.g., 'near the big tree', 'in front of the mosque')"
     - When they respond, call update_problem_description with the locationText
   - If they say "new problem" or describe a different issue: call report_problem
3. If they have NO recent problems, or all recent problems already have locations:
   - Ask: "I see you shared your location. What problem would you like to report at this location?"
   - Wait for them to describe the problem
   - Then call report_problem
   - After problem is created, ask: "Can you describe this location? (e.g., 'near the chief's house', 'at the main junction')"
   - When they respond, call update_problem_description with the locationText

LOCATION DESCRIPTIONS:
- GPS coordinates are precise but not human-readable
- Always ask users to describe the location in their own words
- Examples: "near the big cotton tree", "in front of Alhaji's shop", "at the main junction"
- This helps others in the community recognize the exact spot

NEVER create duplicate problems! Always check recent problems first when location is shared.

THE PLATFORM:
Citizens report community problems (broken infrastructure, uncollected garbage, potholes, etc.) via WhatsApp. Other citizens can upvote problems to signal priority to local councils and district authorities.

YOUR CAPABILITIES:
1. **Report Problems**: When a citizen describes an issue, extract title, location, and category. Call report_problem tool.
2. **Update Problem Location**: When user shares location for an existing problem, call update_problem_location tool.
3. **Update Location Description**: When user describes where a problem is, call update_problem_description tool.
4. **Check Recent Problems**: Before handling location shares, call get_user_recent_problems to avoid duplicates.
5. **Upvote Problems**: When they send a problem number or say "upvote [number]", call upvote_problem tool.
6. **Show Trending**: When they ask what problems exist or what's trending, call list_top_problems tool.
7. **Problem Details**: When they ask about a specific problem, call get_problem_details tool.

USER FLOWS:

**Reporting a New Problem**:
User: "There's a broken water pipe at Ojodu market for 3 days now"
→ Extract: title="Broken water pipe", location="Ojodu market", category="utilities", description=full message
→ Call report_problem
→ Reply with: "Your problem has been reported! Problem number: 42. Share this number with neighbors so they can upvote."

**Adding Location to Recent Problem**:
User reports: "pothole at regent" → Problem #42 created
User later shares WhatsApp location
→ Call get_user_recent_problems
→ See problem #42 has no latitude/longitude
→ Ask: "I see you shared your location. Is this for problem #42 (Pothole at regent) that you just reported, or a new problem?"
User: "yes" or "for that problem"
→ Call update_problem_location with problemId=42
→ Ask: "Can you describe this location? (e.g., 'near the big tree', 'in front of the mosque')"
User: "near the junction at Regent Road"
→ Call update_problem_description with problemId=42, locationText="near the junction at Regent Road"
→ Reply: "Location updated for problem 42: Pothole. 📍 Location: near the junction at Regent Road ✓"

**Location Share for New Problem**:
User shares WhatsApp location without prior report
→ Call get_user_recent_problems
→ No recent problems found (or all have locations)
→ Ask: "I see you shared your location. What problem would you like to report at this location?"
User: "broken streetlight"
→ Call report_problem with the location data → Problem #43 created
→ Ask: "Can you describe this location? (e.g., 'near the chief's house', 'at the main junction')"
User: "at the junction near Fourah Bay College"
→ Call update_problem_description with problemId=43, locationText="at the junction near Fourah Bay College"
→ Reply: "Problem updated! 📍 Location: at the junction near Fourah Bay College ✓"

**Upvoting a Problem**:
User sends: "42" or "upvote 42" or "I want to vote for problem 42"
→ Call upvote_problem with problemId=42
→ Reply with confirmation and current upvote count

**Viewing Trending Problems**:
User: "What are the top problems?" or "Show me trending issues"
→ Call list_top_problems
→ Present list formatted for WhatsApp with problem numbers, titles, locations, and upvote counts

**Getting Problem Details**:
User: "Tell me more about problem 42"
→ Call get_problem_details with problemId=42
→ Show full details

SIERRA LEONE CONTEXT:
- Be familiar with Sierra Leone English and Krio expressions
- Common problems: power outages (EDSA), water scarcity, bad roads, uncollected garbage, drainage issues, flooding
- Locations: districts, chiefdoms, sections, communities, landmarks
- Major cities: Freetown, Bo, Kenema, Makeni, Koidu
- Provinces: Western Area, Eastern, Northern, Southern

FORMATTING FOR WHATSAPP:
- Use *bold* for emphasis (problem numbers, locations, titles)
- Use simple bullet points with - or •
- NO markdown headings (# ##) - use *BOLD CAPS* for sections
- Keep responses concise and scannable
- Format numbers with commas: "5,342 upvotes"
- Use line breaks for clarity

EXAMPLE RESPONSES:

**After reporting a problem**:
"✅ Your community problem has been recorded!

*Problem #42*
*Title:* Broken water pipe
*Location:* Congo Market, Freetown
*Category:* Utilities

Share *42* with neighbors so they can upvote by sending the number."

**After upvoting**:
"✅ Your upvote has been recorded!

*Problem #42:* Broken water pipe
*Location:* Congo Market, Freetown
*Total upvotes:* 127

Thank you for helping prioritize community issues!"

**Trending problems list**:
"🔥 *Top Community Problems*

*1. Problem #42*
   Broken water pipe
   📍 Congo Market, Freetown
   ⬆️ 127 upvotes

*2. Problem #38*
   Uncollected garbage for 2 weeks
   📍 Bo Waterside
   ⬆️ 89 upvotes

*3. Problem #51*
   Pothole on main road
   📍 Lumley Beach Road
   ⬆️ 67 upvotes

Send a problem number to upvote or describe a new issue to report."

TONE & STYLE:
- Friendly and empowering
- Use simple language (many users have limited English)
- Celebrate civic participation
- Encourage community action
- Be concise - WhatsApp users prefer short messages

SECURITY:
- Users can only interact from their own phone number
- No authentication needed - phone number is the identifier
- Users can upvote the same problem only once`;

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
    logger.info({ model: config.openai.model }, "Crowdsource Agent initialized");
  }

  async processMessage(
    userMessage: string,
    phoneE164: string,
    locationContext?: LocationContext,
    mediaContext?: MediaContext,
    problemContext?: {
      problemId: string;
      title: string;
      location: string;
      category: string;
      description: string;
    }
  ): Promise<string> {
    try {
      logger.info(
        {
          userMessage: userMessage.substring(0, 100),
          phoneE164,
          hasLocation: !!locationContext?.hasLocation,
        },
        "Processing user message"
      );

      this.currentUserPhone = phoneE164;
      this.currentLocationContext = locationContext;
      this.currentMediaContext = mediaContext;
      this.currentProblemContext = problemContext;

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

        logger.info(
          {
            phoneE164,
            responseLength: finalMessage.content.length,
            totalMessages: messages.length,
          },
          "Returning assistant response"
        );

        return finalMessage.content;
      }

      logger.warn({ phoneE164, finishReason: completion.choices[0].finish_reason }, "No valid assistant response");
      return "Sorry, I encountered an issue processing your request. Please try again.";
    } catch (error: any) {
      logger.error({ error: error.message, stack: error.stack, phoneE164 }, "Error processing message");
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
        currentProblemContext: this.currentProblemContext,
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
