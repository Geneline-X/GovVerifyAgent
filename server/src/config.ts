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
  
  database: {
    url: process.env.DATABASE_URL || "",
  },
  
  brandName: process.env.BRAND_NAME || "Crowdsource Agent",
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
