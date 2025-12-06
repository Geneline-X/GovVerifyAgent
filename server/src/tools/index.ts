import type { ToolDefinition, ToolHandler } from "./types";

// Import new government verification tools
import {
  verifyInformationTool,
  verifyInformationHandler,
  updateVerificationStatusTool,
  updateVerificationStatusHandler,
  reportCyberThreatTool,
  reportCyberThreatHandler,
  getOfficialInfoTool,
  getOfficialInfoHandler,
  checkThreatPatternsTool,
  checkThreatPatternsHandler,
  escalateInformationRequestTool,
  escalateInformationRequestHandler,
} from "./verification";

export type { ToolContext, ToolDefinition, ToolHandler } from "./types";

// Export new government verification tools
export const toolDefinitions: ToolDefinition[] = [
  verifyInformationTool,
  updateVerificationStatusTool,
  reportCyberThreatTool,
  getOfficialInfoTool,
  checkThreatPatternsTool,
  escalateInformationRequestTool,
];

export const toolHandlers: Record<string, ToolHandler> = {
  verify_information: verifyInformationHandler,
  update_verification_status: updateVerificationStatusHandler,
  report_cyber_threat: reportCyberThreatHandler,
  get_official_info: getOfficialInfoHandler,
  check_threat_patterns: checkThreatPatternsHandler,
  escalate_information_request: escalateInformationRequestHandler,
};
