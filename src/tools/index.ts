import { bashTool } from "./bash.js";
import { readFileTool, writeFileTool, editFileTool, listDirTool } from "./fileOps.js";
import { globTool, grepTool } from "./search.js";
import { gitTool } from "./git.js";
import type { Tool } from "./types.js";

export const ALL_TOOLS: Tool[] = [
  readFileTool,
  writeFileTool,
  editFileTool,
  listDirTool,
  globTool,
  grepTool,
  gitTool,
  bashTool,
];

export function getToolByName(name: string): Tool | undefined {
  return ALL_TOOLS.find((t) => t.definition.name === name);
}

export * from "./types.js";
