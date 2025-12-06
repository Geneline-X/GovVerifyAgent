import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3800", 10),
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  },
  
  whatsapp: {
    serverUrl: process.env.WHATSAPP_SERVER_URL || "http://localhost:3700",
    apiKey: process.env.WHATSAPP_API_KEY || "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "crowdsource_verify_token",
  },
  
  agent: {
    apiKey: process.env.AGENT_API_KEY || "",
  },
  
  genelineX: {
    apiUrl: process.env.GENELINE_X_API_URL || "https://message.geneline-x.net/api/v1/message",
    apiKey: process.env.GENELINE_X_API_KEY || "b5a5a2b9aadef40dec688ed92b1464e59719deb13b6d7425820b30c16d21392d",
    chatbotId: process.env.GENELINE_X_CHATBOT_ID || "cmis6o6ps0001l404u6l8hizq",
  },
  
  database: {
    url: process.env.DATABASE_URL || "",
  },
  
  brandName: process.env.BRAND_NAME || "Gov Verify Agent",
};

// Validate required config
const requiredEnvVars = [
  "OPENAI_API_KEY",
  "WHATSAPP_SERVER_URL",
  "WHATSAPP_API_KEY",
  "AGENT_API_KEY",
  "DATABASE_URL",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
