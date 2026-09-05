// Normalized types so the agent loop never has to know which provider it's talking to.

export type Role = "user" | "assistant" | "tool";

export interface ToolDefinition {
  name: string;
  description: string;
  // JSON Schema for the tool's input
  inputSchema: Record<string, unknown>;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: "tool_result";
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface Message {
  role: Role;
  content: ContentBlock[];
}

export interface CompletionRequest {
  systemPrompt: string;
  messages: Message[];
  tools: ToolDefinition[];
  maxTokens?: number;
}

export interface CompletionResponse {
  content: ContentBlock[];
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "error";
  usage?: { inputTokens: number; outputTokens: number };
}

export interface ProviderConfig {
  id: string;
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

export interface Provider {
  id: string;
  complete(req: CompletionRequest): Promise<CompletionResponse>;
  listModels?(): Promise<string[]>;
}
