import type { Provider, Message, ContentBlock } from "../providers/types.js";
import { ALL_TOOLS, type Tool, type ToolContext } from "../tools/index.js";
import { buildSystemPrompt } from "./systemPrompt.js";

export interface AgentEvents {
  onAssistantText?: (text: string) => void;
  onToolCall?: (name: string, input: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: string, isError: boolean) => void;
  onUsage?: (usage: { inputTokens: number; outputTokens: number; estimatedContextTokens: number }) => void;
}

export class AgentLoop {
  private history: Message[] = [];
  private provider: Provider;
  private cwd: string;
  private confirm: (message: string) => Promise<boolean>;
  private yolo: boolean;
  private tools: Tool[];
  private onHistoryChange?: (history: Message[]) => void;
  private maxHistoryMessages: number;
  private usage = { inputTokens: 0, outputTokens: 0 };

  constructor(opts: {
    provider: Provider;
    cwd: string;
    yolo?: boolean;
    confirm?: (message: string) => Promise<boolean>;
    tools?: Tool[];
    initialHistory?: Message[];
    onHistoryChange?: (history: Message[]) => void;
    maxHistoryMessages?: number;
  }) {
    this.provider = opts.provider;
    this.cwd = opts.cwd;
    this.yolo = opts.yolo ?? false;
    this.confirm = opts.confirm ?? (async () => true);
    this.tools = opts.tools ?? ALL_TOOLS;
    this.history = opts.initialHistory ?? [];
    this.onHistoryChange = opts.onHistoryChange;
    this.maxHistoryMessages = Math.max(12, opts.maxHistoryMessages ?? 40);
  }

  private getToolByName(name: string): Tool | undefined {
    return this.tools.find((t) => t.definition.name === name);
  }

  getHistory(): Message[] {
    return this.history;
  }

  loadHistory(messages: Message[]): void {
    this.history = messages;
  }

  setProvider(provider: Provider): void {
    this.provider = provider;
  }

  async listModels(): Promise<string[]> {
    return this.provider.listModels ? this.provider.listModels() : [];
  }

  async send(userText: string, events: AgentEvents = {}): Promise<void> {
    this.compactHistory();
    this.history.push({ role: "user", content: [{ type: "text", text: userText }] });

    const toolCtx: ToolContext = { cwd: this.cwd, confirm: this.confirm };
    const systemPrompt = buildSystemPrompt(this.cwd);
    const toolDefs = this.tools.map((t) => t.definition);
    this.onHistoryChange?.(this.history);

    // Loop until the model stops asking for tools.
    for (let turn = 0; turn < 50; turn++) {
      const response = await this.provider.complete({
        systemPrompt,
        messages: this.history,
        tools: toolDefs,
      });

      if (response.usage) {
        this.usage.inputTokens += response.usage.inputTokens;
        this.usage.outputTokens += response.usage.outputTokens;
      }
      events.onUsage?.({ ...this.usage, estimatedContextTokens: this.estimateTokens() });

      this.history.push({ role: "assistant", content: response.content });
      this.onHistoryChange?.(this.history);

      for (const block of response.content) {
        if (block.type === "text" && block.text.trim()) {
          events.onAssistantText?.(block.text);
        }
      }

      if (response.stopReason !== "tool_use") {
        return; // done — final answer given
      }

      const toolUses = response.content.filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use");
      const resultBlocks: ContentBlock[] = [];

      for (const call of toolUses) {
        events.onToolCall?.(call.name, call.input);
        const tool = this.getToolByName(call.name);
        if (!tool) {
          resultBlocks.push({
            type: "tool_result",
            toolCallId: call.id,
            content: `Unknown tool: ${call.name}`,
            isError: true,
          });
          events.onToolResult?.(call.name, "Unknown tool", true);
          continue;
        }

        if (tool.requiresConfirmation && !this.yolo) {
          const approved = await this.confirm(`Run tool "${call.name}" with input ${JSON.stringify(call.input)}?`);
          if (!approved) {
            resultBlocks.push({
              type: "tool_result",
              toolCallId: call.id,
              content: "User declined to run this tool.",
              isError: true,
            });
            events.onToolResult?.(call.name, "declined by user", true);
            continue;
          }
        }

        try {
          const result = await tool.run(call.input, toolCtx);
          resultBlocks.push({ type: "tool_result", toolCallId: call.id, content: result });
          events.onToolResult?.(call.name, result, false);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          resultBlocks.push({ type: "tool_result", toolCallId: call.id, content: message, isError: true });
          events.onToolResult?.(call.name, message, true);
        }
      }

      this.history.push({ role: "tool", content: resultBlocks });
      this.onHistoryChange?.(this.history);
    }

    events.onAssistantText?.("(stopped: reached max tool-call turns for this message)");
  }

  compactHistory(): void {
    if (this.history.length <= this.maxHistoryMessages) return;
    const start = this.history.length - this.maxHistoryMessages;
    const firstUser = this.history.findIndex((message, index) => index >= start && message.role === "user");
    this.history = this.history.slice(firstUser >= 0 ? firstUser : start);
    this.onHistoryChange?.(this.history);
  }

  clearHistory(): void {
    this.history = [];
    this.onHistoryChange?.(this.history);
  }

  getUsage(): { inputTokens: number; outputTokens: number; estimatedContextTokens: number } {
    return { ...this.usage, estimatedContextTokens: this.estimateTokens() };
  }

  private estimateTokens(): number {
    return Math.ceil(JSON.stringify(this.history).length / 4);
  }
}
