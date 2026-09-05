import type { ToolDefinition } from "../providers/types.js";

export interface ToolContext {
  cwd: string;
  confirm: (message: string) => Promise<boolean>;
}

export interface Tool {
  definition: ToolDefinition;
  // Returns the string to feed back to the model as the tool_result content.
  run(input: Record<string, unknown>, ctx: ToolContext): Promise<string>;
  // Tools that mutate the filesystem or run commands should require confirmation
  // in interactive mode unless the user has set --yolo.
  requiresConfirmation: boolean;
}
