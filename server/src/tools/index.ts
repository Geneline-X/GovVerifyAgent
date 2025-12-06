import type { ToolDefinition, ToolHandler } from "./types";

// Import new government verification tools
import {
  verifyInformationTool,
  verifyInformationHandler,
  reportCyberThreatTool,
  reportCyberThreatHandler,
  getOfficialInfoTool,
  getOfficialInfoHandler,
  checkThreatPatternsTool,
  checkThreatPatternsHandler,
} from "./verification";

export type { ToolContext, ToolDefinition, ToolHandler } from "./types";

// Export new government verification tools
export const toolDefinitions: ToolDefinition[] = [
  verifyInformationTool,
  reportCyberThreatTool,
  getOfficialInfoTool,
  checkThreatPatternsTool,
];

export const toolHandlers: Record<string, ToolHandler> = {
  verify_information: verifyInformationHandler,
  report_cyber_threat: reportCyberThreatHandler,
  get_official_info: getOfficialInfoHandler,
  check_threat_patterns: checkThreatPatternsHandler,
};
