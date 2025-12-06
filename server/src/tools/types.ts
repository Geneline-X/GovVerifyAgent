import type { PrismaClient } from "@prisma/client";

export interface MediaContext {
  hasMedia: boolean;
  mimeType: string;
  data: string; // base64 encoded
  filename: string;
  size: number;
}

export interface ToolContext {
  prisma: PrismaClient;
  currentUserPhone: string;
  currentLocationContext?: {
    hasLocation?: boolean;
    latitude?: number;
    longitude?: number;
    locationDescription?: string;
  };
  currentMediaContext?: MediaContext;
  sendWhatsAppMessage: (phoneE164: string, message: string) => Promise<void>;
  currentProblemContext?: {
    problemId: string;
    title: string;
    location: string;
    category: string;
    description: string;
  };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export type ToolHandler = (args: any, context: ToolContext) => Promise<any>;
